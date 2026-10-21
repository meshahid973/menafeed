use crate::models::AppStatus;

#[tauri::command]
pub fn get_app_status() -> AppStatus {
    // The app cannot reach this command until the startup database setup completes.
    AppStatus {
        app_name: "SIGNAL",
        schema_version: 1,
    }
}
