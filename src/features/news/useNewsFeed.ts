import { useCallback, useEffect, useRef, useState } from 'react';
import type { NewsFeedResponse } from './contracts';
import { getNewsFeed } from '../../services/news';

export function useNewsFeed(enabled: boolean) {
  const [data, setData] = useState<NewsFeedResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (force: boolean) => {
    const current = ++requestId.current;
    setError(null);
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getNewsFeed(force);
      if (current !== requestId.current) return;
      setData(result);
      if (result.sources.length && result.sources.every((s) => s.mode === 'unavailable')) {
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
  }, []);

  useEffect(() => {
    if (enabled) void refresh(false);
    else {
      setLoading(false);
      setRefreshing(false);
    }
    return () => { requestId.current += 1; };
  }, [enabled, refresh]);

  return { data, error, loading, refreshing, refresh };
}
