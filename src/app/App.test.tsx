import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../services/desktop', () => ({
  readDesktopStatus: vi.fn(),
}));

vi.mock('../services/news', () => ({
  getNewsFeed: vi.fn(),
  openArticle: vi.fn(),
}));

import { readDesktopStatus } from '../services/desktop';

describe('desktop layout', () => {
  beforeEach(() => {
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'preview' });
  });

  it('shows the editorial feed and reserved map slot', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'The Briefing.' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Regional map area' })).toBeInTheDocument();
    expect(await screen.findByText('BROWSER PREVIEW')).toBeInTheDocument();
  });
});
