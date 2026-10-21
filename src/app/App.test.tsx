import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../services/desktop', () => ({ readDesktopStatus: vi.fn() }));
vi.mock('../services/news', () => ({ getNewsFeed: vi.fn(), openArticle: vi.fn() }));

import { readDesktopStatus } from '../services/desktop';

describe('workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'preview' });
  });

  it('starts with collapsed OLED navigation and the map slot', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Regional map area' })).toBeInTheDocument();
    expect(await screen.findByText('Open the desktop app to read live RSS.')).toBeInTheDocument();
  });

  it('expands with Ctrl+B, navigates and remembers the setting', () => {
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
});
