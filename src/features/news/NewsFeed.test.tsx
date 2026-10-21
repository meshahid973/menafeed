import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsFeed } from './NewsFeed';
import { getNewsFeed, openArticle } from '../../services/news';
import type { NewsFeedResponse } from './contracts';

vi.mock('../../services/news', () => ({
  getNewsFeed: vi.fn(),
  openArticle: vi.fn(),
}));

const sample: NewsFeedResponse = {
  receivedAt: '2026-10-21T12:00:00Z',
  sources: [
    { id: 'bbc', name: 'BBC Middle East', mode: 'fresh', count: 1 },
    { id: 'france24', name: 'France 24', mode: 'cached', count: 1 },
  ],
  articles: [
    {
      id: 'one',
      sourceId: 'bbc',
      sourceName: 'BBC Middle East',
      title: 'Regional energy talks',
      url: 'https://www.bbc.com/news/example',
      summary: 'A brief summary about energy.',
      publishedAt: '2026-10-21T11:00:00Z',
      location: { precision: 'unknown' },
    },
    {
      id: 'two',
      sourceId: 'france24',
      sourceName: 'France 24',
      title: 'Cultural event announced',
      url: 'https://www.france24.com/en/example',
      publishedAt: '2026-10-21T10:00:00Z',
      location: { precision: 'unknown' },
    },
  ],
};

describe('editorial feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNewsFeed).mockResolvedValue(sample);
    vi.mocked(openArticle).mockResolvedValue();
  });

  it('loads actual feed contract data and filters by publisher', async () => {
    render(<NewsFeed desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    expect(screen.getByText('Cultural event announced')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'France 24' }));
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();
    expect(screen.getByText('Cultural event announced')).toBeInTheDocument();
  });

  it('searches headlines, expands a report, and opens the publisher', async () => {
    render(<NewsFeed desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search headlines' }), {
      target: { value: 'energy' },
    });
    expect(screen.queryByText('Cultural event announced')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Regional energy talks/ }));
    expect(screen.getByText('A brief summary about energy.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /READ ORIGINAL/ }));
    expect(openArticle).toHaveBeenCalledWith('https://www.bbc.com/news/example');
  });

  it('does not fetch native feeds from the browser preview', () => {
    render(<NewsFeed desktopStatus={{ kind: 'preview' }} />);
    expect(getNewsFeed).not.toHaveBeenCalled();
    expect(screen.getByText(/Launch the Tauri desktop application/)).toBeInTheDocument();
  });
});
