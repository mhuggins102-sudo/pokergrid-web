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
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      onClose={onClose}
      onClick={handleClick}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {!hideHeader && (
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
