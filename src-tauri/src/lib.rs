mod commands;
mod database;
mod models;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Keep all filesystem and SQLite access inside Rust.
            database::initialize(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::get_app_status])
        .run(tauri::generate_context!())
        .expect("failed to launch SIGNAL");
}
