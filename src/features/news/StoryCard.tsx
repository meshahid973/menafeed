import { Bookmark } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { FeedArticle } from './contracts';

interface Props {
  article: FeedArticle;
  featured?: boolean;
  animateNew?: boolean;
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

export function StoryCard({
  article,
  featured = false,
  animateNew = false,
  saved,
  onSelect,
  onToggleSave,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.article
      className={`signal-story${featured ? ' signal-story--featured' : ''}`}
      data-new-report={animateNew || undefined}
      initial={animateNew && !reduced ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
    >
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
        <Bookmark
          size={18}
          aria-hidden="true"
          fill={saved ? 'currentColor' : 'none'}
          strokeWidth={1.8}
        />
      </button>
    </motion.article>
  );
}
