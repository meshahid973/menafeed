import { NewsFeed } from '../../features/news/NewsFeed';
import type { DesktopStatus } from '../../services/desktop';
import { MapSlot } from './MapSlot';
import './AppShell.css';

interface AppShellProps {
  desktopStatus: DesktopStatus;
}

export function AppShell({ desktopStatus }: AppShellProps) {
  return (
    <div className="signal-shell">
      <header className="signal-shell__header">
        <div className="signal-shell__brand" aria-label="SIGNAL MENA">
          <span className="signal-shell__beacon" aria-hidden="true" />
          <span>SIGNAL</span>
          <span className="signal-shell__brand-divider">/</span>
          <span className="signal-shell__brand-region">MENA</span>
        </div>
        <span className="signal-shell__header-title">REGIONAL NEWS INTELLIGENCE</span>
        <span className="signal-shell__edition">
          DESKTOP EDITION <span>01</span>
        </span>
      </header>
      <div className="signal-shell__workspace">
        <main className="signal-shell__map">
          <MapSlot />
        </main>
        <aside className="signal-shell__feed" aria-label="Regional news">
          <NewsFeed desktopStatus={desktopStatus} />
        </aside>
      </div>
      <footer className="signal-shell__footer">
        <span>THE MIDDLE EAST &amp; NORTH AFRICA</span>
        <span className="signal-shell__footer-center">INFORMATION WITH CONTEXT</span>
        <span>SIGNAL / 0.2</span>
      </footer>
    </div>
  );
}
