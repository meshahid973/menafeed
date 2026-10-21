import { Bookmark, Globe2, Menu, Newspaper, Settings2, X } from 'lucide-react';
import type { WorkspaceView } from './workspaceTypes';
import './Sidebar.css';

export function SidebarIcon({ name }: { name: 'close' }) {
  return name === 'close' ? <X aria-hidden="true" size={20} strokeWidth={1.8} /> : null;
}

interface SidebarProps {
  view: WorkspaceView;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (view: WorkspaceView) => void;
  onSettings: () => void;
}

const links = [
  { id: 'explore', label: 'Explore', Icon: Globe2 },
  { id: 'news', label: 'News', Icon: Newspaper },
  { id: 'saved', label: 'Saved', Icon: Bookmark },
] as const;

export function Sidebar({ view, expanded, onToggle, onSelect, onSettings }: SidebarProps) {
  return (
    <nav
      className={`signal-sidebar${expanded ? ' signal-sidebar--expanded' : ''}`}
      aria-label="Main navigation"
    >
      <div className="signal-sidebar__top">
        <button
          className="signal-sidebar__control"
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          title={expanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
        >
          <Menu size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
        {expanded && (
          <span className="signal-sidebar__wordmark">
            signal<span>.</span>
          </span>
        )}
      </div>
      <div className="signal-sidebar__links">
        {links.map(({ id, Icon, label }) => (
          <button
            className={`signal-sidebar__link${view === id ? ' signal-sidebar__link--active' : ''}`}
            type="button"
            key={id}
            aria-label={label}
            aria-current={view === id ? 'page' : undefined}
            title={expanded ? undefined : label}
            onClick={() => onSelect(id)}
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            {expanded && <span>{label}</span>}
          </button>
        ))}
      </div>
      <button
        className="signal-sidebar__link signal-sidebar__settings"
        type="button"
        onClick={onSettings}
        aria-label="Settings"
        title={expanded ? undefined : 'Settings'}
      >
        <Settings2 size={20} strokeWidth={1.8} aria-hidden="true" />
        {expanded && <span>Settings</span>}
      </button>
    </nav>
  );
}
