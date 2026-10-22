import { AnimatePresence } from 'motion/react';
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WorkspaceView } from '../../components/layout/workspaceTypes';
import type { DesktopStatus } from '../../services/desktop';
import { openArticle, searchCachedNews } from '../../services/news';
import { SearchField } from '../../components/arc/search-field/search-field';
import type { FilterChip, FilterField } from '../../components/arc/filter-toolbar/filter-toolbar';
import { EmptyState } from '../../components/arc/empty-state/empty-state';
import { ArticleReader } from './ArticleReader';
import type { FeedArticle } from './contracts';
import { StoryCard } from './StoryCard';
import type { useNewsFeed } from './useNewsFeed';
import { getMenaCountryName } from '../map';
import type { MenaCountryCode } from '../map';
import { RefreshCw, Search, SlidersHorizontal, Newspaper, Bookmark } from 'lucide-react';
import './NewsFeed.css';

// These controls are loaded only when the user opens advanced filters.
const Select = lazy(() =>
  import('../../components/arc/select/select').then((module) => ({ default: module.Select })),
);
const FilterToolbar = lazy(() =>
  import('../../components/arc/filter-toolbar/filter-toolbar').then((module) => ({
    default: module.FilterToolbar,
  })),
);
const DropdownMenu = lazy(() =>
  import('../../components/arc/dropdown-menu/dropdown-menu').then((module) => ({
    default: module.DropdownMenu,
  })),
);

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
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cachedMatches, setCachedMatches] = useState<{ query: string; articles: FeedArticle[] }>({
    query: '',
    articles: [],
  });
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

  useEffect(() => {
    if (!enabled || !searchOpen || deferredQuery.length < 2) {
      setCachedMatches({ query: '', articles: [] });
      return;
    }
    let live = true;
    void searchCachedNews(deferredQuery, 40)
      .then((matches) => {
        if (live) setCachedMatches({ query: deferredQuery, articles: matches });
      })
      .catch(() => {
        if (live) setCachedMatches({ query: '', articles: [] });
      });
    return () => {
      live = false;
    };
  }, [enabled, searchOpen, deferredQuery]);

  const categoryFields: FilterField[] = useMemo(
    () => [
      {
        id: 'category',
        label: 'Category',
        options: [
          { value: 'general', label: 'General' },
          { value: 'politics', label: 'Politics' },
          { value: 'economy', label: 'Economy' },
          { value: 'humanitarian', label: 'Humanitarian' },
          { value: 'culture', label: 'Culture' },
        ],
      },
    ],
    [],
  );
  const activeFilters: FilterChip[] = useMemo(
    () => (category === 'all' ? [] : [{ id: 'category', label: 'Category', value: category }]),
    [category],
  );
  const publisherOptions = useMemo(
    () => [
      { value: 'all', label: 'All publishers' },
      ...(data?.sources ?? []).map((item) => ({ value: item.id, label: item.name })),
    ],
    [data?.sources],
  );

  const articles = useMemo(() => {
    const live = view === 'saved' ? bookmarks : (data?.articles ?? []);
    // Index matches belong only to the query that produced them. The Rust FTS5
    // search has already validated matches across separate words and fields.
    const cached =
      view !== 'saved' && searchOpen && deferredQuery.length >= 2 && cachedMatches.query === deferredQuery
        ? cachedMatches.articles
        : [];
    const base = view === 'saved' ? live : [...live, ...cached];
    const indexMatches = new Set(cached.map((article) => article.canonicalUrl ?? article.url));
    const searchTerms = deferredQuery.split(/\s+/).filter(Boolean);
    const seenUrls = new Set<string>();
    return deduplicate(base)
      .filter((article) => {
        const key = article.canonicalUrl ?? article.url;
        if (seenUrls.has(key)) return false;
        seenUrls.add(key);
        if (view !== 'saved' && source !== 'all' && article.sourceId !== source) return false;
        if (view !== 'saved' && category !== 'all' && (article.category ?? 'general') !== category)
          return false;
        if (view !== 'saved' && selectedCountry) {
          const location = article.location;
          const matchesCountry =
            article.countryCodes?.includes(selectedCountry) ||
            (location.precision !== 'unknown' && location.countryCode === selectedCountry);
          if (!matchesCountry) return false;
        }
        // Saved never inherits hidden filters from another workspace. FTS5
        // results are trusted even when their words are separated in the text.
        if (view === 'saved' || searchTerms.length === 0 || indexMatches.has(key)) return true;
        const searchable = `${article.title} ${article.summary ?? ''} ${article.sourceName}`
          .toLocaleLowerCase();
        return searchTerms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => {
        const diff =
          (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0);
        return sort === 'newest' ? diff : -diff;
      });
  }, [
    data,
    view,
    bookmarks,
    source,
    category,
    deferredQuery,
    selectedCountry,
    cachedMatches,
    searchOpen,
    sort,
  ]);

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
            {view === 'saved' ? 'Saved stories' : view === 'news' ? 'The briefing' : 'Latest'}
          </h2>
          {view !== 'saved' && (
            <div className="signal-feed__actions">
              <button
                type="button"
                aria-label="Search news"
                aria-expanded={searchOpen}
                title="Search"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setQuery('');
                }}
              >
                <Search size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Filter news"
                aria-expanded={filtersOpen}
                title="Filters"
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
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
        {view !== 'saved' && selectedCountry && (
          <p key={selectedCountry} className="signal-feed__country-context" aria-live="polite">
            Now showing news for {getMenaCountryName(selectedCountry)}
          </p>
        )}
        {searchOpen && view !== 'saved' && (
          <div className="signal-feed__search-shell">
            <SearchField
              ref={searchRef}
              label="Search headlines"
              value={query}
              onValueChange={setQuery}
              placeholder="Search headlines"
            />
          </div>
        )}
        {view !== 'saved' && (filtersOpen || category !== 'all' || source !== 'all') && (
          <Suspense fallback={null}>
            <div className="signal-feed__advanced-filters">
              <div className="signal-feed__filter-actions">
                <div className="signal-feed__publisher">
                  <Select
                    label="Publisher"
                    value={source}
                    onValueChange={setSource}
                    options={publisherOptions}
                  />
                </div>
                <DropdownMenu
                  label={sort === 'newest' ? 'Newest first' : 'Oldest first'}
                  items={[
                    { label: 'Newest first', onSelect: () => setSort('newest') },
                    { label: 'Oldest first', onSelect: () => setSort('oldest') },
                  ]}
                />
              </div>
              <FilterToolbar
                filters={activeFilters}
                onRemove={(id) => {
                  if (id === 'category') setCategory('all');
                }}
                onClearAll={() => setCategory('all')}
                addFilter={{
                  fields: categoryFields,
                  label: 'Category',
                  onAdd: (chip) => setCategory(chip.value ?? 'all'),
                }}
              />
            </div>
          </Suspense>
        )}
        {view !== 'saved' && sourceStates.length > 0 && (
          <div className="signal-feed__count" role="status">
            {stale
              ? 'Cached reporting'
              : unavailable
                ? 'Partial coverage'
                : available === 0
                  ? 'Sources unavailable'
                  : `${articles.length} stories`}
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
              <EmptyState
                icon={<Newspaper size={22} />}
                title="Desktop news"
                description={
                  desktopStatus.kind === 'preview'
                    ? 'Open the desktop app to read live RSS.'
                    : 'Desktop news service unavailable.'
                }
              />
            </div>
          )}
          {showFeed && !loading && articles.length === 0 && (
            <div className="signal-feed__empty">
              <EmptyState
                icon={view === 'saved' ? <Bookmark size={22} /> : <Newspaper size={22} />}
                title={view === 'saved' ? 'Nothing saved' : 'No reports'}
                description={
                  view === 'saved'
                    ? 'No saved stories yet. Bookmark a report to see it here.'
                    : selectedCountry
                      ? 'No country-related reports for this country yet. Try refreshing for the latest stories.'
                      : query || source !== 'all' || category !== 'all'
                        ? 'No matching stories.'
                        : 'No reports available.'
                }
                action={
                  selectedCountry ? (
                    <button className="signal-feed__clear" type="button" onClick={onClearCountry}>
                      All regional stories
                    </button>
                  ) : undefined
                }
              />
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
