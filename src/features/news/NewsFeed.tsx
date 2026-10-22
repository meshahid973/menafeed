import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WorkspaceView } from '../../components/layout/workspaceTypes';
import type { DesktopStatus } from '../../services/desktop';
import { openArticle, searchCachedNews } from '../../services/news';
import { SearchField } from '../../components/arc/search-field/search-field';
import { FilterPopover } from '../../components/arc/popover/popover';
import type { FilterChip, FilterField } from '../../components/arc/filter-toolbar/filter-toolbar';
import { EmptyState } from '../../components/arc/empty-state/empty-state';
import { PublisherSelection } from '../../components/news/PublisherSelection';
import { ArticleReader } from './ArticleReader';
import type { FeedArticle } from './contracts';
import { StoryCard } from './StoryCard';
import { Skeleton } from '../../components/arc/skeleton/skeleton';
import type { useNewsFeed } from './useNewsFeed';
import { getMenaCountryName } from '../map';
import type { MenaCountryCode } from '../map';
import { RefreshCw, Search, X, Newspaper, Bookmark } from 'lucide-react';
import './NewsFeed.css';

// These controls are loaded only when the user opens advanced filters.
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
  feed: ReturnType<typeof useNewsFeed>;
  selectedQuickArticle?: FeedArticle | null;
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
  feed,
  selectedQuickArticle = null,
  selectedCountry = null,
  onClearCountry,
  selectedArticleId = null,
  onStoryHandled,
}: Props) {
  const enabled = desktopStatus.kind === 'ready' && view !== 'saved';
  const { data, error, loading, refreshing, refresh } = feed;
  const [source, setSource] = useState<string[]>([]);
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
  const reduced = useReducedMotion() ?? false;
  const seenReports = useRef<Set<string> | null>(null);
  const lastReports = useRef<FeedArticle[] | null>(null);
  const [newReportUrls, setNewReportUrls] = useState<Set<string>>(() => new Set());
  const savedUrls = useMemo(() => new Set(bookmarks.map((item) => item.url)), [bookmarks]);
  // On the full News workspace, Arc Search Field is permanently accessible.
  const showSearch = view === 'news' || searchOpen;

  useEffect(() => {
    const reports = data?.articles;
    if (!reports || lastReports.current === reports) return;
    lastReports.current = reports;
    const previous = seenReports.current;
    const next = new Set(reports.map((article) => article.canonicalUrl ?? article.url));
    if (previous) {
      setNewReportUrls(
        new Set(
          reports
            .filter((article) => !previous.has(article.canonicalUrl ?? article.url))
            .map((article) => article.canonicalUrl ?? article.url),
        ),
      );
    }
    seenReports.current = next;
  }, [data?.articles]);

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
    if (!selectedQuickArticle) return;
    setSelected(selectedQuickArticle);
    onStoryHandled?.();
  }, [selectedQuickArticle, onStoryHandled]);

  useEffect(() => {
    if (!enabled || !showSearch || deferredQuery.length < 2) {
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
  }, [enabled, showSearch, deferredQuery]);

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

  const articles = useMemo(() => {
    const live = view === 'saved' ? bookmarks : (data?.articles ?? []);
    // Index matches belong only to the query that produced them. The Rust FTS5
    // search has already validated matches across separate words and fields.
    const cached =
      view !== 'saved' &&
      showSearch &&
      deferredQuery.length >= 2 &&
      cachedMatches.query === deferredQuery
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
        if (view !== 'saved' && source.length > 0 && !source.includes(article.sourceId)) return false;
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
        const searchable =
          `${article.title} ${article.summary ?? ''} ${article.sourceName}`.toLocaleLowerCase();
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
    showSearch,
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

  // Only show related reporting when independent publishers share the exact
  // backend event-cluster ID. No speculative headline similarity.
  const relatedArticles = useMemo(() => {
    if (!selected?.clusterId) return [];
    const seen = new Set<string>([selected.canonicalUrl ?? selected.url]);
    const publishers = new Set<string>([selected.sourceId]);
    return [...(data?.articles ?? []), ...cachedMatches.articles, ...bookmarks]
      .filter((article) => {
        const key = article.canonicalUrl ?? article.url;
        if (!article.clusterId || article.clusterId !== selected.clusterId ||
          seen.has(key) || publishers.has(article.sourceId)) return false;
        seen.add(key);
        publishers.add(article.sourceId);
        return true;
      })
      .slice(0, 6);
  }, [selected, data?.articles, cachedMatches.articles, bookmarks]);

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
              {view === 'explore' && (
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
              )}
              <FilterPopover
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                active={category !== 'all' || source.length > 0 || sort !== 'newest'}
              >
                <Suspense fallback={<div className="signal-feed__filter-loading" />}>
                  <div className="signal-feed__advanced-filters">
                    <div className="signal-feed__filter-actions">
                      <div className="signal-feed__publisher">
                        <PublisherSelection
                          sources={data?.sources ?? []}
                          selected={source}
                          onChange={setSource}
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
              </FilterPopover>
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
        {showSearch && view !== 'saved' && (
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
        {view !== 'saved' && (category !== 'all' || source.length > 0 || sort !== 'newest') && (
          <div className="signal-feed__active-filters" aria-label="Active news filters">
            {source.map((sourceId) => (
              <button
                key={sourceId}
                type="button"
                onClick={() => setSource((current) => current.filter((id) => id !== sourceId))}
                aria-label={`Clear publisher filter: ${sourceId}`}
              >
                {data?.sources.find((item) => item.id === sourceId)?.name ?? sourceId}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            {category !== 'all' && (
              <button
                type="button"
                onClick={() => setCategory('all')}
                aria-label="Clear category filter"
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
                <X size={12} aria-hidden="true" />
              </button>
            )}
            {sort !== 'newest' && (
              <button
                type="button"
                onClick={() => setSort('newest')}
                aria-label="Reset story sort order"
              >
                Oldest first <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
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
          <AnimatePresence initial={false}>
            {loading && view !== 'saved' && (
              <motion.div
                key="loading"
                className="signal-feed__skeletons"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.14 }}
              >
                {[0, 1, 2, 3].map((item) => (
                  <Skeleton
                    key={item}
                    className="signal-feed__skeleton"
                    lines={2}
                    label="Loading news"
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
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
                      : query || source.length > 0 || category !== 'all'
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
              animateNew={
                view !== 'saved' && newReportUrls.has(article.canonicalUrl ?? article.url)
              }
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
              relatedArticles={relatedArticles}
              source={sourceStates.find((item) => item.id === selected.sourceId)}
              onRelatedSelect={setSelected}
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
