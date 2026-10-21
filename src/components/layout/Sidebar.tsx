import type { WorkspaceView } from './workspaceTypes';
import './Sidebar.css';

type IconName = 'menu' | 'globe' | 'news' | 'bookmark' | 'settings' | 'close';

const paths: Record<IconName, string> = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c3 3 4.5 6.3 4.5 10s-1.5 7-4.5 10M12 2c-3 3-4.5 6.3-4.5 10s1.5 7 4.5 10',
  news: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  settings: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  close: 'M5 5l14 14M19 5 5 19',
};

export function SidebarIcon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

interface SidebarProps {
  view: WorkspaceView;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (view: WorkspaceView) => void;
  onSettings: () => void;
}

const links: { id: WorkspaceView; label: string; icon: IconName }[] = [
  { id: 'explore', label: 'Explore', icon: 'globe' },
  { id: 'news', label: 'News', icon: 'news' },
  { id: 'saved', label: 'Saved', icon: 'bookmark' },
];

export function Sidebar({ view, expanded, onToggle, onSelect, onSettings }: SidebarProps) {
  return (
    <nav className={`signal-sidebar${expanded ? ' signal-sidebar--expanded' : ''}`} aria-label="Main navigation">
      <div className="signal-sidebar__top">
        <button
          className="signal-sidebar__control"
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          title={expanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
        >
          <SidebarIcon name="menu" />
        </button>
        {expanded && <span className="signal-sidebar__wordmark">signal<span>.</span></span>}
      </div>

      <div className="signal-sidebar__links">
        {links.map(({ id, icon, label }) => (
          <button
            className={`signal-sidebar__link${view === id ? ' signal-sidebar__link--active' : ''}`}
            type="button"
            key={id}
            aria-label={label}
            aria-current={view === id ? 'page' : undefined}
            title={expanded ? undefined : label}
            onClick={() => onSelect(id)}
          >
            <SidebarIcon name={icon} />
            {expanded && <span>{label}</span>}
          </button>
        ))}
      </div>

      <button className="signal-sidebar__link signal-sidebar__settings" type="button" onClick={onSettings} aria-label="Settings" title={expanded ? undefined : 'Settings'}>
        <SidebarIcon name="settings" />
        {expanded && <span>Settings</span>}
      </button>
    </nav>
  );
}
