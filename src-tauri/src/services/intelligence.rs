use std::collections::{HashMap, HashSet};

use reqwest::Url;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::database;

const MAX_RESULTS: usize = 50;

pub fn canonical_url(input: &str) -> Option<String> {
    let mut url = Url::parse(input).ok()?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return None;
    }
    url.set_fragment(None);
    let kept: Vec<(String, String)> = url
        .query_pairs()
        .filter(|(key, _)| {
            !key.starts_with("utm_")
                && !matches!(key.as_ref(), "fbclid" | "gclid" | "mc_cid" | "mc_eid")
        })
        .map(|(a, b)| (a.into_owned(), b.into_owned()))
        .collect();
    url.set_query(None);
    if !kept.is_empty() {
        url.query_pairs_mut().extend_pairs(kept);
    }
    Some(url.to_string())
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .chars()
        .map(|ch| if ch.is_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(str::to_owned)
        .collect()
}

fn category(text: &str) -> &'static str {
    let text = format!(" {} ", tokenize(text).join(" "));
    let matching = |terms: &[&str]| terms.iter().any(|word| text.contains(&format!(" {word} ")));
    if matching(&[
        "humanitarian",
        "aid",
        "displaced",
        "famine",
        "refugees",
        "relief",
        "earthquake",
        "flood",
        "hunger",
    ]) {
        "humanitarian"
    } else if matching(&[
        "economy",
        "economic",
        "trade",
        "inflation",
        "stocks",
        "market",
        "bank",
        "investment",
        "oil",
        "exports",
    ]) {
        "economy"
    } else if matching(&[
        "culture",
        "film",
        "festival",
        "music",
        "art",
        "exhibition",
        "literature",
        "cinema",
    ]) {
        "culture"
    } else if matching(&[
        "election",
        "minister",
        "president",
        "parliament",
        "diplomacy",
        "sanctions",
        "government",
        "diplomatic",
    ]) {
        "politics"
    } else {
        "general"
    }
}

