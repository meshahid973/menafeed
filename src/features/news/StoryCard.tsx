import type { FeedArticle } from './contracts';

interface Props {
  article: FeedArticle;
  featured?: boolean;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}

export function storyDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function StoryCard({ article, featured = false, saved, onSelect, onToggleSave }: Props) {
  return (
    <article className={`signal-story${featured ? ' signal-story--featured' : ''}`}>
      <button type="button" className="signal-story__headline" onClick={onSelect}>
        <span className="signal-story__meta">
          <span>{article.sourceName}</span>
          <time dateTime={article.publishedAt ?? undefined}>{storyDate(article.publishedAt)}</time>
        </span>
        <span className="signal-story__title">{article.title}</span>
        {featured && article.summary && (
          <span className="signal-story__summary">{article.summary}</span>
        )}
      </button>
      <button
        type="button"
        className={`signal-story__save${saved ? ' signal-story__save--active' : ''}`}
        onClick={onToggleSave}
        aria-label={saved ? `Remove saved story: ${article.title}` : `Save story: ${article.title}`}
        aria-pressed={saved}
        title={saved ? 'Remove from Saved' : 'Save story'}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="M6 3.5h12V21l-6-4-6 4z" />
        </svg>
      </button>
    </article>
  );
}
