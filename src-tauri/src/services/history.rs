use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use super::geoevents::{self, GeoSnapshot};
use crate::database;

const MAX_SLOT_ARTICLES: i64 = 150;
const DAY_SECONDS: i64 = 86_400;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryBucket {
    pub start_epoch: i64,
    pub count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySnapshot {
    pub start_epoch: i64,
    pub end_epoch: i64,
    pub bucket_seconds: i64,
    pub selected_index: usize,
    pub total_count: usize,
    pub selected_count: usize,
    pub buckets: Vec<HistoryBucket>,
    pub articles: Vec<Value>,
    pub geo: GeoSnapshot,
}

fn validate(
    start_epoch: i64,
    end_epoch: i64,
    bucket_count: usize,
    selected_index: usize,
    country: Option<&str>,
) -> Result<i64, String> {
    let length = end_epoch
        .checked_sub(start_epoch)
        .ok_or("Invalid reporting window")?;
    if !((length == DAY_SECONDS && bucket_count == 24)
        || (length == 7 * DAY_SECONDS && bucket_count == 28))
        || selected_index >= bucket_count
    {
        return Err("Invalid reporting window".into());
    }
    if country.is_some_and(|code| !geoevents::known_mena_country(code)) {
        return Err("Unsupported country".into());
    }
    Ok(length / bucket_count as i64)
}

/// A text-relevance tag may filter reports, but can never establish a map pin.
/// Geographic markers pass through the existing evidence validator.
pub fn query(
    conn: &Connection,
    start_epoch: i64,
    end_epoch: i64,
    bucket_count: usize,
    selected_index: usize,
    country: Option<&str>,
) -> Result<HistorySnapshot, String> {
    let step = validate(
        start_epoch,
        end_epoch,
        bucket_count,
        selected_index,
        country,
    )?;
    const COUNTRY: &str = "(
        ?3 IS NULL OR
        EXISTS (SELECT 1 FROM json_each(news_articles.payload_json, '$.countryCodes') AS tag
                WHERE tag.value = ?3)
        OR json_extract(news_articles.payload_json, '$.location.countryCode') = ?3
    )";
    let sql = format!(
        "SELECT (published_epoch - ?1) / ?4 AS slot, COUNT(*) FROM news_articles
         WHERE published_epoch >= ?1 AND published_epoch < ?2 AND {COUNTRY}
         GROUP BY slot"
    );
    let mut counts = vec![0_usize; bucket_count];
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|_| "History index unavailable")?;
    let rows = stmt
        .query_map(params![start_epoch, end_epoch, country, step], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, usize>(1)?))
        })
        .map_err(|_| "History query unavailable")?;
    for row in rows {
        let (slot, count) = row.map_err(|_| "History query unavailable")?;
        if let Ok(index) = usize::try_from(slot) {
            if let Some(item) = counts.get_mut(index) {
                *item = count;
            }
        }
    }
    let total_count = counts.iter().sum();
    let selected_count = counts[selected_index];
    let slot_start = start_epoch + selected_index as i64 * step;
    let slot_end = slot_start + step;
    let sql = format!(
        "SELECT payload_json FROM news_articles
         WHERE published_epoch >= ?1 AND published_epoch < ?2 AND {COUNTRY}
         ORDER BY published_epoch DESC, canonical_url ASC LIMIT ?4"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|_| "History index unavailable")?;
    let rows = stmt
        .query_map(
            params![slot_start, slot_end, country, MAX_SLOT_ARTICLES],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| "History query unavailable")?;
    let mut articles = Vec::new();
    for row in rows {
        let json = row.map_err(|_| "History query unavailable")?;
        if let Ok(article) = serde_json::from_str::<Value>(&json) {
            articles.push(article);
        }
    }
    let geo = geoevents::from_articles(&articles);
    Ok(HistorySnapshot {
        start_epoch,
        end_epoch,
        bucket_seconds: step,
        selected_index,
        total_count,
        selected_count,
        buckets: counts
            .into_iter()
            .enumerate()
            .map(|(index, count)| HistoryBucket {
                start_epoch: start_epoch + index as i64 * step,
                count,
            })
            .collect(),
        articles,
        geo,
    })
}

pub fn snapshot(
    app: &AppHandle,
    start_epoch: i64,
    end_epoch: i64,
    bucket_count: usize,
    selected_index: usize,
    country_code: Option<String>,
) -> Result<HistorySnapshot, String> {
    let conn = database::open(app).map_err(|_| "History index unavailable")?;
    query(
        &conn,
        start_epoch,
        end_epoch,
        bucket_count,
        selected_index,
        country_code.as_deref(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../migrations/0002_news_intelligence.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../../migrations/0003_reporting_history.sql"))
            .unwrap();
        conn
    }

    #[test]
    fn separates_country_relevance_from_verified_city_evidence() {
        let conn = test_db();
        let start = 1_780_000_000;
        for (when, url, country, city) in [
            (start + 200, "https://example.org/a", "BH", false),
            (start + 2_400, "https://example.org/b", "BH", true),
            (start + 5_400, "https://example.org/c", "EG", false),
        ] {
            let location = if city {
                json!({"precision":"city","countryCode":"BH","cityName":"Manama",
                       "latitude":26.2,"longitude":50.6,"evidence":"publisher"})
            } else {
                json!({"precision":"unknown"})
            };
            let payload = json!({"id":url,"url":url,"title":url,"sourceId":"test",
              "sourceName":"Test","publishedAt":"2026-05-28T00:00:00Z",
              "countryCodes":[country],"location":location});
            conn.execute(
                "INSERT INTO news_articles (canonical_url,payload_json,title,source_id,
                 category,cluster_id,published_epoch,first_seen,last_seen)
                 VALUES (?1,?2,?3,'test','general','',?4,?4,?4)",
                params![url, payload.to_string(), url, when],
            )
            .unwrap();
        }
        let all = query(&conn, start, start + DAY_SECONDS, 24, 0, None).unwrap();
        assert_eq!(all.total_count, 3);
        assert_eq!(all.buckets[0].count, 2);
        assert_eq!(all.geo.markers.len(), 1);
        let bh = query(&conn, start, start + DAY_SECONDS, 24, 0, Some("BH")).unwrap();
        assert_eq!(bh.total_count, 2);
        assert_eq!(bh.selected_count, 2);
        assert_eq!(bh.geo.markers[0].city_name, "Manama");
        let eg = query(&conn, start, start + DAY_SECONDS, 24, 1, Some("EG")).unwrap();
        assert_eq!(eg.total_count, 1);
        assert!(eg.geo.markers.is_empty());
    }

    #[test]
    fn rejects_unbounded_queries_and_unknown_country_codes() {
        let conn = test_db();
        assert!(query(&conn, 0, 0, 24, 0, None).is_err());
        assert!(query(&conn, 0, DAY_SECONDS, 24, 24, None).is_err());
        assert!(query(&conn, 0, DAY_SECONDS, 24, 0, Some("US")).is_err());
        assert!(query(&conn, 0, 8 * DAY_SECONDS, 28, 0, None).is_err());
    }
}
