import { ReactNode } from 'react';
import { Dialog } from './Dialog';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  hideHeader?: boolean;
  dismissible?: boolean;
}

/**
 * Bottom sheet for small screens; falls back to a centered dialog from
 * 640px up (see Sheet.module.css). Same native-<dialog> semantics as
 * Dialog.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  hideHeader,
  dismissible,
}: SheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={styles.sheet}
      hideHeader={hideHeader}
      dismissible={dismissible}
      dragToClose={dismissible !== false}
    >
      <div className={styles.grabber} aria-hidden="true" />
      {children}
    </Dialog>
  );
}
