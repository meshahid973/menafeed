use reqwest::{Client, Url};
use serde::Deserialize;

use super::sources::{country_codes_from_text, is_mena_relevant};

const MAX_API_BYTES: usize = 1_000_000;

#[derive(Deserialize)]
struct ApiResponse {
    data: Vec<ApiItem>,
}

#[derive(Deserialize)]
struct ApiItem {
    fields: ApiFields,
}

#[derive(Deserialize)]
struct ApiFields {
    title: Option<String>,
    url: Option<String>,
    date: Option<ApiDate>,
    country: Option<Vec<ApiCountry>>,
}

#[derive(Deserialize)]
struct ApiDate {
    created: Option<String>,
}

#[derive(Deserialize)]
struct ApiCountry {
    name: Option<String>,
}

pub struct Report {
    pub title: String,
    pub url: String,
    pub published_at: Option<String>,
    pub country_codes: Vec<String>,
}

fn parse_reports(bytes: &[u8]) -> Result<Vec<Report>, String> {
    let parsed: ApiResponse =
        serde_json::from_slice(bytes).map_err(|_| "Invalid ReliefWeb response".to_string())?;
    let mut reports = Vec::new();
    for item in parsed.data {
        let fields = item.fields;
        let (Some(title), Some(url)) = (fields.title, fields.url) else {
            continue;
        };
        let regions = fields
            .country
            .unwrap_or_default()
            .into_iter()
            .filter_map(|c| c.name)
            .collect::<Vec<_>>()
            .join(" ");
        let country_codes = country_codes_from_text(&format!("{title} {regions}"));
        if !is_mena_relevant(&format!("{title} {regions}")) {
            continue;
        }
        let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
        if title.is_empty() {
            continue;
        }
        reports.push(Report {
            title: title.chars().take(170).collect(),
            url,
            published_at: fields.date.and_then(|d| d.created),
            country_codes,
        });
    }
    reports.truncate(24);
    Ok(reports)
}

pub async fn fetch_reports(client: &Client, appname: &str) -> Result<Vec<Report>, String> {
    if !(3..=96).contains(&appname.len())
        || !appname
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
    {
        return Err("ReliefWeb app identity not configured".into());
    }
    let mut url = Url::parse("https://api.reliefweb.int/v2/reports")
        .map_err(|_| "Invalid ReliefWeb endpoint")?;
    url.query_pairs_mut()
        .append_pair("appname", appname)
        .append_pair("preset", "latest")
        .append_pair("limit", "40")
        .append_pair("fields[include][]", "url")
        .append_pair("fields[include][]", "title")
        .append_pair("fields[include][]", "date.created")
        .append_pair("fields[include][]", "country.name");
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "ReliefWeb unavailable")?
        .error_for_status()
        .map_err(|_| "ReliefWeb rejected the request")?;
    if response.url().scheme() != "https" || response.url().host_str() != Some("api.reliefweb.int")
    {
        return Err("Unexpected ReliefWeb origin".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "ReliefWeb request failed")?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_API_BYTES {
            return Err("ReliefWeb response too large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    parse_reports(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_mena_tagged_reports() {
        let fixture = br#"{"data":[
          {"fields":{"title":"Flood response in Sudan","url":"https://reliefweb.int/report/sudan/example","date":{"created":"2026-10-21T09:00:00Z"},"country":[{"name":"Sudan"}]}},
          {"fields":{"title":"Storm in the Caribbean","url":"https://reliefweb.int/report/example","country":[{"name":"Barbados"}]}}
        ]}"#;
        let reports = parse_reports(fixture).unwrap();
        assert_eq!(reports.len(), 1);
        assert_eq!(reports[0].title, "Flood response in Sudan");
        assert!(reports[0].country_codes.contains(&"SD".to_string()));
        assert!(reports[0].published_at.is_some());
    }
}
