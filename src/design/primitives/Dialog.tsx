import { ReactNode, useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Extra class on the <dialog> element (e.g. Sheet restyles it). */
  className?: string;
  /** Hide the built-in header row (title + close button). */
  hideHeader?: boolean;
  /**
   * When false, Escape and backdrop clicks are ignored — for flows where
   * the player must make a choice (e.g. a forced bonus swap).
   */
  dismissible?: boolean;
}

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to
 * close, and ::backdrop come from the platform. Controlled via `open`;
 * `onClose` fires for Escape, backdrop click, and the close button.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  hideHeader = false,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // A click on the backdrop targets the <dialog> element itself.
    if (dismissible && e.target === ref.current) onClose();
  };

  // React propagates close/cancel synthetically through the component
  // tree even though the native events don't bubble — without the
  // target guard, closing a nested dialog would also close this one.
  const handleClose = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (e.target !== ref.current) return;
    // Escape fires 'cancel'; suppress it for must-choose flows.
    if (!dismissible) e.preventDefault();
  };

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      onClose={handleClose}
      onClick={handleClick}
      onCancel={handleCancel}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {!hideHeader && (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {dismissible && (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
