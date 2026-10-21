import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceView } from '../../components/layout/workspaceTypes';
import type { DesktopStatus } from '../../services/desktop';
import { openArticle } from '../../services/news';
import { ArticleReader } from './ArticleReader';
import type { FeedArticle } from './contracts';
import { StoryCard } from './StoryCard';
import { useNewsFeed } from './useNewsFeed';
import './NewsFeed.css';

interface Props {
  desktopStatus: DesktopStatus;
  view?: WorkspaceView;
  bookmarks?: FeedArticle[];
  onToggleBookmark?: (article: FeedArticle) => void;
  searchRequest?: number;
}

function deduplicate(articles: FeedArticle[]): FeedArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = `${article.sourceId}:${article.title
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function NewsFeed({
  desktopStatus,
  view = 'explore',
  bookmarks = [],
  onToggleBookmark = () => undefined,
  searchRequest = 0,
}: Props) {
  const enabled = desktopStatus.kind === 'ready' && view !== 'saved';
  const { data, error, loading, refreshing, refresh } = useNewsFeed(enabled);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<FeedArticle | null>(null);
  const [openError, setOpenError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const listRef = useRef<HTMLDivElement>(null);
  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.url)), [bookmarks]);

  useEffect(() => {
    if (!searchRequest) return;
    setSearchOpen(true);
    setSelected(null);
  }, [searchRequest]);

  useEffect(() => {
    if (searchOpen && view !== 'saved') searchRef.current?.focus();
  }, [searchOpen, view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey || view === 'saved')
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      event.preventDefault();
      setSearchOpen(true);
      setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view]);

  useEffect(() => {
    setSelected(null);
    setOpenError(false);
  }, [view]);

  const articles = useMemo(() => {
    const base = view === 'saved' ? bookmarks : (data?.articles ?? []);
    return deduplicate(base).filter((article) => {
      if (view !== 'saved' && source !== 'all' && article.sourceId !== source) return false;
      return (
        !deferredQuery ||
        `${article.title} ${article.summary ?? ''} ${article.sourceName}`
          .toLocaleLowerCase()
          .includes(deferredQuery)
      );
    });
  }, [data, view, bookmarks, source, deferredQuery]);

  async function handleOpen(url: string) {
    try {
      setOpenError(false);
      await openArticle(url);
    } catch {
      setOpenError(true);
    }
  }

  function back() {
    setSelected(null);
    requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
  }

  const isFull = view !== 'explore';
  const showFeed = view === 'saved' || desktopStatus.kind === 'ready';
  const sourceStates = data?.sources ?? [];
  const stale = sourceStates.some((item) => item.mode === 'stale');
  const available = sourceStates.filter((item) => item.mode !== 'unavailable').length;

  return (
    <section
      className={`signal-feed${isFull ? ' signal-feed--full' : ''}`}
      aria-label="News stories"
    >
      <div className="signal-feed__intro">
        <div className="signal-feed__heading">
          <h2>
            {view === 'saved' ? 'Saved stories' : view === 'news' ? 'The briefing' : 'Latest'}
          </h2>
          {view !== 'saved' && (
            <div className="signal-feed__actions">
              <button
                type="button"
                aria-label="Search news"
                aria-expanded={searchOpen}
                title="Search"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 5 5" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Refresh news"
                title="Refresh"
                disabled={!enabled || refreshing || loading}
                onClick={() => void refresh(true)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        {view === 'saved' && <p>Your saved reports, available offline.</p>}
        {searchOpen && view !== 'saved' && (
          <input
            ref={searchRef}
            className="signal-feed__search"
            type="search"
            value={query}
            placeholder="Search headlines"
            aria-label="Search headlines"
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        {view !== 'saved' && sourceStates.length > 0 && (
          <div className="signal-feed__filters">
            <select
              aria-label="Publisher"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="all">All publishers</option>
              {sourceStates.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span>
              {stale
                ? 'Cached reporting'
                : available === 0
                  ? 'Sources unavailable'
                  : `${articles.length} stories`}
            </span>
          </div>
        )}
      </div>

      {error && view !== 'saved' && (
        <div role="status" className="signal-feed__message">
          {error}
        </div>
      )}
      {openError && (
        <div role="alert" className="signal-feed__message">
          Could not open the article.
        </div>
      )}

      <div className="signal-feed__body">
        <div className="signal-feed__list" ref={listRef} tabIndex={-1} hidden={selected !== null}>
          {loading && view !== 'saved' && (
            <div className="signal-feed__empty">Loading reports…</div>
          )}
          {!showFeed && (
            <div className="signal-feed__empty">
              {desktopStatus.kind === 'preview'
                ? 'Open the desktop app to read live RSS.'
                : 'Desktop news service unavailable.'}
            </div>
          )}
          {showFeed && !loading && articles.length === 0 && (
            <div className="signal-feed__empty">
              {view === 'saved'
                ? 'No saved stories yet. Bookmark a report to see it here.'
                : query || source !== 'all'
                  ? 'No matching stories.'
                  : 'No reports available.'}
            </div>
          )}
          {articles.map((article, index) => (
            <StoryCard
              key={article.url}
              article={article}
              featured={view === 'news' && index === 0}
              saved={savedUrls.has(article.url)}
              onSelect={() => setSelected(article)}
              onToggleSave={() => onToggleBookmark(article)}
            />
          ))}
        </div>
        {selected && (
          <ArticleReader
            article={selected}
            saved={savedUrls.has(selected.url)}
            onBack={back}
            onOpen={(url) => void handleOpen(url)}
            onToggleSave={() => onToggleBookmark(selected)}
          />
        )}
      </div>
    </section>
  );
}
