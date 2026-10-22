import { useCallback, useEffect, useRef, useState } from 'react';
import type { NewsFeedResponse } from './contracts';
import { getNewsFeed } from '../../services/news';

export function useNewsFeed(enabled: boolean) {
  const [data, setData] = useState<NewsFeedResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const hasLoaded = useRef(false);
  const pending = useRef<Promise<void> | null>(null);

  const refresh = useCallback((force: boolean): Promise<void> => {
    if (!active.current) return Promise.resolve();
    // A poll and a manual refresh share one in-flight native request.
    if (pending.current) return pending.current;
    const job = (async () => {
      setError(null);
      if (force) setRefreshing(true);
      else if (!hasLoaded.current) setLoading(true);

      try {
        const result = await getNewsFeed(force);
        // A response completed while Saved or unmounted must not update the feed.
        // If the user has already returned, the pending response is still usable.
        if (!active.current) return;
        hasLoaded.current = true;
        setData(result);
        if (
          result.sources.length &&
          result.sources.every((source) => source.mode === 'unavailable')
        ) {
          setError('Sources are currently unavailable. Try again later.');
        }
      } catch {
        if (active.current) setError('Could not reach the news service.');
      } finally {
        if (active.current) {
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
    active.current = enabled;
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return () => {
        active.current = false;
      };
    }

    void refresh(false);
    // Pause polling outside the live newsroom and while the window is hidden.
    const poll = () => {
      if (!document.hidden) void refresh(false);
    };
    const timer = window.setInterval(poll, 60_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      active.current = false;
    };
  }, [enabled, refresh]);

  return { data, error, loading, refreshing, refresh };
}
