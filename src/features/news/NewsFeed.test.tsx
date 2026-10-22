import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsFeed } from './NewsFeed';
import { getNewsFeed, openArticle, searchCachedNews } from '../../services/news';
import { useNewsFeed } from './useNewsFeed';
import type { ComponentProps } from 'react';
import type { NewsFeedResponse } from './contracts';

vi.mock('../../services/news', () => ({
  getNewsFeed: vi.fn(),
  openArticle: vi.fn(),
  searchCachedNews: vi.fn(),
}));

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
    vi.mocked(searchCachedNews).mockResolvedValue([]);
  });

  it('fetches, filters by publisher and removes identical source headlines', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    expect(await screen.findByText('Regional energy talks')).toBeInTheDocument();
    expect(screen.getAllByText('Regional energy talks')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Filter news' }));
    const publisher = await screen.findByRole('combobox', { name: 'Publisher' });
    fireEvent.click(publisher);
    const option = await screen.findByRole('option', { name: 'France 24' });
    fireEvent.pointerUp(option, { pointerId: 1, pointerType: 'mouse', button: 0 });
    fireEvent.click(option);
    await waitFor(() => expect(screen.getByText('Cultural event announced')).toBeInTheDocument());
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();
  });

  it('can clear the Arc search field without shifting focus', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    await screen.findByText('Regional energy talks');
    fireEvent.click(screen.getByRole('button', { name: 'Search news' }));
    const search = screen.getByRole('searchbox', { name: 'Search headlines' });
    fireEvent.change(search, { target: { value: 'cultural' } });
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
  });

  it('merges SQLite search matches without duplicate articles', async () => {
    vi.mocked(searchCachedNews).mockResolvedValueOnce([
      {
        ...sample.articles[0]!,
        id: 'historical',
        url: 'https://example.org/history',
        title: 'Historic regional agreement',
      },
    ]);
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} />);
    await screen.findByText('Regional energy talks');
    fireEvent.click(screen.getByRole('button', { name: 'Search news' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search headlines' }), {
      target: { value: 'historic' },
    });
    await waitFor(() => expect(searchCachedNews).toHaveBeenCalled());
    expect(await screen.findByText('Historic regional agreement')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText(/No country-related reports/)).toBeInTheDocument());
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();
  });

  it('shows country-relevant stories without pretending a text mention is exact geolocation', async () => {
    const taggedStory = {
      ...sample.articles[0]!,
      title: 'Egyptian aid talks continue after Gaza meeting',
      countryCodes: ['EG', 'PS'],
      location: { precision: 'unknown' as const },
    };
    vi.mocked(getNewsFeed).mockResolvedValueOnce({ ...sample, articles: [taggedStory] });
    const { rerender } = render(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="EG" />,
    );
    expect(
      await screen.findByText('Egyptian aid talks continue after Gaza meeting'),
    ).toBeInTheDocument();

    rerender(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="PS" />,
    );
    expect(
      await screen.findByText('Egyptian aid talks continue after Gaza meeting'),
    ).toBeInTheDocument();

    rerender(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="BH" />,
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Egyptian aid talks continue after Gaza meeting'),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps the selected-country label and articles synchronized across rapid country changes', async () => {
    const countryArticles: NewsFeedResponse['articles'] = [
      {
        ...sample.articles[0]!,
        id: 'egypt-story',
        title: 'Egypt tagged report',
        url: 'https://www.bbc.com/news/egypt-story',
        location: { precision: 'country', countryCode: 'EG' },
      },
      {
        ...sample.articles[0]!,
        id: 'saudi-story',
        title: 'Saudi Arabia tagged report',
        url: 'https://www.bbc.com/news/saudi-story',
        location: { precision: 'country', countryCode: 'SA' },
      },
      {
        ...sample.articles[0]!,
        id: 'morocco-story',
        title: 'Morocco tagged report',
        url: 'https://www.bbc.com/news/morocco-story',
        location: { precision: 'country', countryCode: 'MA' },
      },
      ...sample.articles,
    ];
    vi.mocked(getNewsFeed).mockResolvedValueOnce({ ...sample, articles: countryArticles });

    const { rerender } = render(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="EG" />,
    );

    expect(await screen.findByText('Egypt tagged report')).toBeInTheDocument();
    expect(screen.getByText('Now showing news for Egypt')).toBeInTheDocument();
    expect(screen.queryByText('Saudi Arabia tagged report')).not.toBeInTheDocument();
    expect(screen.queryByText('Morocco tagged report')).not.toBeInTheDocument();
    expect(screen.queryByText('Regional energy talks')).not.toBeInTheDocument();

    rerender(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="SA" />,
    );
    expect(await screen.findByText('Saudi Arabia tagged report')).toBeInTheDocument();
    expect(screen.getByText('Now showing news for Saudi Arabia')).toBeInTheDocument();
    expect(screen.queryByText('Egypt tagged report')).not.toBeInTheDocument();

    rerender(
      <FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 1 }} selectedCountry="MA" />,
    );
    expect(await screen.findByText('Morocco tagged report')).toBeInTheDocument();
    expect(screen.getByText('Now showing news for Morocco')).toBeInTheDocument();
    expect(screen.queryByText('Saudi Arabia tagged report')).not.toBeInTheDocument();
  });

  it('keeps country filtering active in the full News view', async () => {
    vi.mocked(getNewsFeed).mockResolvedValueOnce({
      ...sample,
      articles: [
        {
          ...sample.articles[0]!,
          id: 'egypt-only',
          title: 'Publisher-tagged Egypt report',
          url: 'https://www.bbc.com/news/egypt-only',
          location: { precision: 'country', countryCode: 'EG' },
        },
        sample.articles[0]!,
      ],
    });

    render(
      <FeedHarness
        desktopStatus={{ kind: 'ready', schemaVersion: 1 }}
        view="news"
        selectedCountry="EG"
      />,
    );

    expect(await screen.findByText('Publisher-tagged Egypt report')).toBeInTheDocument();
    expect(screen.getByText('Now showing news for Egypt')).toBeInTheDocument();
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
  it('keeps SQLite multiword results when the words are not adjacent', async () => {
    vi.mocked(searchCachedNews).mockResolvedValueOnce([
      {
        ...sample.articles[0]!,
        id: 'historical-sudan',
        url: 'https://example.org/sudan',
        title: 'Sudan announces new aid distribution',
        summary: 'Regional relief organizations are responding.',
      },
    ]);
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 2 }} view="news" />);
    await screen.findByText('Regional energy talks');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search headlines' }), {
      target: { value: 'Sudan relief' },
    });
    await waitFor(() => expect(searchCachedNews).toHaveBeenCalledWith('sudan relief', 40));
    expect(await screen.findByText('Sudan announces new aid distribution')).toBeInTheDocument();
  });

  it('does not hide Saved stories behind a previous News search', async () => {
    const props = {
      desktopStatus: { kind: 'ready' as const, schemaVersion: 2 },
      bookmarks: [sample.articles[2]!],
    };
    const { rerender } = render(<FeedHarness {...props} view="news" />);
    await screen.findByText('Regional energy talks');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search headlines' }), {
      target: { value: 'energy' },
    });
    await waitFor(() =>
      expect(screen.queryByText('Cultural event announced')).not.toBeInTheDocument(),
    );
    rerender(<FeedHarness {...props} view="saved" />);
    expect(screen.getByText('Cultural event announced')).toBeInTheDocument();
  });

  it('keeps Arc Search Field visible on the full News workspace', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 2 }} view="news" />);
    await screen.findByText('Regional energy talks');
    expect(screen.getByRole('searchbox', { name: 'Search headlines' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Search news' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter news' })).toBeInTheDocument();
  });

  it('animates only newly polled reports, not the initially loaded list', async () => {
    render(<FeedHarness desktopStatus={{ kind: 'ready', schemaVersion: 2 }} view="news" />);
    const original = await screen.findByText('Regional energy talks');
    expect(original.closest('.signal-story')).not.toHaveAttribute('data-new-report');

    const incoming = {
      ...sample.articles[0]!,
      id: 'incoming',
      url: 'https://example.org/new-report',
      title: 'Fresh regional report',
      publishedAt: '2026-10-22T12:00:00Z',
    };
    vi.mocked(getNewsFeed).mockResolvedValue({
      ...sample,
      articles: [incoming, ...sample.articles],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh news' }));
    const latest = await screen.findByText('Fresh regional report');
    await waitFor(() => expect(latest.closest('.signal-story')).toHaveAttribute('data-new-report'));
    expect(original.closest('.signal-story')).not.toHaveAttribute('data-new-report');
  });
});
