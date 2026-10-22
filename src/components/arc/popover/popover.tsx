import type { ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { SlidersHorizontal } from 'lucide-react';
import './popover.css';

interface FilterPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active?: boolean;
  children: ReactNode;
}

/** A compact anchored control panel; no second navigation or full-screen overlay. */
export function FilterPopover({
  open,
  onOpenChange,
  active = false,
  children,
}: FilterPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        type="button"
        aria-label="Filter news"
        title="Filters"
        data-active={active || undefined}
        className="signal-arc-popover__trigger"
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="signal-arc-popover__positioner"
        >
          <Popover.Popup className="signal-arc-popover__popup">
            <Popover.Title className="signal-arc-popover__title">Filters</Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
