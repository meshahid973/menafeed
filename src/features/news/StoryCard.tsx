import type { FeedArticle } from './contracts';

interface Props {
  article: FeedArticle;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (url: string) => void;
}

function formatTime(value: string | null) {
  if (!value) return 'TIME UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TIME UNKNOWN';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function StoryCard({ article, index, expanded, onToggle, onOpen }: Props) {
  const detailId = `story-detail-${article.id.replace(/[^\w-]/g, '-').slice(0, 70)}`;

  return (
    <article className={`signal-story${expanded ? ' signal-story--expanded' : ''}`}>
      <button
        className="signal-story__headline"
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="signal-story__meta">
          <span className="signal-story__index">{String(index + 1).padStart(2, '0')}</span>
          <span>{article.sourceName}</span>
          <span className="signal-story__time">{formatTime(article.publishedAt)}</span>
        </span>
        <span className="signal-story__title">{article.title}</span>
        <span className="signal-story__hint">
          {expanded ? 'CLOSE BRIEF' : 'VIEW BRIEF'}{' '}
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </span>
      </button>
      {expanded && (
        <div className="signal-story__detail" id={detailId}>
          <p>{article.summary || 'Read the original report for full details.'}</p>
          <div className="signal-story__detail-footer">
            <span>LOCATION NOT VERIFIED</span>
            <button onClick={() => onOpen(article.url)} type="button">
              READ ORIGINAL <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
