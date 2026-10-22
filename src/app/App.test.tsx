import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../services/desktop', () => ({ readDesktopStatus: vi.fn() }));
vi.mock('../services/news', () => ({ getNewsFeed: vi.fn(), openArticle: vi.fn() }));

import { readDesktopStatus } from '../services/desktop';
import { getNewsFeed } from '../services/news';

describe('workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'preview' });
    vi.mocked(getNewsFeed).mockResolvedValue({ articles: [], sources: [], receivedAt: '' });
  });

  it('renders the offline geographic map with collapsed navigation', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    const maps = screen.getAllByRole('region', { name: /Interactive map/ });
    expect(maps.length).toBeGreaterThan(0);
    expect(await screen.findByText('Open the desktop app to read live RSS.')).toBeInTheDocument();
  });

  it('selects a country without inventing geographic news and clears it', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Bahrain' }));
    expect(screen.getByRole('heading', { name: 'Bahrain', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All countries/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All countries/ }));
    expect(screen.getByRole('heading', { name: 'Explore', level: 1 })).toBeInTheDocument();
  });

  it('expands with Ctrl+B and navigates without losing the layout', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'News' }));
    expect(screen.getByRole('heading', { name: 'News', level: 1 })).toBeInTheDocument();
    expect(window.localStorage.getItem('signal:sidebar-expanded')).toBe('true');
  });

  it('opens settings and closes with Escape', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('opens the corresponding story from a verified coordinate marker', async () => {
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'ready', schemaVersion: 1 });
    vi.mocked(getNewsFeed).mockResolvedValue({
      receivedAt: '',
      sources: [],
      articles: [
        {
          id: 'bh-event',
          sourceId: 'src',
          sourceName: 'Publisher',
          title: 'Manama event report',
          publishedAt: null,
          url: 'https://example.org/event',
          location: {
            precision: 'city',
            countryCode: 'BH',
            cityName: 'Manama',
            longitude: 50.5876,
            latitude: 26.2235,
            evidence: 'publisher',
          },
        },
      ],
    });
    render(<App />);
    await waitFor(() =>
      expect(
        within(screen.getByTestId('mena-map')).getByRole('button', {
          name: /Manama event report/,
        }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      within(screen.getByTestId('mena-map')).getByRole('button', { name: /Manama event report/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Manama event report' })).toBeInTheDocument(),
    );
  });

  it('stops native news refreshes in Saved and resumes after navigation', async () => {
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'ready', schemaVersion: 2 });
    render(<App />);
    await screen.findByText('No reports');
    const initialCalls = vi.mocked(getNewsFeed).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Saved', level: 1 })).toBeInTheDocument(),
    );
    const pausedCalls = vi.mocked(getNewsFeed).mock.calls.length;
    expect(pausedCalls).toBe(initialCalls);
    fireEvent(document, new Event('visibilitychange'));
    expect(getNewsFeed).toHaveBeenCalledTimes(pausedCalls);
    fireEvent.click(screen.getByRole('button', { name: 'News' }));
    await waitFor(() => expect(getNewsFeed).toHaveBeenCalledTimes(pausedCalls + 1));
  });
});
