use std::collections::BTreeMap;

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use crate::database;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CityMarker {
    pub id: String,
    pub country_code: String,
    pub city_name: String,
    pub longitude: f64,
    pub latitude: f64,
    pub article_ids: Vec<String>,
    pub count: usize,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CountryCoverage {
    pub country_code: String,
    pub article_count: usize,
    pub city_count: usize,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GeoSnapshot {
    pub markers: Vec<CityMarker>,
    pub countries: Vec<CountryCoverage>,
}

/// Explicit, attributed locations only. Text mentions are not event coordinates.
pub(crate) fn known_mena_country(code: &str) -> bool {
    matches!(
        code,
        "MA" | "DZ"
            | "EH"
            | "ER"
            | "CY"
            | "TN"
            | "LY"
            | "EG"
            | "SD"
            | "MR"
            | "SA"
            | "OM"
            | "YE"
            | "BH"
            | "QA"
            | "KW"
            | "AE"
            | "PS"
            | "IL"
            | "LB"
            | "SY"
            | "JO"
            | "IQ"
            | "IR"
            | "TR"
            | "DJ"
            | "SO"
    )
}

pub fn from_articles<'a>(articles: impl IntoIterator<Item = &'a Value>) -> GeoSnapshot {
    let mut countries = BTreeMap::<String, (usize, usize)>::new();
    let mut cities = BTreeMap::<(String, String), CityMarker>::new();
    for article in articles {
        let Some(location) = article.get("location") else {
            continue;
        };
        let Some(country) = location.get("countryCode").and_then(Value::as_str) else {
            continue;
        };
        if !known_mena_country(country) {
            continue;
        }
        let precision = location
            .get("precision")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        if precision != "country" && precision != "city" {
            continue;
        }
        let id = article
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.is_empty() {
            continue;
        }
        let stats = countries.entry(country.to_string()).or_default();
        stats.0 += 1;
        if precision != "city" {
            continue;
        }
        let evidence = location
            .get("evidence")
            .and_then(Value::as_str)
            .unwrap_or_default();
        // A geocoded mention can be about a person/place, not where the event occurred.
        if evidence != "publisher" && evidence != "manual-review" {
            continue;
        }
        let Some(lat) = location.get("latitude").and_then(Value::as_f64) else {
            continue;
        };
        let Some(lon) = location.get("longitude").and_then(Value::as_f64) else {
            continue;
        };
        if !lat.is_finite()
            || !lon.is_finite()
            || !(-90.0..=90.0).contains(&lat)
            || !(-180.0..=180.0).contains(&lon)
        {
            continue;
        }
        let Some(city) = location.get("cityName").and_then(Value::as_str) else {
            continue;
        };
        let city = city.trim();
        if city.len() < 2 || city.len() > 100 {
            continue;
        }
        let key = (country.to_string(), city.to_lowercase());
        let marker = cities.entry(key).or_insert_with(|| CityMarker {
            id: format!("{country}:{}", city.to_lowercase()),
            country_code: country.to_string(),
            city_name: city.to_string(),
            longitude: lon,
            latitude: lat,
            article_ids: Vec::new(),
            count: 0,
        });
        if !marker.article_ids.iter().any(|existing| existing == id) {
            marker.article_ids.push(id.to_string());
            marker.count += 1;
        }
    }
    for marker in cities.values() {
        if let Some(stats) = countries.get_mut(&marker.country_code) {
            stats.1 += 1;
        }
    }
    GeoSnapshot {
        markers: cities.into_values().collect(),
        countries: countries
            .into_iter()
            .map(
                |(country_code, (article_count, city_count))| CountryCoverage {
                    country_code,
                    article_count,
                    city_count,
                },
            )
            .collect(),
    }
}

pub fn from_database(conn: &Connection) -> rusqlite::Result<GeoSnapshot> {
    let mut stmt = conn
        .prepare("SELECT payload_json FROM news_articles ORDER BY published_at DESC LIMIT 2000")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let articles: Vec<Value> = rows
        .filter_map(|row| row.ok())
        .filter_map(|item| serde_json::from_str(&item).ok())
        .collect();
    Ok(from_articles(&articles))
}

pub fn snapshot(app: &AppHandle) -> Result<GeoSnapshot, String> {
    let conn = database::open(app).map_err(|_| "Geographic index unavailable")?;
    from_database(&conn).map_err(|_| "Cannot query geographic index".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn maps_only_explicit_event_locations_and_aggregates_countries() {
        let entries = vec![
            json!({"id":"a","location":{"precision":"city","countryCode":"BH","cityName":"Manama","latitude":26.22,"longitude":50.58,"evidence":"publisher"}}),
            json!({"id":"b","location":{"precision":"city","countryCode":"BH","cityName":"Manama","latitude":26.22,"longitude":50.58,"evidence":"manual-review"}}),
            json!({"id":"c","location":{"precision":"country","countryCode":"BH"}}),
            json!({"id":"d","location":{"precision":"city","countryCode":"BH","cityName":"Manama","latitude":26.22,"longitude":50.58,"evidence":"geocoded-mention"}}),
            json!({"id":"e","location":{"precision":"city","countryCode":"EG","cityName":"Cairo","latitude":999.0,"longitude":31.2,"evidence":"publisher"}}),
            json!({"id":"f","location":{"precision":"unknown"}}),
        ];
        let snapshot = from_articles(&entries);
        assert_eq!(snapshot.markers.len(), 1);
        assert_eq!(snapshot.markers[0].count, 2);
        let bh = snapshot
            .countries
            .iter()
            .find(|c| c.country_code == "BH")
            .unwrap();
        assert_eq!(bh.article_count, 4);
        assert_eq!(bh.city_count, 1);
        assert!(!snapshot.countries.iter().any(|c| c.country_code == "US"));
    }

    #[test]
    fn empty_data_has_no_fake_pins() {
        let entries: Vec<Value> = Vec::new();
        assert!(from_articles(&entries).markers.is_empty());
    }
}
