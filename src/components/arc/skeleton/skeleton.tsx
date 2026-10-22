import type { ReactNode } from 'react';
import './skeleton.css';

interface SkeletonProps {
  label?: string;
  lines?: number;
  className?: string;
  children?: ReactNode;
  loading?: boolean;
}

/** Arc-style list placeholder; no extra ResizeObservers for long live feeds. */
export function Skeleton({
  label = 'Loading content',
  lines = 3,
  className,
  children,
  loading = true,
}: SkeletonProps) {
  return (
    <div className={['signal-arc-skeleton', className].filter(Boolean).join(' ')} aria-busy={loading}>
      {loading ? (
        <div className="signal-arc-skeleton__lines" role="status" aria-label={label}>
          {Array.from({ length: Math.min(6, Math.max(1, lines)) }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
