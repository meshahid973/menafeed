use std::{
    collections::HashSet,
    net::IpAddr,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use feed_rs::parser;
use reqwest::{redirect::Policy, Client, Url};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::database;

const MAX_FEED_BYTES: usize = 1_500_000;
const CACHE_SECONDS: i64 = 300;

#[derive(Clone, Copy)]
struct Source {
    id: &'static str,
    name: &'static str,
    feed: &'static str,
}

const SOURCES: [Source; 3] = [
    Source {
        id: "bbc",
        name: "BBC Middle East",
        feed: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    },
    Source {
        id: "france24",
        name: "France 24",
        feed: "https://www.france24.com/en/middle-east/rss",
    },
    Source {
        id: "mem",
        name: "Middle East Monitor",
        feed: "https://www.middleeastmonitor.com/feed/",
    },
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedArticle {
    id: String,
    source_id: String,
    source_name: String,
    title: String,
    url: String,
    published_at: Option<String>,
    summary: Option<String>,
    location: ArticleLocation,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "precision", rename_all = "lowercase")]
enum ArticleLocation {
    Unknown,
    Country {
        #[serde(rename = "countryCode")]
        country_code: String,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceState {
    id: String,
    name: String,
    mode: &'static str,
    count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsFeedResponse {
    articles: Vec<FeedArticle>,
    sources: Vec<SourceState>,
    received_at: String,
}

struct SourceResult {
    articles: Vec<FeedArticle>,
    state: SourceState,
}

struct Cached {
    articles: Vec<FeedArticle>,
    expires_at: i64,
}

pub async fn load(app: AppHandle, force: bool) -> Result<NewsFeedResponse, String> {
    // No arbitrary URL is accepted from the frontend. Redirects are host-restricted.
    let client = Client::builder()
        .timeout(Duration::from_secs(9))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 || !approved_feed_host(attempt.url()) {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .user_agent("SIGNAL-MENA/0.2 (desktop RSS reader)")
        .build()
        .map_err(|_| "Could not initialize the news service")?;

    let (first, second, third) = tokio::join!(
        load_source(&app, &client, SOURCES[0], force),
        load_source(&app, &client, SOURCES[1], force),
        load_source(&app, &client, SOURCES[2], force)
    );

    let mut articles = Vec::new();
    let mut sources = Vec::new();
    for result in [first, second, third] {
        sources.push(result.state);
        articles.extend(result.articles);
    }

    // Exact URL deduplication only. Cross-publisher story clustering requires
    // trustworthy evidence and is deliberately not part of this phase.
    let mut seen = HashSet::new();
    articles.retain(|article| seen.insert(article.url.clone()));
    articles.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    articles.truncate(100);

    Ok(NewsFeedResponse {
        articles,
        sources,
        received_at: chrono::Utc::now().to_rfc3339(),
    })
}

async fn load_source(
    app: &AppHandle,
    client: &Client,
    source: Source,
    force: bool,
) -> SourceResult {
    let cached = read_cache(app, source.id).ok().flatten();
    if !force {
        if let Some(ref cache) = cached {
            if cache.expires_at > now() {
                return SourceResult {
                    state: source_state(source, "cached", cache.articles.len()),
                    articles: cache.articles.clone(),
                };
            }
        }
    }

    match fetch_source(client, source).await {
        Ok(articles) => {
            // A failed cache write must not hide a successful network response.
            let _ = write_cache(app, source.id, &articles);
            SourceResult {
                state: source_state(source, "fresh", articles.len()),
                articles,
            }
        }
        Err(_) => {
            if let Some(cache) = cached {
                SourceResult {
                    state: source_state(source, "stale", cache.articles.len()),
                    articles: cache.articles,
                }
            } else {
                SourceResult {
                    state: source_state(source, "unavailable", 0),
                    articles: Vec::new(),
                }
            }
        }
    }
}

fn source_state(source: Source, mode: &'static str, count: usize) -> SourceState {
    SourceState {
        id: source.id.into(),
        name: source.name.into(),
        mode,
        count,
    }
}

async fn fetch_source(client: &Client, source: Source) -> Result<Vec<FeedArticle>, String> {
    let mut response = client
        .get(source.feed)
        .send()
        .await
        .map_err(|_| "Source unavailable")?
        .error_for_status()
        .map_err(|_| "Source returned an error")?;

    if !approved_feed_host(response.url()) {
        return Err("Unexpected feed origin".into());
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Feed download failed")? {
        if bytes.len().saturating_add(chunk.len()) > MAX_FEED_BYTES {
            return Err("Feed exceeded size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }

    parse_source(&bytes, source)
}

fn approved_feed_host(url: &Url) -> bool {
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some("feeds.bbci.co.uk" | "www.france24.com" | "www.middleeastmonitor.com")
        )
        && url.username().is_empty()
        && url.password().is_none()
}

fn parse_source(xml: &[u8], source: Source) -> Result<Vec<FeedArticle>, String> {
    let parsed = parser::parse(xml).map_err(|_| "Invalid RSS data")?;
    let mut articles = Vec::new();

    for entry in parsed.entries.into_iter().take(60) {
        let title = entry.title.map(|value| clean_text(&value.content, 170));
        let Some(title) = title.filter(|value| !value.is_empty()) else {
            continue;
        };

        let link = entry
            .links
            .iter()
            .find(|link| link.rel.as_deref() == Some("alternate"))
            .or_else(|| entry.links.first())
            .and_then(|link| safe_article_url(&link.href).ok());
        let Some(url) = link else { continue };

        let summary = entry
            .summary
            .map(|value| clean_text(&value.content, 280))
            .filter(|value| !value.is_empty());

        articles.push(FeedArticle {
            id: url.clone(),
            source_id: source.id.into(),
            source_name: source.name.into(),
            title,
            url,
            published_at: entry
                .published
                .or(entry.updated)
                .map(|date| date.to_rfc3339()),
            summary,
            location: location_from_categories(&entry.categories),
        });
    }

    Ok(articles)
}

/// Assign country precision only when a publisher's category explicitly names
/// exactly one MENA country. Headline and summary text are never geocoded here.
fn location_from_categories(categories: &[feed_rs::model::Category]) -> ArticleLocation {
    let mut country_codes = HashSet::new();
    for category in categories {
        if let Some(code) = country_code_from_category(&category.term) {
            country_codes.insert(code);
        }
        if let Some(label) = category.label.as_deref() {
            if let Some(code) = country_code_from_category(label) {
                country_codes.insert(code);
            }
        }
    }

    if country_codes.len() == 1 {
        ArticleLocation::Country {
            country_code: country_codes.into_iter().next().unwrap_or_default().to_string(),
        }
    } else {
        // Multiple country tags are ambiguous for a single-country filter.
        ArticleLocation::Unknown
    }
}

fn country_code_from_category(value: &str) -> Option<&'static str> {
    let normalized = value
        .trim()
        .to_ascii_lowercase()
        .replace('_', " ")
        .replace('-', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    match normalized.as_str() {
        "algeria" => Some("DZ"),
        "bahrain" => Some("BH"),
        "djibouti" => Some("DJ"),
        "egypt" => Some("EG"),
        "eritrea" => Some("ER"),
        "iran" | "iranian" => Some("IR"),
        "iraq" | "iraqi" => Some("IQ"),
        "israel" | "israeli" => Some("IL"),
        "jordan" | "jordanian" => Some("JO"),
        "kuwait" | "kuwaiti" => Some("KW"),
        "lebanon" | "lebanese" => Some("LB"),
        "libya" | "libyan" => Some("LY"),
        "mauritania" => Some("MR"),
        "morocco" | "moroccan" => Some("MA"),
        "oman" | "omani" => Some("OM"),
        "palestine" | "palestinian territories" | "west bank and gaza" | "west bank" => Some("PS"),
        "qatar" | "qatari" => Some("QA"),
        "saudi arabia" | "saudi" | "ksa" => Some("SA"),
        "somalia" | "somali" => Some("SO"),
        "sudan" | "sudanese" => Some("SD"),
        "syria" | "syrian" => Some("SY"),
        "tunisia" | "tunisian" => Some("TN"),
        "turkiye" | "türkiye" | "turkey" => Some("TR"),
        "united arab emirates" | "uae" | "emirates" => Some("AE"),
        "yemen" | "yemeni" => Some("YE"),
        "western sahara" | "sahrawi arab democratic republic" => Some("EH"),
        "cyprus" | "cypriot" => Some("CY"),
        _ => None,
    }
}

fn clean_text(input: &str, limit: usize) -> String {
    // RSS summaries often contain markup. Strip it and render as plain text only.
    let mut without_tags = String::new();
    let mut in_tag = false;
    for character in input.chars() {
        match character {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                without_tags.push(' ');
            }
            _ if !in_tag => without_tags.push(character),
            _ => {}
        }
    }
    without_tags
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(limit)
        .collect()
}

pub fn safe_article_url(input: &str) -> Result<String, String> {
    let parsed = Url::parse(input).map_err(|_| "Invalid article URL")?;
    let hostname = parsed.host_str().ok_or("Missing article host")?;
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || hostname.parse::<IpAddr>().is_ok()
        || hostname.eq_ignore_ascii_case("localhost")
        || hostname.ends_with(".localhost")
        || hostname.ends_with(".local")
    {
        return Err("Unsafe article URL".into());
    }
    Ok(parsed.to_string())
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn read_cache(app: &AppHandle, source: &str) -> Result<Option<Cached>, String> {
    let connection = database::open(app).map_err(|_| "Cache unavailable")?;
    let row: Option<(String, i64)> = connection
        .query_row(
            "SELECT payload_json, expires_at FROM cache_entries WHERE provider = 'rss' AND cache_key = ?1",
            params![source],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|_| "Cache read failed")?;

    row.map(|(json, expires_at)| {
        serde_json::from_str(&json)
            .map(|articles| Cached {
                articles,
                expires_at,
            })
            .map_err(|_| "Cached feed is invalid".into())
    })
    .transpose()
}

fn write_cache(app: &AppHandle, source: &str, articles: &[FeedArticle]) -> Result<(), String> {
    let connection = database::open(app).map_err(|_| "Cache unavailable")?;
    let timestamp = now();
    let json = serde_json::to_string(articles).map_err(|_| "Cannot encode feed")?;
    connection
        .execute(
            "INSERT INTO cache_entries (provider, cache_key, payload_json, fetched_at, expires_at)
            VALUES ('rss', ?1, ?2, ?3, ?4)
            ON CONFLICT (provider, cache_key) DO UPDATE SET
            payload_json = excluded.payload_json,
            fetched_at = excluded.fetched_at,
            expires_at = excluded.expires_at",
            params![source, json, timestamp, timestamp + CACHE_SECONDS],
        )
        .map_err(|_| "Cache write failed")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_feed_and_keeps_location_unknown() {
        let feed = br#"<rss version="2.0"><channel><title>Test</title>
        <item><title>Regional update</title><link>https://example.org/story</link>
        <description>Overview &amp; details</description>
        <pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item>
        </channel></rss>"#;
        let articles = parse_source(feed, SOURCES[0]).unwrap();
        assert_eq!(articles.len(), 1);
        assert!(matches!(articles[0].location, ArticleLocation::Unknown));
        assert_eq!(articles[0].source_id, "bbc");
        assert!(articles[0].published_at.is_some());
    }

    #[test]
    fn only_explicit_single_country_categories_produce_country_precision() {
        let tagged = br#"<rss version="2.0"><channel><title>Test</title>
        <item><title>Regional update</title><link>https://example.org/story</link>
        <category>Egypt</category></item>
        </channel></rss>"#;
        let articles = parse_source(tagged, SOURCES[0]).unwrap();
        assert_eq!(articles.len(), 1);
        assert!(matches!(
            &articles[0].location,
            ArticleLocation::Country { country_code } if country_code == "EG"
        ));
        let json = serde_json::to_value(&articles[0]).unwrap();
        assert_eq!(json["location"]["precision"], "country");
        assert_eq!(json["location"]["countryCode"], "EG");
    }

    #[test]
    fn headline_mentions_never_assign_country_location() {
        let feed = br#"<rss version="2.0"><channel><title>Test</title>
        <item><title>Egypt and Morocco discussed at regional meeting</title>
        <link>https://example.org/story</link><description>Talks include Saudi Arabia.</description></item>
        </channel></rss>"#;
        let articles = parse_source(feed, SOURCES[0]).unwrap();
        assert_eq!(articles.len(), 1);
        assert!(matches!(articles[0].location, ArticleLocation::Unknown));
    }

    #[test]
    fn multiple_country_categories_are_not_force_assigned() {
        let feed = br#"<rss version="2.0"><channel><title>Test</title>
        <item><title>Regional update</title><link>https://example.org/story</link>
        <category>Egypt</category><category>Morocco</category></item>
        </channel></rss>"#;
        let articles = parse_source(feed, SOURCES[0]).unwrap();
        assert!(matches!(articles[0].location, ArticleLocation::Unknown));
    }

    #[test]
    fn blocks_unsafe_links() {
        for input in [
            "http://example.org",
            "javascript:alert(1)",
            "https://localhost/",
            "https://127.0.0.1/",
            "https://user:pass@example.org/",
        ] {
            assert!(safe_article_url(input).is_err(), "{input}");
        }
        assert!(safe_article_url("https://www.bbc.com/news/story").is_ok());
    }

    #[test]
    fn strips_markup_from_summaries() {
        assert_eq!(clean_text("<p>News <b>brief</b></p>", 100), "News brief");
    }
}
