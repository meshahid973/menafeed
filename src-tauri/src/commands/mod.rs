use crate::{models::AppStatus, services::news};
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
) -> Result<news::NewsFeedResponse, String> {
    news::load(app, force).await
}

#[tauri::command]
pub fn open_article(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let safe = news::safe_article_url(&url)?;
    app.opener()
        .open_url(safe.as_str(), None::<&str>)
        .map_err(|_| "Could not open article".to_string())
}
