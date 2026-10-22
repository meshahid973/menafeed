import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceSplit } from './WorkspaceSplit';

describe('resizable workspace', () => {
  it('supports keyboard resizing and persists the feed width', () => {
    window.localStorage.removeItem('signal:feed-width');
    const { container } = render(
      <WorkspaceSplit map={<span>Map</span>} feed={<span>News</span>} />,
    );
    const split = container.querySelector('.signal-split')!;
    vi.spyOn(split, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 1200,
      bottom: 600,
      width: 1200,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = screen.getByRole('separator', { name: 'Resize map and news panels' });
    expect(handle).toHaveAttribute('aria-valuenow', '36');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle).toHaveAttribute('aria-valuenow', '38');
    expect(window.localStorage.getItem('signal:feed-width')).toBe('38');
  });

  it('updates the divider during dragging and saves the settled width on release', () => {
    window.localStorage.removeItem('signal:feed-width');
    const { container } = render(
      <WorkspaceSplit map={<span>Map</span>} feed={<span>News</span>} />,
    );
    const split = container.querySelector('.signal-split') as HTMLDivElement;
    vi.spyOn(split, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 1200,
      bottom: 600,
      width: 1200,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = screen.getByRole('separator', { name: 'Resize map and news panels' });
    const setCapture = vi.fn();
    Object.defineProperty(handle, 'setPointerCapture', { value: setCapture });
    Object.defineProperty(handle, 'hasPointerCapture', { value: () => true });
    Object.defineProperty(handle, 'releasePointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 768 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });
    expect(split.style.getPropertyValue('--signal-feed-width')).toBe('50%');
    expect(handle).toHaveAttribute('aria-valuenow', '50');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(window.localStorage.getItem('signal:feed-width')).toBe('50');
  });
});
