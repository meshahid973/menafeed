use rusqlite::Connection;
use std::{error::Error, fs};

use tauri::Manager;

const SCHEMA_VERSION: i64 = 1;

pub fn initialize(app: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    let directory = app.path().app_local_data_dir()?;
    fs::create_dir_all(&directory)?;

    let mut connection = Connection::open(directory.join("signal.sqlite3"))?;
    connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    migrate(&mut connection)?;

    Ok(())
}

fn migrate(connection: &mut Connection) -> rusqlite::Result<()> {
    let version: i64 =
        connection.pragma_query_value(None, "user_version", |row| row.get(0))?;

    if version > SCHEMA_VERSION {
        return Err(rusqlite::Error::InvalidQuery);
    }

    if version < 1 {
        let transaction = connection.transaction()?;
        transaction.execute_batch(include_str!("../../migrations/0001_initialize.sql"))?;
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_schema_and_can_run_twice() {
        let mut db = Connection::open_in_memory().expect("in-memory SQLite");
        migrate(&mut db).expect("first migration");
        migrate(&mut db).expect("second migration");

        let version: i64 = db
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("schema version");
        assert_eq!(version, SCHEMA_VERSION);

        let count: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('cache_entries', 'bookmarks')",
                [],
                |row| row.get(0),
            )
            .expect("table count");
        assert_eq!(count, 2);
    }

    #[test]
    fn refuses_a_newer_schema_instead_of_downgrading_it() {
        let mut db = Connection::open_in_memory().expect("in-memory SQLite");
        db.pragma_update(None, "user_version", 99)
            .expect("set schema version");
        assert!(migrate(&mut db).is_err());
    }
}
