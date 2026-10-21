import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsFeed } from './NewsFeed';
import { getNewsFeed, openArticle } from '../../services/news';
import { useNewsFeed } from './useNewsFeed';
import type { ComponentProps } from 'react';
import type { NewsFeedResponse } from './contracts';

vi.mock('../../services/news', () => ({ getNewsFeed: vi.fn(), openArticle: vi.fn() }));

const sample: NewsFeedResponse = {
  receivedAt: '2026-10-21T12:00:00Z',
  sources: [
    { id: 'bbc', name: 'BBC Middle East', mode: 'fresh', count: 2 },
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
      id: 'duplicated',
      sourceId: 'bbc',
      sourceName: 'BBC Middle East',
      title: 'Regional energy talks',
      url: 'https://www.bbc.com/news/example-2',
      publishedAt: '2026-10-21T10:15:00Z',
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

function FeedHarness({ desktopStatus, ...props }: Omit<ComponentProps<typeof NewsFeed>, 'feed'>) {
  const feed = useNewsFeed(desktopStatus.kind === 'ready' && props.view !== 'saved');
  return <NewsFeed desktopStatus={desktopStatus} {...props} feed={feed} />;
}

describe('news desk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNewsFeed).mockResolvedValue(sample);
    vi.mocked(openArticle).mockResolvedValue();
  });

  it('fetches, filters by publisher and removes identical source headlines', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    expect(screen.getAllByText('Regional energy talks')).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Publisher' }), {
      target: { value: 'france24' },
    });
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();
    expect(screen.getByText('Cultural event announced')).toBeInTheDocument();
  });

  it('opens a story reader and original report', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Regional energy talks'));
    expect(screen.getByRole('heading', { name: 'Regional energy talks' })).toBeInTheDocument();
    expect(screen.getByText('A brief summary about energy.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Read original/ }));
    await waitFor(() =>
      expect(openArticle).toHaveBeenCalledWith('https://www.bbc.com/news/example'),
    );
  });

  it('searches from the shortcut and filters headlines', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '/' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search headlines' }), {
      target: { value: 'cultural' },
    });
    await waitFor(() =>
      expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Cultural event announced')).toBeInTheDocument();
  });

  it('shows saved stories without fetching native RSS', () => {
    const story = sample.articles[0]!;
    render(<FeedHarness desktopStatus={{ kind: 'preview' }} view="saved" bookmarks={[story]} />);
    expect(getNewsFeed).not.toHaveBeenCalled();
    expect(screen.getByText('Regional energy talks')).toBeInTheDocument();
  });
  it('does not infer a country from an unlocated RSS headline', async () => {
    render(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="BH" />,
    );
    await waitFor(() =>
      expect(screen.getByText(/No location-verified reports/)).toBeInTheDocument(),
    );
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();
  });

  it('offers a retry after a failed source request', async () => {
    vi.mocked(getNewsFeed).mockRejectedValueOnce(new Error('network'));
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Could not reach the news service.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getNewsFeed).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
  });

  it('moves keyboard focus between reports with arrow keys', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    const first = (await screen.findByText('Regional energy talks')).closest('button')!;
    const second = screen.getByText('Cultural event announced').closest('button')!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
  });
});
