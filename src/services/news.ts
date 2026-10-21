import { invoke, isTauri } from '@tauri-apps/api/core';
import type { NewsFeedResponse } from '../features/news/contracts';

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
