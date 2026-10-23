import { AnimatePresence } from 'motion/react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WorkspaceView } from '../../components/layout/workspaceTypes';
import type { DesktopStatus } from '../../services/desktop';
import { openArticle } from '../../services/news';
import { ArticleReader } from './ArticleReader';
import type { FeedArticle } from './contracts';
import { StoryCard } from './StoryCard';
import type { useNewsFeed } from './useNewsFeed';
import { getMenaCountryName } from '../map';
import type { MenaCountryCode } from '../map';
import { RefreshCw, Search } from 'lucide-react';
import './NewsFeed.css';

interface Props {
  desktopStatus: DesktopStatus;
  view?: WorkspaceView;
  bookmarks?: FeedArticle[];
  onToggleBookmark?: (article: FeedArticle) => void;
  searchRequest?: number;
  feed: ReturnType<typeof useNewsFeed>;
  selectedCountry?: MenaCountryCode | null;
  onClearCountry?: () => void;
  selectedArticleId?: string | null;
  onStoryHandled?: () => void;
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
  feed,
  selectedCountry = null,
  onClearCountry,
  selectedArticleId = null,
  onStoryHandled,
}: Props) {
  const enabled = desktopStatus.kind === 'ready' && view !== 'saved';
  const { data, error, loading, refreshing, refresh } = feed;
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
  }, [view, selectedCountry]);

  useEffect(() => {
    if (!selected) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      requestAnimationFrame(() => listRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [selected]);

  useEffect(() => {
    if (!selectedArticleId || !data) return;
    const article = data.articles.find((item) => item.id === selectedArticleId);
    if (article) {
      setSelected(article);
      onStoryHandled?.();
    }
  }, [selectedArticleId, data, onStoryHandled]);

  const articles = useMemo(() => {
    const base = view === 'saved' ? bookmarks : (data?.articles ?? []);
    return deduplicate(base).filter((article) => {
      if (view !== 'saved' && source !== 'all' && article.sourceId !== source) return false;
      if (view === 'explore' && selectedCountry) {
        const location = article.location;
        if (location.precision === 'unknown' || location.countryCode !== selectedCountry)
          return false;
      }
      return (
        !deferredQuery ||
        `${article.title} ${article.summary ?? ''} ${article.sourceName}`
          .toLocaleLowerCase()
          .includes(deferredQuery)
      );
    });
  }, [data, view, bookmarks, source, deferredQuery, selectedCountry]);

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

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '.signal-story__headline',
    );
    if (!current || !listRef.current) return;
    const items = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>('.signal-story__headline'),
    );
    const index = items.indexOf(current);
    if (index < 0) return;
    const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
    const next = items[nextIndex];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  const isFull = view !== 'explore';
  const showFeed = view === 'saved' || desktopStatus.kind === 'ready';
  const sourceStates = data?.sources ?? [];
  const stale = sourceStates.some((item) => item.mode === 'stale');
  const unavailable = sourceStates.some((item) => item.mode === 'unavailable');
  const available = sourceStates.filter((item) => item.mode !== 'unavailable').length;

  return (
    <section
      className={`signal-feed${isFull ? ' signal-feed--full' : ''}`}
      aria-label="News stories"
    >
      <div className="signal-feed__intro">
        <div className="signal-feed__heading">
          <h2>
            {view === 'saved'
              ? 'Saved stories'
              : view === 'news'
                ? 'The briefing'
                : selectedCountry
                  ? getMenaCountryName(selectedCountry)
                  : 'Latest'}
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
                <Search size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Refresh news"
                title="Refresh"
                disabled={!enabled || refreshing || loading}
                onClick={() => void refresh(true)}
              >
                <RefreshCw
                  size={18}
                  aria-hidden="true"
                  className={refreshing ? 'signal-feed__spinning' : undefined}
                />
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
                : unavailable
                  ? 'Partial coverage'
                  : available === 0
                    ? 'Sources unavailable'
                    : `${articles.length} stories`}
            </span>
          </div>
        )}
      </div>

      {error && view !== 'saved' && (
        <div role="status" className="signal-feed__message">
          <span>{error}</span>
          <button type="button" disabled={refreshing || loading} onClick={() => void refresh(true)}>
            Retry
          </button>
        </div>
      )}
      {openError && (
        <div role="alert" className="signal-feed__message">
          Could not open the article.
        </div>
      )}

      <div className="signal-feed__body">
        <div
          className="signal-feed__list"
          ref={listRef}
          tabIndex={-1}
          hidden={selected !== null}
          onKeyDown={handleListKeyDown}
        >
          {loading && view !== 'saved' && (
            <div className="signal-feed__skeletons" role="status" aria-label="Loading news">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="signal-feed__skeleton">
                  <span />
                  <span />
                </div>
              ))}
            </div>
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
                : selectedCountry
                  ? 'No location-verified reports for this country yet. RSS stories are not automatically geotagged.'
                  : query || source !== 'all'
                    ? 'No matching stories.'
                    : 'No reports available.'}
              {selectedCountry && (
                <button className="signal-feed__clear" type="button" onClick={onClearCountry}>
                  All regional stories
                </button>
              )}
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
        <AnimatePresence mode="wait" initial={false}>
          {selected && (
            <ArticleReader
              key={selected.id}
              article={selected}
              saved={savedUrls.has(selected.url)}
              onBack={back}
              onOpen={(url) => void handleOpen(url)}
              onToggleSave={() => onToggleBookmark(selected)}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
