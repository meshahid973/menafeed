import { useEffect, useState } from 'react';
import { NewsFeed } from '../../features/news/NewsFeed';
import { useBookmarks } from '../../features/news/useBookmarks';
import type { DesktopStatus } from '../../services/desktop';
import { MapSlot } from './MapSlot';
import { Sidebar, SidebarIcon } from './Sidebar';
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
  const bookmarks = useBookmarks();

  useEffect(() => {
    try {
      window.localStorage.setItem('signal:sidebar-expanded', String(expanded));
    } catch {
      // Private browsing / blocked storage: layout still works.
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

  const title = view === 'explore' ? 'Explore' : view === 'news' ? 'News' : 'Saved';

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
          <h1>{title}</h1>
          <span>Middle East &amp; North Africa</span>
        </header>
        <div className={`signal-shell__workspace signal-shell__workspace--${view}`}>
          <main className="signal-shell__map" aria-hidden={view !== 'explore' ? true : undefined}>
            <MapSlot />
          </main>
          <section className="signal-shell__feed" aria-label="Regional news">
            <NewsFeed
              desktopStatus={desktopStatus}
              view={view}
              bookmarks={bookmarks.items}
              onToggleBookmark={bookmarks.toggle}
              searchRequest={searchRequest}
            />
          </section>
        </div>
      </div>
      {settingsOpen && (
        <div
          className="signal-settings-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="signal-settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signal-settings-title"
          >
            <div className="signal-settings__header">
              <h2 id="signal-settings-title">Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <SidebarIcon name="close" />
              </button>
            </div>
            <div className="signal-settings__row">
              <span>Appearance</span>
              <strong>OLED dark</strong>
            </div>
            <div className="signal-settings__row">
              <span>Sidebar shortcut</span>
              <kbd>Ctrl+B</kbd>
            </div>
            <div className="signal-settings__row">
              <span>Search shortcut</span>
              <kbd>Ctrl+K</kbd>
            </div>
            <p>News from publisher RSS feeds. Links open the original source.</p>
          </section>
        </div>
      )}
    </div>
  );
}
