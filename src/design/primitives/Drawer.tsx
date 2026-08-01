import { ReactNode } from 'react';
import { Dialog } from './Dialog';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  hideHeader?: boolean;
  dismissible?: boolean;
  /** Extra class on the underlying <dialog>. */
  className?: string;
}

/**
 * Left-anchored slide-out panel (the phone nav drawer). Same
 * native-<dialog> semantics as Dialog — focus trap, Escape, scrim,
 * body scroll lock — restyled to hug the left screen edge at full
 * height. Never passes dragToClose: Dialog's drag axis is vertical
 * (the Sheet's dismiss-down), which is wrong for a side panel.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  hideHeader,
  dismissible,
  className,
}: DrawerProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={[styles.drawer, className].filter(Boolean).join(' ')}
      hideHeader={hideHeader}
      dismissible={dismissible}
      // Land initial focus on the panel, not the first quick-action
      // button — the drawer shouldn't open with a highlighted control.
      initialFocus="panel"
    >
      {children}
    </Dialog>
  );
}
