import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsFeed } from './useNewsFeed';
import { getNewsFeed } from '../../services/news';

vi.mock('../../services/news', () => ({ getNewsFeed: vi.fn() }));

const response = { articles: [], sources: [], receivedAt: '2026-10-21T10:00:00Z' };

describe('background news refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not issue overlapping manual and automatic requests', async () => {
    let resolve!: (value: typeof response) => void;
    vi.mocked(getNewsFeed).mockImplementation(
      () =>
        new Promise((finish) => {
          resolve = finish;
        }),
    );
    const { result } = renderHook(() => useNewsFeed(true));
    expect(getNewsFeed).toHaveBeenCalledTimes(1);
    await act(async () => {
      void result.current.refresh(true);
    });
    expect(getNewsFeed).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(response);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('retains cached articles after a network failure', async () => {
    vi.mocked(getNewsFeed)
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.data).toEqual(response));
    await act(async () => {
      await result.current.refresh(true);
    });
    expect(result.current.data).toEqual(response);
    expect(result.current.error).toBe('Could not reach the news service.');
  });
});
