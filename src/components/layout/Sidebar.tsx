import { Bookmark, Globe2, Menu, Newspaper, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Tooltip } from '../arc/tooltip/tooltip';
import type { WorkspaceView } from './workspaceTypes';
import './Sidebar.css';

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
        <Tooltip side="right" content={expanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}>
          <button
          className="signal-sidebar__control"
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
        >
          <Menu size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
        </Tooltip>
        {expanded && (
          <span className="signal-sidebar__wordmark">
            signal<span>.</span>
          </span>
        )}
      </div>
      <div className="signal-sidebar__links">
        {links.map(({ id, Icon, label }) => (
          <Tooltip side="right" content={label}>
          <button
            className={`signal-sidebar__link${view === id ? ' signal-sidebar__link--active' : ''}`}
            type="button"
            key={id}
            aria-label={label}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <motion.span aria-hidden="true" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}>
              <Icon size={20} strokeWidth={1.8} />
            </motion.span>
            {expanded && <span>{label}</span>}
          </button>
          </Tooltip>
        ))}
      </div>
      <Tooltip side="right" content="Settings">
      <button
        className="signal-sidebar__link signal-sidebar__settings"
        type="button"
        onClick={onSettings}
        aria-label="Settings"
      >
        <motion.span aria-hidden="true" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}>
          <Settings2 size={20} strokeWidth={1.8} />
        </motion.span>
        {expanded && <span>Settings</span>}
      </button>
      </Tooltip>
    </nav>
  );
}
