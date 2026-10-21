import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../services/desktop', () => ({
  readDesktopStatus: vi.fn(),
}));

import { readDesktopStatus } from '../services/desktop';

describe('foundation shell', () => {
  beforeEach(() => {
    vi.mocked(readDesktopStatus).mockResolvedValue({ kind: 'preview' });
  });

  it('displays application identity and browser preview status', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The region.');
    expect(await screen.findByText('BROWSER / PREVIEW MODE')).toBeInTheDocument();
  });
});
