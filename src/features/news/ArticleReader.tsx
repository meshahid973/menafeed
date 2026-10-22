import { useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { PreviewCard } from '@base-ui/react/preview-card';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, Copy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { FeedArticle, FeedSourceState } from './contracts';
import { storyDate } from './StoryCard';

interface Props {
  article: FeedArticle;
  saved: boolean;
  relatedArticles?: FeedArticle[];
  source?: FeedSourceState;
  onBack: () => void;
  onOpen: (url: string) => void;
  onToggleSave: () => void;
  onRelatedSelect?: (article: FeedArticle) => void;
}

export function ArticleReader({
  article, saved, relatedArticles = [], source, onBack, onOpen, onToggleSave, onRelatedSelect,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const [copied, setCopied] = useState<'idle' | 'yes' | 'error'>('idle');
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(article.url);
      setCopied('yes');
    } catch {
      setCopied('error');
    }
  }
  const excerpt = (
    <p className="signal-reader__excerpt">
      {article.summary || 'No RSS excerpt is available. Open the publisher for the full report.'}
    </p>
  );

  return (
    <motion.article
      className="signal-reader"
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.19, ease: 'easeOut' }}
    >
      <button className="signal-reader__back" type="button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to stories
      </button>
      <div className="signal-reader__body">
        <div className="signal-reader__meta">
          <PreviewCard.Root>
            <PreviewCard.Trigger
              className="signal-reader__publisher"
              href={article.url}
              onClick={(event) => { event.preventDefault(); onOpen(article.url); }}
            >
              {article.sourceName}
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner sideOffset={8} collisionPadding={12}>
                <PreviewCard.Popup className="signal-reader__publisher-popup">
                  <strong>{article.sourceName}</strong>
                  <span>Publisher of this report</span>
                  {source && (
                    <span>
                      {source.count} {source.count === 1 ? 'report' : 'reports'} in this feed
                    </span>
                  )}
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
          <span>{storyDate(article.publishedAt)}</span>
        </div>
        <h3>{article.title}</h3>
        {relatedArticles.length > 0 ? (
          <Tabs.Root defaultValue="report" className="signal-reader__tabs">
            <Tabs.List className="signal-reader__tab-list">
              <Tabs.Tab className="signal-reader__tab" value="report">Report</Tabs.Tab>
              <Tabs.Tab className="signal-reader__tab" value="coverage">
                Related coverage <span>{relatedArticles.length}</span>
              </Tabs.Tab>
              <Tabs.Indicator className="signal-reader__tab-indicator" />
            </Tabs.List>
            <Tabs.Panel value="report" className="signal-reader__tab-panel">{excerpt}</Tabs.Panel>
            <Tabs.Panel value="coverage" className="signal-reader__tab-panel">
              <div className="signal-reader__related">
                {relatedArticles.map((related) => (
                  <button
                    key={related.canonicalUrl ?? related.url}
                    type="button"
                    className="signal-reader__related-item"
                    onClick={() => onRelatedSelect?.(related)}
                  >
                    <span>{related.sourceName} · {storyDate(related.publishedAt)}</span>
                    <strong>{related.title}</strong>
                  </button>
                ))}
              </div>
            </Tabs.Panel>
          </Tabs.Root>
        ) : excerpt}
        <div className="signal-reader__actions">
          <button className="signal-reader__open" type="button" onClick={() => onOpen(article.url)}>
            Read original <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button className="signal-reader__save" type="button" onClick={onToggleSave}>
            <Bookmark size={16} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Remove saved' : 'Save story'}
          </button>
          <button className="signal-reader__copy" type="button" onClick={() => void copyLink()}>
            {copied === 'yes' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied === 'yes' ? 'Copied' : copied === 'error' ? 'Copy unavailable' : 'Copy link'}
          </button>
        </div>
        <p className="signal-reader__note">
          This is an RSS excerpt. Read the full report on the publisher’s site.
        </p>
      </div>
    </motion.article>
  );
}
