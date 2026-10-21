mod commands;
mod database;
mod models;
mod services;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            database::initialize(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_status,
            commands::get_news_feed,
            commands::search_cached_news,
            commands::get_geo_snapshot,
            commands::open_article
        ])
        .run(tauri::generate_context!())
        .expect("failed to launch SIGNAL");
}
