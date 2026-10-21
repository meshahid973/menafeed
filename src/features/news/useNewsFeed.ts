import { useCallback, useEffect, useRef, useState } from 'react';
import type { NewsFeedResponse } from './contracts';
import { getNewsFeed } from '../../services/news';

export function useNewsFeed(enabled: boolean) {
  const [data, setData] = useState<NewsFeedResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);
  const pending = useRef<Promise<void> | null>(null);

  const refresh = useCallback((force: boolean): Promise<void> => {
    // A poll must never overlap a manual refresh or another poll.
    if (pending.current) return pending.current;
    const job = (async () => {
      const current = ++requestId.current;
      setError(null);
      if (force) setRefreshing(true);
      else if (!hasLoaded.current) setLoading(true);

      try {
        const result = await getNewsFeed(force);
        if (current !== requestId.current) return;
        hasLoaded.current = true;
        setData(result);
        if (result.sources.length && result.sources.every((source) => source.mode === 'unavailable')) {
          setError('Sources are currently unavailable. Try again later.');
        }
      } catch {
        if (current === requestId.current) setError('Could not reach the news service.');
      } finally {
        if (current === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    pending.current = job;
    void job.finally(() => {
      if (pending.current === job) pending.current = null;
    });
    return job;
  }, []);

  useEffect(() => {
    if (enabled) {
      void refresh(false);
      // Refresh while visible; Rust enforces each provider's cache interval.
      const poll = () => {
        if (!document.hidden) void refresh(false);
      };
      const timer = window.setInterval(poll, 60_000);
      document.addEventListener('visibilitychange', poll);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', poll);
        requestId.current += 1;
      };
    } else {
      setLoading(false);
      setRefreshing(false);
    }
    return () => {
      requestId.current += 1;
    };
  }, [enabled, refresh]);

  return { data, error, loading, refreshing, refresh };
}
