import { useEffect, useState } from 'react';
import type { FeedArticle } from './contracts';

const STORAGE_KEY = 'signal:saved-stories';
const MAX_SAVED = 200;

function validArticle(value: unknown): value is FeedArticle {
  if (!value || typeof value !== 'object') return false;
  const article = value as Partial<FeedArticle>;
  if (
    typeof article.title !== 'string' ||
    typeof article.sourceName !== 'string' ||
    typeof article.sourceId !== 'string' ||
    typeof article.url !== 'string' ||
    typeof article.id !== 'string'
  )
    return false;

  try {
    const url = new URL(article.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function readSaved(): FeedArticle[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validArticle)
      .slice(0, MAX_SAVED)
      .map((article) => ({
        id: article.id,
        sourceId: article.sourceId,
        sourceName: article.sourceName,
        title: article.title.slice(0, 250),
        url: article.url,
        publishedAt: typeof article.publishedAt === 'string' ? article.publishedAt : null,
        summary: typeof article.summary === 'string' ? article.summary.slice(0, 500) : undefined,
        location: { precision: 'unknown' as const },
      }));
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [items, setItems] = useState<FeedArticle[]>(readSaved);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Browser storage may be blocked. In-memory saves still work.
    }
  }, [items]);

  function toggle(article: FeedArticle) {
    setItems((current) => {
      if (current.some((saved) => saved.url === article.url)) {
        return current.filter((saved) => saved.url !== article.url);
      }
      return [
        {
          id: article.id,
          sourceId: article.sourceId,
          sourceName: article.sourceName,
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          summary: article.summary,
          location: { precision: 'unknown' },
        },
        ...current,
      ].slice(0, MAX_SAVED);
    });
  }

  return { items, toggle };
}
