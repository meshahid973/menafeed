use crate::{
    models::AppStatus,
    services::{geoevents, intelligence, news},
};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_app_status() -> AppStatus {
    AppStatus {
        app_name: "SIGNAL",
        schema_version: 1,
    }
}

#[tauri::command]
pub async fn get_news_feed(
    app: tauri::AppHandle,
    force: bool,
) -> Result<serde_json::Value, String> {
    let mut response = serde_json::to_value(news::load(app.clone(), force).await?)
        .map_err(|_| "Could not encode news response")?;
    intelligence::restore_offline(&app, &mut response);
    intelligence::process(&app, &mut response);
    Ok(response)
}

#[tauri::command]
pub fn search_cached_news(
    app: tauri::AppHandle,
    query: String,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    intelligence::search_cached(&app, &query, limit)
}

#[tauri::command]
pub fn get_geo_snapshot(app: tauri::AppHandle) -> Result<geoevents::GeoSnapshot, String> {
    geoevents::snapshot(&app)
}

#[tauri::command]
pub fn open_article(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let safe = news::safe_article_url(&url)?;
    app.opener()
        .open_url(safe.as_str(), None::<&str>)
        .map_err(|_| "Could not open article".to_string())
}
