import { invoke, isTauri } from '@tauri-apps/api/core';
import type { NewsFeedResponse } from '../features/news/contracts';
import type { HistorySnapshot } from '../features/history/contracts';

export async function getNewsFeed(force = false): Promise<NewsFeedResponse> {
  if (!isTauri()) {
    return { articles: [], sources: [], receivedAt: new Date().toISOString() };
  }

  return invoke<NewsFeedResponse>('get_news_feed', { force });
}

export async function openArticle(url: string): Promise<void> {
  // Only HTTPS URLs should ever reach the OS opener.
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Unsupported article URL');
  }

  if (isTauri()) {
    await invoke('open_article', { url: parsed.toString() });
  } else {
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  }
}

/** SQLite-backed full-text search, including articles from earlier sessions. */
export async function searchCachedNews(query: string, limit = 30) {
  if (!isTauri() || !query.trim()) return [];
  return invoke<import('../features/news/contracts').FeedArticle[]>('search_cached_news', {
    query: query.trim().slice(0, 160),
    limit: Math.max(1, Math.min(50, limit)),
  });
}

/** Only explicit country and event-location evidence appears in this snapshot. */
export async function getGeoSnapshot(): Promise<
  import('../features/news/geographicEvents').GeoSnapshot
> {
  if (!isTauri()) return { markers: [], countries: [] };
  return invoke<import('../features/news/geographicEvents').GeoSnapshot>('get_geo_snapshot');
}

/** UTC history, backed by SQLite; country relevance is not verified geolocation. */
export async function getReportingHistory(
  startEpoch: number,
  endEpoch: number,
  bucketCount: 24 | 28,
  selectedIndex: number,
  countryCode: string | null,
): Promise<HistorySnapshot> {
  if (!isTauri()) throw new Error('History is available in the desktop app.');
  return invoke<HistorySnapshot>('get_reporting_history', {
    startEpoch,
    endEpoch,
    bucketCount,
    selectedIndex,
    countryCode,
  });
}
