import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeedArticle } from '../../features/news/contracts';
import { searchCachedNews } from '../../services/news';
import { ExpandingSearch } from '../arc/expanding-search/expanding-search';
import { NewsFeed } from '../../features/news/NewsFeed';
import { HistoryWorkspace } from '../../features/history/HistoryWorkspace';
import { useBookmarks } from '../../features/news/useBookmarks';
import { useNewsFeed } from '../../features/news/useNewsFeed';
import { getMenaCountryName } from '../../features/map';
import type { MenaCountryCode, MenaMarker } from '../../features/map';
import type { DesktopStatus } from '../../services/desktop';
import { MapSlot } from './MapSlot';
import { Sidebar } from './Sidebar';
import { SettingsDialog } from './SettingsDialog';
import { WorkspaceSplit } from './WorkspaceSplit';
import type { WorkspaceView } from './workspaceTypes';
import './AppShell.css';

interface AppShellProps {
  desktopStatus: DesktopStatus;
}

function readExpanded(): boolean {
  try {
    return window.localStorage.getItem('signal:sidebar-expanded') === 'true';
  } catch {
    return false;
  }
}

export function AppShell({ desktopStatus }: AppShellProps) {
  const [view, setView] = useState<WorkspaceView>('explore');
  const [expanded, setExpanded] = useState(readExpanded);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpenRequest, setQuickOpenRequest] = useState(0);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickMatches, setQuickMatches] = useState<{ query: string; articles: FeedArticle[] }>({
    query: '',
    articles: [],
  });
  const [quickSelected, setQuickSelected] = useState<FeedArticle | null>(null);
  const [country, setCountry] = useState<MenaCountryCode | null>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const bookmarks = useBookmarks();
  const feed = useNewsFeed(desktopStatus.kind === 'ready' && view !== 'saved' && view !== 'history');
  const onMarkerSelect = useCallback((marker: MenaMarker) => setSelectedStory(marker.id), []);

  const markers = useMemo(
    () =>
      (feed.data?.articles ?? []).flatMap((article): MenaMarker[] => {
        const location = article.location;
        if (
          location.precision !== 'city' ||
          !Number.isFinite(location.latitude) ||
          !Number.isFinite(location.longitude)
        )
          return [];
        return [
          {
            id: article.id,
            label: article.title,
            longitude: location.longitude,
            latitude: location.latitude,
            detail: article.sourceName,
          },
        ];
      }),
    [feed.data?.articles],
  );

  const quickTerm = quickQuery.trim().toLocaleLowerCase();

  useEffect(() => {
    if (desktopStatus.kind !== 'ready' || quickTerm.length < 2) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void searchCachedNews(quickTerm, 30)
        .then((articles) => {
          if (live) setQuickMatches({ query: quickTerm, articles });
        })
        .catch(() => {
          if (live) setQuickMatches({ query: quickTerm, articles: [] });
        });
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [desktopStatus.kind, quickTerm]);

  const quickArticles = useMemo(() => {
    const terms = quickTerm.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const items: { article: FeedArticle; group: string }[] = [];
    const add = (article: FeedArticle, group: string) => {
      const key = article.canonicalUrl ?? article.url;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ article, group });
    };
    for (const article of feed.data?.articles ?? []) {
      if (
        terms.every((term) =>
          `${article.title} ${article.summary ?? ''} ${article.sourceName}`
            .toLocaleLowerCase()
            .includes(term),
        )
      )
        add(article, 'Latest reports');
      if (items.length >= 8) break;
    }
    if (quickMatches.query === quickTerm && quickTerm.length >= 2) {
      for (const article of quickMatches.articles) add(article, 'From history');
    }
    return items.slice(0, 12);
  }, [feed.data?.articles, quickMatches, quickTerm]);

  const quickItems = useMemo(
    () =>
      quickArticles.map(({ article, group }) => ({
        id: article.id,
        title: article.title,
        meta: article.sourceName,
        group,
      })),
    [quickArticles],
  );
  const quickSuggestions = useMemo(
    () =>
      (feed.data?.articles ?? []).slice(0, 5).map((article) => ({
        id: article.id,
        title: article.title,
        meta: article.sourceName,
        group: 'Latest reports',
      })),
    [feed.data?.articles],
  );

  const mapView = useMemo(
    () => (
      <MapSlot
        selectedCountry={country}
        onCountrySelect={setCountry}
        markers={markers}
        onMarkerSelect={onMarkerSelect}
      />
    ),
    [country, markers, onMarkerSelect],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem('signal:sidebar-expanded', String(expanded));
    } catch {
      /* optional */
    }
  }, [expanded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'b') {
        event.preventDefault();
        setExpanded((current) => !current);
      } else if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setSettingsOpen(false);
        setQuickOpenRequest((current) => current + 1);
      } else if (event.key === 'Escape') {
        setSettingsOpen(false);
        setExpanded(false);
        setCountry(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function navigate(next: WorkspaceView) {
    setView(next);
    setSettingsOpen(false);
    if (window.innerWidth <= 720) setExpanded(false);
  }

  const headline =
    country && view === 'explore'
      ? getMenaCountryName(country)
      : view === 'explore'
        ? 'Explore'
        : view === 'news'
          ? 'News'
          : view === 'history'
            ? 'History'
            : 'Saved';
  const news = (
    <NewsFeed
      desktopStatus={desktopStatus}
      view={view}
      bookmarks={bookmarks.items}
      onToggleBookmark={bookmarks.toggle}
      feed={feed}
      selectedQuickArticle={quickSelected}
      selectedCountry={country}
      onClearCountry={() => setCountry(null)}
      selectedArticleId={selectedStory}
      onStoryHandled={() => {
        setSelectedStory(null);
        setQuickSelected(null);
      }}
    />
  );

  return (
    <div className="signal-shell">
      {expanded && (
        <button
          type="button"
          className="signal-shell__scrim"
          aria-label="Close sidebar"
          onClick={() => setExpanded(false)}
        />
      )}
      <Sidebar
        view={view}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        onSelect={navigate}
        onSettings={() => {
          setSettingsOpen(true);
          if (window.innerWidth <= 720) setExpanded(false);
        }}
      />
      <div className="signal-shell__content">
        <header className="signal-shell__header">
          <h1>{headline}</h1>
          <div className="signal-shell__header-actions">
            {country && view === 'explore' && (
              <button
                className="signal-shell__clear"
                type="button"
                onClick={() => setCountry(null)}
              >
                All countries ×
              </button>
            )}
            <span>Middle East &amp; North Africa</span>
            <ExpandingSearch
              className="signal-shell__quick-search"
              label="Search news"
              placeholder="Recent reports"
              items={quickItems}
              suggestions={quickSuggestions}
              suggestionsLabel="Latest reports"
              onQueryChange={setQuickQuery}
              resultsArePreRanked
              openRequest={quickOpenRequest}
              expandedWidth={320}
              maxResults={6}
              onSelect={(item) => {
                const article =
                  quickArticles.find(({ article: entry }) => entry.id === item.id)?.article ??
                  feed.data?.articles.find((entry) => entry.id === item.id);
                if (!article) return;
                setView('news');
                setCountry(null);
                setQuickSelected(article);
              }}
            />
          </div>
        </header>
        <div className={`signal-shell__workspace signal-shell__workspace--${view}`}>
          {view === 'explore' ? (
            <WorkspaceSplit map={mapView} feed={news} />
          ) : view === 'history' ? (
            <HistoryWorkspace
              desktopStatus={desktopStatus}
              country={country}
              onCountrySelect={setCountry}
              bookmarks={bookmarks.items}
              onToggleBookmark={bookmarks.toggle}
            />
          ) : (
            <section className="signal-shell__feed" aria-label="Regional news">
              {news}
            </section>
          )}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
