import { Bookmark, Globe2, Menu, Newspaper, Settings2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
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

/** Bencho-inspired fold: icon column stays fixed while labels leave first. */
export function Sidebar({ view, expanded, onToggle, onSelect, onSettings }: SidebarProps) {
  const reduced = useReducedMotion() ?? false;
  const labelTransition = reduced ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' as const };
  return (
    <nav
      className={`signal-sidebar${expanded ? ' signal-sidebar--expanded' : ''}`}
      aria-label="Main navigation"
      data-expanded={expanded || undefined}
    >
      <div className="signal-sidebar__top">
        <Tooltip
          side="right"
          content={expanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
        >
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
        <motion.span
          className="signal-sidebar__wordmark"
          aria-hidden={!expanded}
          initial={false}
          animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
          transition={labelTransition}
        >
          signal<span>.</span>
        </motion.span>
      </div>
      <div className="signal-sidebar__links">
        {links.map(({ id, Icon, label }) => (
          <Tooltip key={id} side="right" content={label}>
            <button
              className={`signal-sidebar__link${view === id ? ' signal-sidebar__link--active' : ''}`}
              type="button"
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => onSelect(id)}
            >
              {view === id && (
                <motion.span
                  layoutId="signal-nav-indicator"
                  className="signal-sidebar__indicator"
                  aria-hidden="true"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 390, damping: 36 }
                  }
                />
              )}
              <motion.span
                className="signal-sidebar__icon"
                aria-hidden="true"
                whileHover={reduced ? undefined : { scale: 1.06 }}
                whileTap={reduced ? undefined : { scale: 0.96 }}
              >
                <Icon size={20} strokeWidth={1.8} />
              </motion.span>
              <motion.span
                className="signal-sidebar__label"
                aria-hidden={!expanded}
                initial={false}
                animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -7 }}
                transition={labelTransition}
              >
                {label}
              </motion.span>
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
          <motion.span
            className="signal-sidebar__icon"
            aria-hidden="true"
            whileHover={reduced ? undefined : { scale: 1.06 }}
            whileTap={reduced ? undefined : { scale: 0.96 }}
          >
            <Settings2 size={20} strokeWidth={1.8} />
          </motion.span>
          <motion.span
            className="signal-sidebar__label"
            aria-hidden={!expanded}
            initial={false}
            animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -7 }}
            transition={labelTransition}
          >
            Settings
          </motion.span>
        </button>
      </Tooltip>
    </nav>
  );
}
