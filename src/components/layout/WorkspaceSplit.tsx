import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, KeyboardEvent, ReactNode, CSSProperties } from 'react';
import { GripVertical } from 'lucide-react';
import './WorkspaceSplit.css';

const KEY = 'signal:feed-width';
const DEFAULT = 36;
const MIN_PANEL = 280;

function initialWidth() {
  try {
    const value = Number(window.localStorage.getItem(KEY));
    return value >= 25 && value <= 75 ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function clamp(value: number, width: number): number {
  if (!Number.isFinite(value) || width <= 0) return DEFAULT;
  const minimum = Math.min(50, (MIN_PANEL / width) * 100);
  return Math.round(Math.max(minimum, Math.min(100 - minimum, value)) * 100) / 100;
}

/** Owns only the resizable boundary, never the map or newsroom state. */
export function WorkspaceSplit({ map, feed }: { map: ReactNode; feed: ReactNode }) {
  const [feedWidth, setFeedWidth] = useState(initialWidth);
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, String(feedWidth));
    } catch {
      /* storage optional */
    }
  }, [feedWidth]);

  function widthFromPointer(clientX: number): number {
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return feedWidth;
    return clamp(100 - ((clientX - rect.left) / rect.width) * 100, rect.width);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId) return;
    setFeedWidth(widthFromPointer(event.clientX));
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const width = container.current?.getBoundingClientRect().width ?? 0;
    const delta = event.shiftKey ? 10 : 2;
    const next =
      event.key === 'ArrowLeft'
        ? feedWidth + delta
        : event.key === 'ArrowRight'
          ? feedWidth - delta
          : event.key === 'Home'
            ? 75
            : event.key === 'End'
              ? 25
              : null;
    if (next === null) return;
    event.preventDefault();
    setFeedWidth(clamp(next, width));
  }

  return (
    <div
      ref={container}
      className="signal-split"
      style={{ '--signal-feed-width': `${feedWidth}%` } as CSSProperties}
    >
      <main className="signal-split__map" aria-label="Map workspace">
        {map}
      </main>
      <div
        className="signal-split__handle"
        role="separator"
        aria-label="Resize map and news panels"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(feedWidth)}
        tabIndex={0}
        title="Drag to resize · Arrow keys to adjust"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragging.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={() => {
          dragging.current = null;
        }}
        onKeyDown={handleKey}
      >
        <GripVertical size={16} aria-hidden="true" />
      </div>
      <section className="signal-split__feed" aria-label="Regional news">
        {feed}
      </section>
    </div>
  );
}
