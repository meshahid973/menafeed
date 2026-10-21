use std::{
    collections::HashSet,
    net::IpAddr,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use feed_rs::parser;
use reqwest::{
    header::{ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED},
    redirect::Policy,
    Client, StatusCode, Url,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::sources::{approved_feed_host, is_mena_relevant, Source, SOURCES};
use crate::database;

const MAX_FEED_BYTES: usize = 1_500_000;
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
    location: UnknownLocation,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct UnknownLocation {
    precision: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceState {
    id: String,
    name: String,
    mode: &'static str,
    count: usize,
    checked_at: String,
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
    headers: CacheHeaders,
}

#[derive(Clone, Default, Serialize, Deserialize)]
struct CacheHeaders {
    etag: Option<String>,
    last_modified: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct StoredFeed {
    articles: Vec<FeedArticle>,
    headers: CacheHeaders,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StoredFormat {
    Legacy(Vec<FeedArticle>),
    Current(StoredFeed),
}

enum Fetched {
    Updated(Vec<FeedArticle>, CacheHeaders),
    NotModified,
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

    let (a, b, c, d, e, f) = tokio::join!(
        load_source(&app, &client, SOURCES[0], force),
        load_source(&app, &client, SOURCES[1], force),
        load_source(&app, &client, SOURCES[2], force),
        load_source(&app, &client, SOURCES[3], force),
        load_source(&app, &client, SOURCES[4], force),
        load_source(&app, &client, SOURCES[5], force)
    );

    let reliefweb_result = async {
        let app_name = std::env::var("SIGNAL_RELIEFWEB_APPNAME").ok()?;
        Some(load_reliefweb(&app, &client, &app_name, force).await)
    };
    // API requests are optional. No identifier means no ReliefWeb traffic.
    let reliefweb = reliefweb_result.await;

    let mut articles = Vec::new();
    let mut sources = Vec::new();
    for result in [a, b, c, d, e, f] {
        sources.push(result.state);
        articles.extend(result.articles);
    }
    if let Some(result) = reliefweb {
        sources.push(result.state);
        articles.extend(result.articles);
    }

    // Exact URL deduplication only. Cross-publisher story clustering requires
    // trustworthy evidence and is deliberately not part of this phase.
    let mut seen = HashSet::new();
    articles.retain(|article| seen.insert(article.url.clone()));
    articles.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    articles.truncate(150);

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

    match fetch_source(client, source, cached.as_ref()).await {
        Ok(Fetched::Updated(articles, headers)) => {
            let _ = write_cache(app, source, &articles, &headers);
            SourceResult {
                state: source_state(source, "fresh", articles.len()),
                articles,
            }
        }
        Ok(Fetched::NotModified) => {
            if let Some(cache) = cached {
                let _ = write_cache(app, source, &cache.articles, &cache.headers);
                SourceResult {
                    state: source_state(source, "cached", cache.articles.len()),
                    articles: cache.articles,
                }
            } else {
                SourceResult {
                    state: source_state(source, "unavailable", 0),
                    articles: Vec::new(),
                }
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

const RELIEFWEB_SOURCE: Source = Source {
    id: "reliefweb",
    name: "ReliefWeb",
    feed: "https://api.reliefweb.int/v2/reports",
    interval_seconds: 300,
    max_articles: 24,
    require_region_match: true,
};

async fn load_reliefweb(
    app: &AppHandle,
    client: &Client,
    app_name: &str,
    force: bool,
) -> SourceResult {
    let source = RELIEFWEB_SOURCE;
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
    match super::reliefweb::fetch_reports(client, app_name).await {
        Ok(reports) => {
            let articles: Vec<FeedArticle> = reports
                .into_iter()
                .filter_map(|item| {
                    let url = safe_article_url(&item.url).ok()?;
                    Some(FeedArticle {
                        id: url.clone(),
                        source_id: source.id.into(),
                        source_name: source.name.into(),
                        title: item.title,
                        url,
                        published_at: item.published_at,
                        summary: None,
                        location: UnknownLocation {
                            precision: "unknown".into(),
                        },
                    })
                })
                .take(source.max_articles)
                .collect();
            let _ = write_cache(app, source, &articles, &CacheHeaders::default());
            SourceResult {
                state: source_state(source, "fresh", articles.len()),
                articles,
            }
        }
        Err(_) => match cached {
            Some(cache) => SourceResult {
                state: source_state(source, "stale", cache.articles.len()),
                articles: cache.articles,
            },
            None => SourceResult {
                state: source_state(source, "unavailable", 0),
                articles: Vec::new(),
            },
        },
    }
}

fn source_state(source: Source, mode: &'static str, count: usize) -> SourceState {
    SourceState {
        id: source.id.into(),
        name: source.name.into(),
        mode,
        count,
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}

async fn fetch_source(
    client: &Client,
    source: Source,
    cached: Option<&Cached>,
) -> Result<Fetched, String> {
    let mut request = client.get(source.feed);
    if let Some(cache) = cached {
        if let Some(ref tag) = cache.headers.etag {
            request = request.header(IF_NONE_MATCH, tag.as_str());
        }
        if let Some(ref value) = cache.headers.last_modified {
            request = request.header(IF_MODIFIED_SINCE, value.as_str());
        }
    }
    let response = request.send().await.map_err(|_| "Source unavailable")?;
    if !approved_feed_host(response.url()) {
        return Err("Unexpected feed origin".into());
    }
    if response.status() == StatusCode::NOT_MODIFIED {
        return Ok(Fetched::NotModified);
    }
    let mut response = response
        .error_for_status()
        .map_err(|_| "Source returned an error")?;
    let headers = CacheHeaders {
        etag: response
            .headers()
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .filter(|v| v.len() <= 200)
            .map(str::to_owned),
        last_modified: response
            .headers()
            .get(LAST_MODIFIED)
            .and_then(|v| v.to_str().ok())
            .filter(|v| v.len() <= 200)
            .map(str::to_owned),
    };
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Feed download failed")? {
        if bytes.len().saturating_add(chunk.len()) > MAX_FEED_BYTES {
            return Err("Feed exceeded size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let articles = parse_source(&bytes, source)?;
    Ok(Fetched::Updated(articles, headers))
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

        if source.require_region_match
            && !is_mena_relevant(&format!("{} {}", title, summary.as_deref().unwrap_or("")))
        {
            continue;
        }

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
            location: UnknownLocation {
                precision: "unknown".into(),
            },
        });
    }

    articles.truncate(source.max_articles);
    Ok(articles)
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
    let row: Option<(String, i64)> = connection.query_row(
        "SELECT payload_json, expires_at FROM cache_entries WHERE provider = 'rss' AND cache_key = ?1",
        params![source],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|_| "Cache read failed")?;

    row.map(|(json, expires_at)| {
        let stored: StoredFormat =
            serde_json::from_str(&json).map_err(|_| "Cached feed is invalid")?;
        let (articles, headers) = match stored {
            StoredFormat::Legacy(articles) => (articles, CacheHeaders::default()),
            StoredFormat::Current(data) => (data.articles, data.headers),
        };
        Ok(Cached {
            articles,
            headers,
            expires_at,
        })
    })
    .transpose()
}

fn write_cache(
    app: &AppHandle,
    source: Source,
    articles: &[FeedArticle],
    headers: &CacheHeaders,
) -> Result<(), String> {
    let connection = database::open(app).map_err(|_| "Cache unavailable")?;
    let timestamp = now();
    let json = serde_json::to_string(&StoredFeed {
        articles: articles.to_vec(),
        headers: headers.clone(),
    })
    .map_err(|_| "Cannot encode feed")?;
    connection
        .execute(
            "INSERT INTO cache_entries (provider, cache_key, payload_json, fetched_at, expires_at)
         VALUES ('rss', ?1, ?2, ?3, ?4)
         ON CONFLICT (provider, cache_key) DO UPDATE SET
         payload_json = excluded.payload_json,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at",
            params![
                source.id,
                json,
                timestamp,
                timestamp + source.interval_seconds
            ],
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
        assert_eq!(articles[0].location.precision, "unknown");
        assert_eq!(articles[0].source_id, "bbc");
        assert!(articles[0].published_at.is_some());
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
