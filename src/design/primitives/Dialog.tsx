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
   * Touch drag dismisses the dialog (Sheet sets this in its
   * bottom-sheet form; Drawer with dragAxis='x'). Inner scrollable
   * content keeps priority: vertical drags only start when the touched
   * scroller is already at its top.
   */
  dragToClose?: boolean;
  /**
   * Dismiss-drag direction: 'y' (drag down — the bottom Sheet) or 'x'
   * (drag right — the right-anchored Drawer). Read only with
   * dragToClose.
   */
  dragAxis?: 'x' | 'y';
  /**
   * Where initial focus lands on open. 'panel' (default) focuses the
   * dialog itself so no control opens pre-highlighted — showModal's
   * platform behavior would land on the first focusable (usually the
   * header ×) and paint its focus ring on every open. The focus trap is
   * unaffected and Tab reaches the controls normally. 'auto' restores
   * the platform first-control focus for dialogs that want it.
   */
  initialFocus?: 'auto' | 'panel';
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
  dragAxis = 'y',
  initialFocus = 'panel',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Re-seat initial focus on the panel itself (the dialog carries
      // tabIndex={-1}) so showModal's first-control auto-focus doesn't
      // open with a highlighted button.
      if (initialFocus === 'panel') el.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, initialFocus]);

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

  // Swipe to dismiss (down for the Sheet, right for the Drawer —
  // dragAxis). Native listeners because React's synthetic touchmove is
  // passive (preventDefault would be ignored). A vertical drag only
  // arms when the touched scroll container is at its top, so lists
  // inside the sheet still scroll naturally; the horizontal axis has
  // no competing scroll direction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!el || !open || !dragToClose) return;
    const horizontal = dragAxis === 'x';
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let delta = 0;
    let mode: 'idle' | 'drag' | 'scroll' = 'scroll';
    let closeTimer: number | undefined;

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
      if (closeTimer !== undefined) return;
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
      const sc = horizontal ? null : scrollerOf(e.target);
      mode = sc && sc.scrollTop > 0 ? 'scroll' : 'idle';
      delta = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'scroll' || closeTimer !== undefined) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const d = horizontal ? dx : dy;
      const cross = horizontal ? dy : dx;
      if (mode === 'idle') {
        if (Math.abs(d) <= 8 && Math.abs(cross) <= 8) return;
        // Axis-exclusive: only a clearly dismiss-ward gesture arms the
        // drag. Anything mostly cross-axis — or moving away from the
        // dismissal edge — stays a native scroll for the WHOLE gesture,
        // so a diagonal can never scroll the list and slide the panel
        // at once.
        if (d <= 8 || Math.abs(cross) > d) {
          mode = 'scroll';
          return;
        }
        mode = 'drag';
      }
      delta = Math.max(0, d);
      el.style.transition = 'none';
      el.style.transform = horizontal
        ? `translateX(${delta}px)`
        : `translateY(${delta}px)`;
      e.preventDefault();
    };
    const onEnd = () => {
      if (mode !== 'drag' || closeTimer !== undefined) {
        mode = 'scroll';
        return;
      }
      const fast = delta / Math.max(1, Date.now() - startT) > 0.45;
      if (delta > 90 || (fast && delta > 30)) {
        if (horizontal) {
          // Finish the slide before closing — el.close() from a
          // mid-drag offset would snap the panel away. The effect
          // cleanup (open flips false) clears the inline styles.
          el.style.transition = 'transform 140ms ease';
          el.style.transform = 'translateX(100%)';
          closeTimer = window.setTimeout(() => onCloseRef.current(), 140);
        } else {
          onCloseRef.current();
        }
      } else {
        el.style.transition = 'transform 180ms ease';
        el.style.transform = '';
      }
      mode = 'scroll';
      delta = 0;
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
      window.clearTimeout(closeTimer);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [open, dragToClose, dragAxis]);

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
      // Focusable for initialFocus='panel'; -1 keeps it out of the tab
      // order, and the dialog's own outline is suppressed in CSS.
      tabIndex={-1}
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
