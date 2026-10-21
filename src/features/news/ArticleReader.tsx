import { ArrowLeft, ArrowUpRight, Bookmark } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { FeedArticle } from './contracts';
import { storyDate } from './StoryCard';

interface Props {
  article: FeedArticle;
  saved: boolean;
  onBack: () => void;
  onOpen: (url: string) => void;
  onToggleSave: () => void;
}

export function ArticleReader({ article, saved, onBack, onOpen, onToggleSave }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      className="signal-reader"
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.19, ease: 'easeOut' }}
    >
      <button className="signal-reader__back" type="button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to stories
      </button>
      <div className="signal-reader__body">
        <div className="signal-reader__meta">
          <span>{article.sourceName}</span>
          <span>{storyDate(article.publishedAt)}</span>
        </div>
        <h3>{article.title}</h3>
        <p>{article.summary || 'Open the publisher’s website for the complete report.'}</p>
        <div className="signal-reader__actions">
          <button className="signal-reader__open" type="button" onClick={() => onOpen(article.url)}>
            Read original <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button className="signal-reader__save" type="button" onClick={onToggleSave}>
            <Bookmark size={16} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Remove saved' : 'Save story'}
          </button>
        </div>
        <p className="signal-reader__note">
          Source content belongs to its publisher. Story location has not been verified.
        </p>
      </div>
    </motion.article>
  );
}
