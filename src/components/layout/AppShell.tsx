import type { DesktopStatus } from '../../services/desktop';
import './AppShell.css';

interface AppShellProps {
  desktopStatus: DesktopStatus;
}

function statusMessage(status: DesktopStatus) {
  switch (status.kind) {
    case 'ready':
      return 'DESKTOP / DATABASE READY';
    case 'checking':
      return 'DESKTOP / CONNECTING';
    case 'preview':
      return 'BROWSER / PREVIEW MODE';
    case 'error':
      return 'DESKTOP / CONNECTION ERROR';
  }
}

export function AppShell({ desktopStatus }: AppShellProps) {
  return (
    <div className="signal-shell">
      <header className="signal-shell__header">
        <div className="signal-shell__brand">
          <span aria-hidden="true" className="signal-shell__beacon" />
          <span>SIGNAL</span>
          <span className="signal-shell__slash">/</span>
          <span className="signal-shell__region">MENA</span>
        </div>
        <span className="signal-shell__header-note">REGIONAL NEWS INTELLIGENCE</span>
        <span className="signal-shell__phase">FOUNDATION / 01</span>
      </header>

      <main className="signal-shell__main">
        <div className="signal-shell__eyebrow">01 / SYSTEM INITIALIZED</div>
        <h1 className="signal-shell__title">
          The region.
          <br />
          In context<span className="signal-shell__period">.</span>
        </h1>
        <p className="signal-shell__description">
          A geographic news atlas for the Middle East and North Africa.
          The map, reporting, and timeline arrive in future releases.
        </p>
        <div aria-live="polite" className="signal-shell__status">
          <span
            aria-hidden="true"
            className={
              desktopStatus.kind === 'error'
                ? 'signal-shell__status-light signal-shell__status-light--error'
                : 'signal-shell__status-light'
            }
          />
          <span>{statusMessage(desktopStatus)}</span>
          {desktopStatus.kind === 'ready' && (
            <span className="signal-shell__status-detail">
              SQLITE SCHEMA {desktopStatus.schemaVersion}
            </span>
          )}
        </div>
      </main>

      <footer className="signal-shell__footer">
        <span>THE MIDDLE EAST &amp; NORTH AFRICA</span>
        <span>DESIGNED FOR CLARITY</span>
      </footer>
    </div>
  );
}
