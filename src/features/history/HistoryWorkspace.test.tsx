import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryWorkspace } from './HistoryWorkspace';
import { getReportingHistory } from '../../services/news';
import type { HistorySnapshot } from './contracts';

vi.mock('../../services/news', () => ({
  getReportingHistory: vi.fn(),
  openArticle: vi.fn(),
}));
vi.mock('../../components/layout/MapSlot', () => ({
  MapSlot: () => <div data-testid="archive-map">Map</div>,
}));
vi.mock('../../components/layout/WorkspaceSplit', () => ({
  WorkspaceSplit: ({ map, feed }: { map: React.ReactNode; feed: React.ReactNode }) =>
    <div>{map}{feed}</div>,
}));

const entry = {
  id: 'bh-report', sourceId: 'example', sourceName: 'Publisher',
  title: 'Regional port report', url: 'https://example.org/report',
  publishedAt: '2026-10-22T12:30:00Z',
  location: { precision: 'unknown' as const },
  countryCodes: ['BH'],
};

function response(index: number, count: 24 | 28): HistorySnapshot {
  return {
    startEpoch: 0, endEpoch: 0, bucketSeconds: count === 24 ? 3600 : 21600,
    selectedIndex: index, totalCount: 1, selectedCount: 1,
    articles: [entry], geo: { markers: [], countries: [] },
    buckets: Array.from({ length: count }, (_, slot) => ({ startEpoch: slot * 3600, count: slot === index ? 1 : 0 })),
  };
}

const props = {
  desktopStatus: { kind: 'ready' as const, schemaVersion: 3 },
  country: null,
  onCountrySelect: vi.fn(),
  bookmarks: [],
  onToggleBookmark: vi.fn(),
};

describe('historical reporting workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReportingHistory).mockImplementation(
      async (_start, _end, count, index) => response(index, count),
    );
  });

  it('loads indexed time windows and opens reports', async () => {
    render(<HistoryWorkspace {...props} />);
    await waitFor(() => expect(getReportingHistory).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 24, 23, null,
    ));
    expect(await screen.findByText('Regional port report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Regional port report' }));
    expect(screen.getByRole('heading', { name: 'Regional port report' })).toBeInTheDocument();
    expect(screen.getByTestId('archive-map')).toBeInTheDocument();
  });

  it('uses seven-day six-hour slots and keyboard-accessible scrubber', async () => {
    render(<HistoryWorkspace {...props} />);
    await screen.findByText('Regional port report');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => expect(getReportingHistory).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 28, 27, null,
    ));
    const slider = screen.getByRole('slider', { name: 'Reporting time' });
    fireEvent.change(slider, { target: { value: '6' } });
    await waitFor(() => expect(getReportingHistory).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 28, 6, null,
    ));
  });

  it('filters reporting by the map-selected country without faking location pins', async () => {
    const { rerender } = render(<HistoryWorkspace {...props} />);
    await screen.findByText('Regional port report');
    rerender(<HistoryWorkspace {...props} country="BH" />);
    await waitFor(() => expect(getReportingHistory).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 24, 23, 'BH',
    ));
    expect(screen.getByText('No verified city events in this interval')).toBeInTheDocument();
  });

  it('provides an honest preview-mode empty state', () => {
    render(<HistoryWorkspace {...props} desktopStatus={{ kind: 'preview' }} />);
    expect(screen.getByText(/archive is available in the desktop app/)).toBeInTheDocument();
    expect(getReportingHistory).not.toHaveBeenCalled();
  });
});
