-- Store UTC publication timestamps; discovery time remains first_seen.
-- Undated RSS entries are deliberately excluded from chronological history.
ALTER TABLE news_articles ADD COLUMN published_epoch INTEGER;
UPDATE news_articles
SET published_epoch = CAST(strftime('%s', published_at) AS INTEGER)
WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS news_articles_epoch ON news_articles(published_epoch DESC);
