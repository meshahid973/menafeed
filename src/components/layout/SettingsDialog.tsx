import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import './SettingsDialog.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A single accessible overlay; Base UI owns focus and Escape handling. */
export function SettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="signal-settings-backdrop" />
        <Dialog.Popup className="signal-settings">
          <div className="signal-settings__header">
            <Dialog.Title id="signal-settings-title">Settings</Dialog.Title>
            <Dialog.Close type="button" aria-label="Close settings">
              <X aria-hidden="true" size={20} />
            </Dialog.Close>
          </div>
          <div className="signal-settings__row"><span>Appearance</span><strong>OLED dark</strong></div>
          <div className="signal-settings__row"><span>Sidebar shortcut</span><kbd>Ctrl+B</kbd></div>
          <div className="signal-settings__row"><span>Search shortcut</span><kbd>Ctrl+K</kbd></div>
          <Dialog.Description>Original publisher links open externally.</Dialog.Description>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
