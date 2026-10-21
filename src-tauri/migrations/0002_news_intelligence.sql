CREATE TABLE IF NOT EXISTS news_articles (
  canonical_url TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_id TEXT NOT NULL,
  category TEXT NOT NULL,
  cluster_id TEXT NOT NULL,
  published_at TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS news_articles_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_cluster ON news_articles(cluster_id);
CREATE INDEX IF NOT EXISTS news_articles_category ON news_articles(category);

CREATE VIRTUAL TABLE IF NOT EXISTS news_articles_fts
  USING fts5(title, summary, content='news_articles', content_rowid='rowid', tokenize='unicode61');

CREATE TRIGGER IF NOT EXISTS news_articles_ai AFTER INSERT ON news_articles BEGIN
  INSERT INTO news_articles_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, new.summary);
END;
CREATE TRIGGER IF NOT EXISTS news_articles_ad AFTER DELETE ON news_articles BEGIN
  INSERT INTO news_articles_fts(news_articles_fts, rowid, title, summary)
  VALUES ('delete', old.rowid, old.title, old.summary);
END;
CREATE TRIGGER IF NOT EXISTS news_articles_au AFTER UPDATE ON news_articles BEGIN
  INSERT INTO news_articles_fts(news_articles_fts, rowid, title, summary)
  VALUES ('delete', old.rowid, old.title, old.summary);
  INSERT INTO news_articles_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, new.summary);
END;