fn fnv_id(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash = (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn cluster_title(title: &str, url: &str) -> String {
    let tokens = tokenize(title);
    // Do not claim stories are equivalent based on a vague one-line headline.
    if tokens.len() < 6 {
        return format!("item-{}", fnv_id(url));
    }
    format!("story-{}", fnv_id(&tokens.join(" ")))
}

fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn published(value: &Value) -> String {
    text(value, "publishedAt")
}

/// Independent of the globe. Adds optional metadata without changing country or city evidence.
pub fn enrich(value: &mut Value) {
    let Some(items) = value.get_mut("articles").and_then(Value::as_array_mut) else {
        return;
    };
    let mut seen = HashSet::new();
    items.retain_mut(|article| {
        let Some(original_url) = article.get("url").and_then(Value::as_str) else {
            return false;
        };
        let Some(canonical) = canonical_url(original_url) else {
            return false;
        };
        if !seen.insert(canonical.clone()) {
            return false;
        }
        let title = text(article, "title");
        let body = format!("{} {}", title, text(article, "summary"));
        let kind = category(&body);
        let group = cluster_title(&title, &canonical);
        article["canonicalUrl"] = json!(canonical);
        article["category"] = json!(kind);
        article["clusterId"] = json!(group);
        true
    });
    let mut sizes = HashMap::<String, usize>::new();
    for item in items.iter() {
        *sizes.entry(text(item, "clusterId")).or_default() += 1;
    }
    for item in items.iter_mut() {
        item["clusterSize"] = json!(sizes.get(&text(item, "clusterId")).copied().unwrap_or(1));
    }
    // Preserve recency within each publisher, but prevent a single prolific source
    // from occupying the entire opening wire.
    items.sort_by(|a, b| published(b).cmp(&published(a)));
    let mut leading = Vec::new();
    let mut trailing = Vec::new();
    let mut count = HashMap::<String, usize>::new();
    for item in std::mem::take(items) {
        let n = count.entry(text(&item, "sourceId")).or_default();
        if *n < 3 {
            leading.push(item);
            *n += 1;
        } else {
            trailing.push(item);
        }
    }
    leading.extend(trailing);
    *items = leading;
}

pub fn save(conn: &mut Connection, response: &Value) -> rusqlite::Result<usize> {
    let Some(articles) = response.get("articles").and_then(Value::as_array) else {
        return Ok(0);
    };
    let now = chrono::Utc::now().timestamp();
    let tx = conn.transaction()?;
    let mut count = 0;
    for article in articles {
        let url = text(article, "canonicalUrl");
        if url.is_empty() {
            continue;
        }
        let payload = article.to_string();
        tx.execute(
            "INSERT INTO news_articles
             (canonical_url,payload_json,title,summary,source_id,category,cluster_id,published_at,first_seen,last_seen)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)
             ON CONFLICT(canonical_url) DO UPDATE SET
             payload_json=excluded.payload_json,title=excluded.title,summary=excluded.summary,
             source_id=excluded.source_id,category=excluded.category,cluster_id=excluded.cluster_id,
             published_at=excluded.published_at,last_seen=excluded.last_seen",
            params![url,payload,text(article,"title"),text(article,"summary"),
                text(article,"sourceId"),text(article,"category"),text(article,"clusterId"),
                article.get("publishedAt").and_then(Value::as_str),now],
        )?;
        count += 1;
    }
    // Retain enough history for offline browsing without accumulating indefinitely.
    tx.execute(
        "DELETE FROM news_articles WHERE last_seen < ?1",
        params![now - 90 * 86_400],
    )?;
    tx.commit()?;
    Ok(count)
}

pub fn search(conn: &Connection, query: &str, limit: usize) -> rusqlite::Result<Vec<Value>> {
    let terms: Vec<String> = tokenize(query)
        .into_iter()
        .filter(|term| term.chars().count() >= 2)
        .take(8)
        .map(|term| format!("\"{}\"", term.replace('"', "")))
        .collect();
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    let expression = terms.join(" AND ");
    let mut stmt = conn.prepare(
        "SELECT news_articles.payload_json FROM news_articles_fts
         JOIN news_articles ON news_articles.rowid=news_articles_fts.rowid
         WHERE news_articles_fts MATCH ?1
         ORDER BY bm25(news_articles_fts), news_articles.published_at DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(
        params![expression, limit.clamp(1, MAX_RESULTS) as i64],
        |row| row.get::<_, String>(0),
    )?;
    rows.map(|row| {
        let json = row?;
        serde_json::from_str(&json).map_err(|_| rusqlite::Error::InvalidQuery)
    })
    .collect()
}

pub fn process(app: &AppHandle, response: &mut Value) {
    enrich(response);
    if let Ok(mut conn) = database::open(app) {
        // A disk or indexing error cannot block today's news.
        if let Err(error) = save(&mut conn, response) {
            eprintln!("SIGNAL local news index: {error}");
        }
    }
}

pub fn search_cached(app: &AppHandle, query: &str, limit: usize) -> Result<Vec<Value>, String> {
    let conn = database::open(app).map_err(|_| "Local index unavailable")?;
    search(&conn, query, limit).map_err(|_| "Local search unavailable".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_tracking_without_touching_functional_query() {
        assert_eq!(
            canonical_url("https://example.org/story?id=4&utm_source=rss#top").as_deref(),
            Some("https://example.org/story?id=4")
        );
        assert_eq!(
            canonical_url("https://example.org/story?id=5").as_deref(),
            Some("https://example.org/story?id=5")
        );
    }

    #[test]
    fn dedupes_canonical_links_and_does_not_hide_similar_events() {
        let mut value = json!({"articles":[
            {"url":"https://example.org/a?utm_source=foo","title":"Regional events tonight","sourceId":"a","publishedAt":"2026-10-21"},
            {"url":"https://example.org/a?utm_source=bar","title":"Regional events tonight","sourceId":"a","publishedAt":"2026-10-21"},
            {"url":"https://other.org/b","title":"Regional events tomorrow","sourceId":"b","publishedAt":"2026-10-21"}
        ]});
        enrich(&mut value);
        assert_eq!(value["articles"].as_array().unwrap().len(), 2);
        assert_eq!(value["articles"][0]["clusterSize"], 1);
    }

    #[test]
    fn persisted_index_supports_offline_search_and_updates() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../migrations/0002_news_intelligence.sql"))
            .unwrap();
        let mut response = json!({"articles":[{"url":"https://example.org/sudan","title":"Sudan humanitarian aid","summary":"Relief report","sourceId":"s","sourceName":"Publisher","id":"s1","publishedAt":"2026-10-21T10:00:00Z","location":{"precision":"unknown"}}]});
        enrich(&mut response);
        save(&mut conn, &response).unwrap();
        save(&mut conn, &response).unwrap();
        let matches = search(&conn, "Sudan aid", 10).unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0]["title"], "Sudan humanitarian aid");
        assert!(search(&conn, "unknown", 10).unwrap().is_empty());
    }

    #[test]
    fn categories_are_conservative() {
        assert_eq!(category("The regional oil market expands"), "economy");
        assert_eq!(category("Unrelated local update"), "general");
    }
}
