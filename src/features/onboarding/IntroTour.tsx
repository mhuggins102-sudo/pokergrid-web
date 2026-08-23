import { useEffect, useRef, useState } from 'react';
import { Button } from '../../design/primitives';
import { prefersReducedMotion } from '../game/useAnimatedNumber';
import { useSettingsStore } from '../settings/settingsStore';
import { TOUR_PAGES } from './introTourPages';
import { clearIntroTour, markIntroTourSeen } from './introTourSeen';
import styles from './IntroTour.module.css';

/*
 * The intro tour: a paged how-to-play card overlaying the player's
 * first game (the game sits idle underneath — the pure reducer only
 * moves on input, and GameScreen holds the Time Trial clock while
 * this is open). Hand-rolled scrim + centered card — the established
 * "centered at every breakpoint" pattern (SettingsPage confirm /
 * DesktopResultDialog) rather than Sheet, which bottom-docks on
 * phones.
 *
 * Dismissal contract (user spec): ✕ or a scrim tap close it for THIS
 * game only; it returns on the next one. Reaching the last page, or
 * ticking "Don't show this again", marks it seen for good
 * (introTourSeen.ts). Settings can re-arm it.
 */
export function IntroTour({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  // 'fwd' slides the incoming page in from the right, 'back' from the
  // left (the archive's keyed calSlide pattern); null on first paint.
  const [dir, setDir] = useState<'fwd' | 'back' | null>(null);
  const [dismiss, setDismiss] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pageAreaRef = useRef<HTMLDivElement | null>(null);
  const still =
    useSettingsStore(s => s.reduceMotion) || prefersReducedMotion();

  const last = TOUR_PAGES.length - 1;
  const go = (next: number, d: 'fwd' | 'back') => {
    if (next < 0 || next > last) return;
    setDir(d);
    setPage(next);
  };
  const goRef = useRef(go);
  goRef.current = go;
  const pageRef = useRef(page);
  pageRef.current = page;

  // Initial focus on the panel itself so no control opens
  // pre-highlighted (the Dialog primitive's convention).
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Escape closes (session-only, same as ✕) — the DesktopResultDialog
  // pattern, since the hand-rolled scrim has no native <dialog>.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reaching the final page IS finishing the tour — mark it seen and
  // reflect that in the checkbox (untick to take it back).
  const finished = useRef(false);
  useEffect(() => {
    if (page === last && !finished.current) {
      finished.current = true;
      markIntroTourSeen();
      setDismiss(true);
    }
  }, [page, last]);

  // Horizontal swipe pages too (the archive's month-swipe pattern:
  // native listeners, 8px direction lock, 48px commit).
  useEffect(() => {
    const el = pageAreaRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let live = false;
    let axis: 'x' | 'y' | null = null;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      live = true;
      axis = null;
    };
    const move = (e: TouchEvent) => {
      if (!live) return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'x') e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      if (axis !== 'x') return;
      axis = null;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 48) return;
      const cur = pageRef.current;
      // Swipe left → forward, right → back; go() clamps the range.
      goRef.current(dx < 0 ? cur + 1 : cur - 1, dx < 0 ? 'fwd' : 'back');
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  const p = TOUR_PAGES[page];

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        ref={cardRef}
        className={`${styles.card} ${still ? styles.still : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="How to play PokerGrid"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div>
            <div className={styles.eyebrow}>How to play</div>
            <div className={styles.title}>PokerGrid</div>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.pageArea} ref={pageAreaRef}>
          <div
            key={page}
            className={`${styles.page} ${
              dir === 'fwd'
                ? styles.pageFwd
                : dir === 'back'
                  ? styles.pageBack
                  : ''
            }`}
          >
            <div className={styles.demo}>{p.demo}</div>
            <h2 className={styles.pageTitle}>{p.title}</h2>
            <p className={styles.pageBody}>{p.body}</p>
          </div>
        </div>

        <div className={styles.foot}>
          <label className={styles.dismiss}>
            <input
              type="checkbox"
              checked={dismiss}
              onChange={e => {
                setDismiss(e.target.checked);
                if (e.target.checked) markIntroTourSeen();
                else clearIntroTour();
              }}
            />
            Don't show this again
          </label>
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pageBtn}
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => go(page - 1, 'back')}
            >
              ◀
            </button>
            <span className={styles.pageCount} aria-live="polite">
              {page + 1} / {TOUR_PAGES.length}
            </span>
            {page < last ? (
              <button
                type="button"
                className={styles.pageBtn}
                aria-label="Next page"
                onClick={() => go(page + 1, 'fwd')}
              >
                ▶
              </button>
            ) : (
              <Button size="sm" variant="primary" onClick={onClose}>
                Start playing
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
