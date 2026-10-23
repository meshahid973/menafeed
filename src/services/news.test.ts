import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNewsFeed, getReportingHistory, openArticle } from './news';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
}));

import { invoke, isTauri } from '@tauri-apps/api/core';

describe('news boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not fetch feeds without Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const data = await getNewsFeed();
    expect(data.articles).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('passes refresh requests to Rust', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue({ articles: [], sources: [], receivedAt: '' });
    await getNewsFeed(true);
    expect(invoke).toHaveBeenCalledWith('get_news_feed', { force: true });
  });

  it('passes bounded historical reporting queries to Rust', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue({
      articles: [],
      buckets: [],
      geo: { markers: [], countries: [] },
    });
    await getReportingHistory(1000, 87400, 24, 23, 'BH');
    expect(invoke).toHaveBeenCalledWith('get_reporting_history', {
      startEpoch: 1000,
      endEpoch: 87400,
      bucketCount: 24,
      selectedIndex: 23,
      countryCode: 'BH',
    });
  });

  it('rejects unsafe outbound article URLs', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    await expect(openArticle('javascript:alert(1)')).rejects.toThrow();
    await expect(openArticle('http://example.org')).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
