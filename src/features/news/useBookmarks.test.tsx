import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBookmarks } from './useBookmarks';

const sample = {
  id: 'one',
  sourceId: 'bbc',
  sourceName: 'BBC',
  title: 'A regional headline',
  url: 'https://example.org/news/1',
  publishedAt: null,
  location: { precision: 'unknown' as const },
};

function BookmarksHarness() {
  const { items, toggle } = useBookmarks();
  return <>
    <div>{items.map((item) => <span key={item.id}>{item.title}</span>)}</div>
    <button type="button" onClick={() => toggle(sample)}>Toggle saved</button>
  </>;
}

describe('saved stories', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists stories and removes them', () => {
    render(<BookmarksHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle saved' }));
    expect(screen.getByText('A regional headline')).toBeInTheDocument();
    expect(window.localStorage.getItem('signal:saved-stories')).toContain('A regional headline');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle saved' }));
    expect(screen.queryByText('A regional headline')).not.toBeInTheDocument();
  });
});
