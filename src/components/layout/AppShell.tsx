import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExpandingSearch } from '../arc/expanding-search/expanding-search';
import { NewsFeed } from '../../features/news/NewsFeed';
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
  const [searchRequest, setSearchRequest] = useState(0);
  const [country, setCountry] = useState<MenaCountryCode | null>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const bookmarks = useBookmarks();
  const feed = useNewsFeed(desktopStatus.kind === 'ready' && view !== 'saved');
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

  const quickItems = useMemo(
    () =>
      (feed.data?.articles ?? []).slice(0, 90).map((article) => ({
        id: article.id,
        title: article.title,
        meta: article.sourceName,
        group: 'Recent reports',
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
        setView('news');
        setSettingsOpen(false);
        setSearchRequest((current) => current + 1);
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
          : 'Saved';
  const news = (
    <NewsFeed
      desktopStatus={desktopStatus}
      view={view}
      bookmarks={bookmarks.items}
      onToggleBookmark={bookmarks.toggle}
      searchRequest={searchRequest}
      feed={feed}
      selectedCountry={country}
      onClearCountry={() => setCountry(null)}
      selectedArticleId={selectedStory}
      onStoryHandled={() => setSelectedStory(null)}
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
              expandedWidth={320}
              maxResults={5}
              onSelect={(item) => {
                setView('news');
                setSelectedStory(item.id);
              }}
            />
          </div>
        </header>
        <div className={`signal-shell__workspace signal-shell__workspace--${view}`}>
          {view === 'explore' ? (
            <WorkspaceSplit map={mapView} feed={news} />
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
