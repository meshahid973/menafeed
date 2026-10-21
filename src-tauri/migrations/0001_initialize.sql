-- The Rust backend owns these tables. Frontend code must not execute SQL.
-- This minimal schema avoids coupling news provider payloads to storage.

CREATE TABLE IF NOT EXISTS cache_entries (
  provider TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (provider, cache_key),
  CHECK (expires_at >= fetched_at)
);

CREATE INDEX IF NOT EXISTS cache_entries_expires_at
  ON cache_entries (expires_at);

CREATE TABLE IF NOT EXISTS bookmarks (
  article_url TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL
);
