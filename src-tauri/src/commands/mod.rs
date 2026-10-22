use crate::{
    database,
    models::AppStatus,
    services::{geoevents, history, intelligence, news},
};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_app_status() -> AppStatus {
    AppStatus {
        app_name: "SIGNAL",
        schema_version: database::SCHEMA_VERSION,
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
pub async fn get_reporting_history(
    app: tauri::AppHandle,
    start_epoch: i64,
    end_epoch: i64,
    bucket_count: usize,
    selected_index: usize,
    country_code: Option<String>,
) -> Result<history::HistorySnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        history::snapshot(
            &app,
            start_epoch,
            end_epoch,
            bucket_count,
            selected_index,
            country_code,
        )
    })
    .await
    .map_err(|_| "History task failed".to_string())?
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
