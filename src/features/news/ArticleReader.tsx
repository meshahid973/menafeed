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
  return (
    <article className="signal-reader">
      <button className="signal-reader__back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to stories
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
            Read original <span aria-hidden="true">↗</span>
          </button>
          <button className="signal-reader__save" type="button" onClick={onToggleSave}>
            {saved ? 'Remove saved' : 'Save story'}
          </button>
        </div>
        <p className="signal-reader__note">
          Source content belongs to its publisher. Story location has not been verified.
        </p>
      </div>
    </article>
  );
}
