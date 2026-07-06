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
  /**
   * Touch drag-down dismisses the dialog (Sheet sets this in its
   * bottom-sheet form). Inner scrollable content keeps priority: drags
   * only start when the touched scroller is already at its top.
   */
  dragToClose?: boolean;
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
  dragToClose = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // showModal() makes the page behind inert but does NOT stop touch
  // scrolling it — a flick on the dialog otherwise pans the main
  // screen. Lock body scroll for the dialog's lifetime.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Swipe-down to dismiss. Native listeners because React's synthetic
  // touchmove is passive (preventDefault would be ignored). A drag only
  // arms when the touched scroll container is at its top, so lists
  // inside the sheet still scroll naturally.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!el || !open || !dragToClose) return;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let mode: 'idle' | 'drag' | 'scroll' = 'scroll';

    const scrollerOf = (t: EventTarget | null): HTMLElement | null => {
      let n = t instanceof HTMLElement ? t : null;
      while (n && n !== el) {
        if (n.scrollHeight > n.clientHeight + 1) {
          const o = getComputedStyle(n).overflowY;
          if (o === 'auto' || o === 'scroll') return n;
        }
        n = n.parentElement;
      }
      return null;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // A dialog stacked INSIDE this one (a card sheet opened from a
      // details sheet) lives in this dialog's DOM subtree, so its
      // touches bubble here too — dragging the top sheet must not
      // also drag (and dismiss) this one underneath.
      const target = e.target instanceof Element ? e.target : null;
      if (target && target.closest('dialog') !== el) {
        mode = 'scroll';
        return;
      }
      const sc = scrollerOf(e.target);
      mode = sc && sc.scrollTop > 0 ? 'scroll' : 'idle';
      dy = 0;
      startY = e.touches[0].clientY;
      startT = Date.now();
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'scroll') return;
      const d = e.touches[0].clientY - startY;
      if (mode === 'idle') {
        if (d > 8) mode = 'drag';
        else if (d < -8) {
          mode = 'scroll';
          return;
        } else return;
      }
      dy = Math.max(0, d);
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    };
    const onEnd = () => {
      if (mode !== 'drag') {
        mode = 'scroll';
        return;
      }
      const fast = dy / Math.max(1, Date.now() - startT) > 0.45;
      if (dy > 90 || (fast && dy > 30)) {
        onCloseRef.current();
      } else {
        el.style.transition = 'transform 180ms ease';
        el.style.transform = '';
      }
      mode = 'scroll';
      dy = 0;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [open, dragToClose]);

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
