import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { Tier, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { isBackendConfigured, type TopScoreEntry } from '../../lib/supabaseRpc';
import {
  ArrowRight,
  Chevron,
  TriangleRight,
  useTapPopover,
  useTapPopoverCloseAll,
} from '../../design/primitives';
import { useTier } from '../../app/useTier';
import { DAILY_LAUNCH_ISO, dayMs, toISO, toUTC } from './dailyDates';
import { usePlaysStore } from './sync/playsStore';
import {
  useArchiveRank,
  useDailyHistogram,
  useDailyStats,
} from './sync/useDailyRank';
import { useHandle } from './sync/handleStore';
import styles from './DailyArchivePage.module.css';

/*
 * The daily archive at every tier (phase 4 convergence), per
 * design-refs/desktop/Daily Archive.dc.html: a month-selectable
 * scrolling day list (score + tier badge for played days, Start for
 * missed ones) and the selected day's result — rank strip, score
 * distribution, and the top of the board — all bound to the real
 * playsStore / daily RPCs. The two panels sit side by side ≥768 and
 * stack on phones.
 */

const MONTH_NAME = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAME = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// The repo's real tier system (SS..D); badge tones follow the mockup's
// rating palette with both win-with-headroom tiers on success.
const TIER_TONE: Record<Tier, string> = {
  SS: 'var(--success)',
  S: 'var(--success)',
  A: 'var(--warn)',
  B: 'var(--ink-2)',
  C: 'var(--ink-3)',
  D: 'var(--danger)',
};

const monthOf = (iso: string): string => iso.slice(0, 7); // YYYY-MM

const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAME[m - 1]} ${y}`;
};

/** Every published month, current → launch — newest at the top of the
 *  picker, matching the newest-first day list. */
const publishedMonths = (todayISO: string): string[] => {
  const out: string[] = [];
  let [y, m] = DAILY_LAUNCH_ISO.split('-').map(Number).slice(0, 2);
  const cur = monthOf(todayISO);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > cur) break;
    out.push(month);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.reverse();
};

/** The month's published dates, newest first. */
const monthDates = (month: string, todayISO: string): string[] => {
  const [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let t = toUTC(`${month}-01`); ; t += dayMs) {
    const iso = toISO(t);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1) break;
    if (iso > todayISO || iso < DAILY_LAUNCH_ISO) continue;
    out.push(iso);
  }
  return out.reverse();
};

const weekdayOf = (iso: string): string =>
  WEEKDAY_NAME[new Date(toUTC(iso)).getUTCDay()];

// List ↔ calendar view, remembered across visits. A page-local
// preference, so plain (guarded) localStorage rather than the settings
// store.
type ArchiveView = 'list' | 'cal';
const VIEW_KEY = 'pokergrid:archive-view';
const storedView = (): ArchiveView => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cal' ? 'cal' : 'list';
  } catch {
    return 'list';
  }
};

const longDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAME[m - 1]} ${d}, ${y}`;
};

export function DailyArchivePage() {
  const plays = usePlaysStore(s => s.plays);
  const backend = isBackendConfigured();
  // Reactive — a rename elsewhere updates the synthesized own row.
  const handle = useHandle();
  const today = currentDateISO();
  const isPhone = useTier() === 'phone';
  // Phone: the score distribution + leaderboard are hidden by default and
  // revealed one at a time by the two header icons (the DeskStatsPanel
  // chart-toggle pattern). null = neither shown. ≥768 shows both inline.
  const [detailView, setDetailView] = useState<'dist' | 'board' | null>(null);
  const months = useMemo(() => publishedMonths(today), [today]);
  // Return-with-context: /daily/archive?d=YYYY-MM-DD (the daily result
  // screen's archive buttons pass the date they came from) seeds the
  // initial selection + month, so "View full result" round-trips back
  // to the same day. Also makes any date deep-linkable.
  const [search] = useSearchParams();
  const returnD = search.get('d');
  const returnDate =
    returnD &&
    /^\d{4}-\d{2}-\d{2}$/.test(returnD) &&
    returnD >= DAILY_LAUNCH_ISO &&
    returnD <= today
      ? returnD
      : null;
  const [month, setMonth] = useState(() => monthOf(returnDate ?? today));
  const [sel, setSel] = useState(returnDate ?? today);
  // Fine pointers open the month menu on hover / :focus-within (the JS
  // state below). Touch can't hover, so the TapPopover primitive adds a
  // tap-to-toggle on coarse pointers WITHOUT touching fine-pointer
  // behavior (open stays false, toggleProps empty there — ≥768 render
  // byte-identical). `monthMenu` is the union of both open sources.
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const monthTap = useTapPopover('archive-month');
  const closeAllPopovers = useTapPopoverCloseAll();
  const monthMenu = monthMenuOpen || monthTap.open;

  const dates = useMemo(() => monthDates(month, today), [month, today]);

  const [view, setView] = useState<ArchiveView>(storedView);
  const pickView = (v: ArchiveView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode — the toggle still works for this visit */
    }
  };

  // Calendar cells: leading blanks align the 1st to its weekday column,
  // then every day of the month — days outside the published window
  // (future / pre-launch) render inert.
  const calendar = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = toUTC(`${month}-01`);
    const lead = new Date(first).getUTCDay();
    const cells: { iso: string; day: number; open: boolean }[] = [];
    for (let t = first; ; t += dayMs) {
      const dt = new Date(t);
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1) break;
      const iso = toISO(t);
      cells.push({
        iso,
        day: dt.getUTCDate(),
        open: iso <= today && iso >= DAILY_LAUNCH_ISO,
      });
    }
    return { lead, cells };
  }, [month, today]);

  // Selected-day data (real RPCs; every hook keys on `sel`).
  const rank = useArchiveRank(sel);
  const stats = useDailyStats(sel, backend);
  const histo = useDailyHistogram(sel, backend);

  const selPlay = plays[sel];
  const selRecipe = recipeFor(sel);
  const selTarget = dailyTargetFor(selRecipe.difficulty, selRecipe.twist);
  const selTier = selPlay
    ? tierForRun({ score: selPlay.score, target: selTarget, won: selPlay.won })
    : null;

  // Mockup's list-height sync: the scroll area never runs past the
  // detail panel's bottom edge.
  const detailRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sync = () => {
      const det = detailRef.current;
      const sc = scrollRef.current;
      if (!det || !sc) return;
      // Phone (<768): the panels stack, so the list takes a fixed CSS
      // cap instead of the side-by-side detail-height sync.
      if (!window.matchMedia('(min-width: 768px)').matches) {
        sc.style.maxHeight = '';
        return;
      }
      const h = Math.floor(
        det.getBoundingClientRect().bottom - sc.getBoundingClientRect().top
      );
      sc.style.maxHeight = `${Math.max(120, h)}px`;
    };
    sync();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    if (detailRef.current && ro) ro.observe(detailRef.current);
    window.addEventListener('resize', sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', sync);
    };
    // `view` re-runs the sync when the calendar ↔ list toggle remounts
    // the scroll area (its ref is null while the calendar shows).
  }, [view]);

  // Phone: keep the toggled section in view. Turning one ON grows the
  // panel below the fold → scroll its BOTTOM into view; turning the last
  // one OFF → scroll back to the top of the PAGE. Skip the first run so a
  // fresh page load (detailView already null) doesn't jump.
  const detailScrollInit = useRef(false);
  useEffect(() => {
    if (!isPhone) return;
    if (!detailScrollInit.current) {
      detailScrollInit.current = true;
      return;
    }
    const el = detailRef.current;
    requestAnimationFrame(() => {
      try {
        if (detailView === null) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      } catch {
        /* jsdom / unsupported env — non-essential */
      }
    });
  }, [detailView, isPhone]);

  // Top of the board: top 5 with the player's own row seated AT its
  // rank (the leaderboard panel's splice pattern); ranks past #5
  // append below.
  const top = stats.data?.topScores ?? [];
  let top5 = top.slice(0, 5);
  let ownRow: TopScoreEntry | null = null;
  if (selPlay && !top5.some(t => t.isOwn)) {
    const synthesized =
      top.find(t => t.isOwn) ??
      (rank.data
        ? {
            rank: rank.data.rank,
            displayName: handle ?? 'you',
            score: rank.data.score,
            isOwn: true,
          }
        : null);
    if (synthesized !== null) {
      if (synthesized.rank <= 5) {
        top5 = [...top5];
        top5.splice(synthesized.rank - 1, 0, synthesized);
        top5 = top5.slice(0, 5);
      } else {
        ownRow = synthesized;
      }
    }
  }

  const bins = histo.data?.bins ?? [];
  const own = selPlay?.score;
  const binCount = (b: (typeof bins)[number]): number =>
    own !== undefined && own >= b.lo && own <= b.hi
      ? Math.max(b.count, 1)
      : b.count;
  const maxCount = Math.max(1, ...bins.map(binCount));

  const pickMonth = (m: string) => {
    setMonth(m);
    const newest = monthDates(m, today)[0];
    if (newest) setSel(newest);
    // Snap the day list back to the top so the month's newest date
    // (just selected above) is visible — otherwise the list can stay
    // scrolled down from the previous month.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // Selecting is inside the wrap, so the outside-tap dismissal never
    // fires — close the tap popover (and the hover state) explicitly so
    // the menu doesn't stay pinned open on touch after a pick.
    setMonthMenuOpen(false);
    closeAllPopovers();
  };

  // Calendar swipe: a horizontal swipe on the month grid pages between
  // months (left = newer, right = older — `months` is newest-first),
  // clamped at the published range. Native listeners for the same
  // reason as Dialog's drag-to-close; the 2:1 direction guard leaves
  // vertical page scrolling and plain taps alone.
  const calWrapRef = useRef<HTMLDivElement | null>(null);
  const pickMonthRef = useRef(pickMonth);
  pickMonthRef.current = pickMonth;
  useEffect(() => {
    const el = calWrapRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let live = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      live = true;
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dx) < 2 * Math.abs(dy)) return;
      const idx = months.indexOf(month);
      const next = dx < 0 ? idx - 1 : idx + 1;
      if (next >= 0 && next < months.length) {
        pickMonthRef.current(months[next]);
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
    };
  }, [months, month, view]);

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Daily · Archive</div>
      <h1 className={styles.pageTitle}>Past puzzles</h1>

      <div className={styles.columns}>
        {/* ---- Archive list ---- */}
        <div className={styles.listPanel}>
          {/* Head row: the month picker (label + caret grouped LEFT) and
              the list ↔ calendar view toggle in the freed right space. */}
          <div className={styles.listHead}>
            <div
              ref={monthTap.wrapRef}
              className={styles.monthWrap}
              tabIndex={0}
              onMouseEnter={() => setMonthMenuOpen(true)}
              onMouseLeave={() => setMonthMenuOpen(false)}
              onFocus={() => setMonthMenuOpen(true)}
              onBlur={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setMonthMenuOpen(false);
                }
              }}
            >
              {/* Touch: tap the label / caret to toggle the menu (hover
                  can't). Empty on fine pointers, where hover/focus drive
                  it. */}
              <span className={styles.monthLabel} {...monthTap.toggleProps}>
                {monthLabel(month)}
              </span>
              <span
                className={styles.monthCaret}
                aria-hidden="true"
                {...monthTap.toggleProps}
              >
                <Chevron size={14} />
              </span>
              <div
                className={`${styles.monthMenu} ${
                  monthMenu ? styles.monthMenuOpen : ''
                }`}
              >
                {months.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.monthItem} ${
                      m === month ? styles.monthItemOn : ''
                    }`}
                    onClick={() => pickMonth(m)}
                  >
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={styles.viewToggle}
              role="group"
              aria-label="Archive view"
            >
              <button
                type="button"
                className={`${styles.viewBtn} ${
                  view === 'list' ? styles.viewBtnOn : ''
                }`}
                aria-label="List view"
                aria-pressed={view === 'list'}
                onClick={() => pickView('list')}
              >
                {/* Bulleted list (dots + shorter lines) — three PLAIN
                    lines now belong to the nav hamburger alone. */}
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="4.6" y1="6" x2="4.7" y2="6" />
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="4.6" y1="12" x2="4.7" y2="12" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="4.6" y1="18" x2="4.7" y2="18" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${
                  view === 'cal' ? styles.viewBtnOn : ''
                }`}
                aria-label="Calendar view"
                aria-pressed={view === 'cal'}
                onClick={() => pickView('cal')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="16" height="16" rx="2" />
                  <line x1="4" y1="10" x2="20" y2="10" />
                  <line x1="9" y1="3" x2="9" y2="7" />
                  <line x1="15" y1="3" x2="15" y2="7" />
                </svg>
              </button>
            </div>
          </div>

          {view === 'cal' ? (
            <div className={styles.calWrap} ref={calWrapRef}>
              <div className={styles.calHead} aria-hidden="true">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className={styles.calGrid}>
                {Array.from({ length: calendar.lead }, (_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {calendar.cells.map(({ iso, day, open }) => {
                  if (!open) {
                    return (
                      <span key={iso} className={styles.calVoid}>
                        <span className={styles.calDay}>{day}</span>
                      </span>
                    );
                  }
                  const play = plays[iso];
                  const recipe = recipeFor(iso);
                  const target = dailyTargetFor(
                    recipe.difficulty,
                    recipe.twist
                  );
                  const tier = play
                    ? tierForRun({ score: play.score, target, won: play.won })
                    : null;
                  const on = iso === sel;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSel(iso)}
                      aria-current={on || undefined}
                      aria-label={`${longDate(iso)} — ${
                        play && tier
                          ? `${play.score} points, tier ${tier}`
                          : 'not played'
                      }`}
                      className={[
                        styles.calCell,
                        on ? styles.calCellOn : null,
                        !play ? styles.calCellOpen : null,
                        iso === today ? styles.calCellToday : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className={styles.calDay}>{day}</span>
                      {play && tier && (
                        <>
                          <span className={styles.calScore}>{play.score}</span>
                          <span
                            className={styles.calTier}
                            style={
                              {
                                '--tier-tone': TIER_TONE[tier],
                              } as React.CSSProperties
                            }
                          >
                            {tier}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className={styles.dateScroll} ref={scrollRef}>
            {dates.map(iso => {
              const play = plays[iso];
              const recipe = recipeFor(iso);
              // The twist shows on EVERY row that has one — played or
              // not — so a player knows what they're getting into
              // before starting a day.
              const twist = recipe.twist ? findChallenge(recipe.twist) : null;
              const target = dailyTargetFor(recipe.difficulty, recipe.twist);
              const tier = play
                ? tierForRun({ score: play.score, target, won: play.won })
                : null;
              const on = iso === sel;
              return (
                // Wrapper div (not a button): unplayed rows layer a
                // permanent Start link over the right edge, and
                // interactive elements can't nest inside a button.
                <div
                  key={iso}
                  className={`${styles.row} ${on ? styles.rowOn : ''}`}
                >
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => setSel(iso)}
                    aria-current={on || undefined}
                  >
                  <div className={styles.rowLeft}>
                    <span
                      className={[
                        styles.dayTile,
                        on ? styles.dayTileOn : null,
                        !on && !play ? styles.dayTileOpen : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {Number(iso.slice(8))}
                    </span>
                    <span className={styles.rowMeta}>
                      <span className={styles.rowWeekday}>
                        {weekdayOf(iso)}
                      </span>
                      <span className={styles.rowRecipe}>
                        <span
                          className={styles.rowDiff}
                          style={{ color: difficultyColors[recipe.difficulty] }}
                        >
                          {recipe.difficulty}
                        </span>
                        {twist && (
                          <>
                            <span className={styles.rowSep}>·</span>
                            <span className={styles.rowTwist}>
                              ✦ {twist.name}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </div>
                  <div className={styles.rowRight}>
                    {play && tier ? (
                      <>
                        <span className={styles.rowScore}>{play.score}</span>
                        <span
                          className={styles.tierBadge}
                          style={
                            {
                              '--tier-tone': TIER_TONE[tier],
                            } as React.CSSProperties
                          }
                        >
                          {tier}
                        </span>
                      </>
                    ) : // Unplayed: the score cell stays empty — the
                    // permanent Start link below overlays this edge.
                    null}
                  </div>
                  </button>
                  {!play && (
                    <Link to={`/daily/${iso}`} className={styles.rowStart}>
                      Start <TriangleRight size={10} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* ---- Selected day result ---- */}
        <div className={styles.detailPanel} ref={detailRef}>
          <div className={styles.detailHead}>
            <div className={styles.detailEyebrow}>
              {weekdayOf(sel)}, {longDate(sel)}
            </div>
            {/* Phone: icon toggles reveal the distribution / leaderboard
                one at a time (they're hidden inline here). The
                DeskStatsPanel chart-toggle pattern. ≥768 shows both
                sections below and renders no toggle. */}
            {isPhone && backend && (
              <div
                className={styles.detailToggle}
                role="group"
                aria-label="Show details"
              >
                <button
                  type="button"
                  className={`${styles.detailToggleBtn} ${
                    detailView === 'board' ? styles.detailToggleBtnOn : ''
                  }`}
                  aria-label="Leaderboard"
                  aria-pressed={detailView === 'board'}
                  onClick={() =>
                    setDetailView(v => (v === 'board' ? null : 'board'))
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                    <path d="M17 5h2a2 2 0 0 1-2 3" />
                    <path d="M7 5H5a2 2 0 0 0 2 3" />
                  </svg>
                </button>
                {bins.length > 0 && (
                  <button
                    type="button"
                    className={`${styles.detailToggleBtn} ${
                      detailView === 'dist' ? styles.detailToggleBtnOn : ''
                    }`}
                    aria-label="Score distribution"
                    aria-pressed={detailView === 'dist'}
                    onClick={() =>
                      setDetailView(v => (v === 'dist' ? null : 'dist'))
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="6" y1="20" x2="6" y2="11" />
                      <line x1="12" y1="20" x2="12" y2="5" />
                      <line x1="18" y1="20" x2="18" y2="14" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Result row — a full-width line below the head, so the score /
              rating and the "View full result" link sit on ONE line (the
              toggle rides the date line above, never stealing this row's
              width). */}
          {selPlay && selTier ? (
            <div className={styles.detailResult}>
              <span className={styles.detailScore}>{selPlay.score}</span>
              <span className={styles.detailTarget}>/ {selTarget}</span>
              <span
                className={styles.detailBadge}
                style={
                  { '--tier-tone': TIER_TONE[selTier] } as React.CSSProperties
                }
              >
                {selTier}
              </span>
              <Link to={`/daily/${sel}`} className={styles.detailLink}>
                View full result <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div
              className={`${styles.detailUnplayed} ${
                view === 'cal' ? styles.detailUnplayedCal : ''
              }`}
            >
              <span className={styles.detailNotPlayed}>Not played</span>
              <Link to={`/daily/${sel}`} className={styles.startBtn}>
                Start <TriangleRight size={11} />
              </Link>
            </div>
          )}

          {backend && (
            <div
              className={`${styles.rankStrip} ${
                selPlay ? styles.rankStrip3 : styles.rankStrip2
              }`}
            >
              {selPlay && (
                <div className={styles.rankCard}>
                  <div className={styles.rankValue}>
                    {rank.data ? `#${rank.data.rank}` : '—'}
                  </div>
                  <div className={styles.rankLabel}>
                    {isPhone ? 'You' : 'Your rank'}
                  </div>
                </div>
              )}
              <div className={styles.rankCard}>
                <div className={styles.rankValue}>
                  {stats.data?.winRatePct != null
                    ? `${stats.data.winRatePct}%`
                    : '—'}
                </div>
                <div className={styles.rankLabel}>
                  {isPhone ? 'Won' : 'Beat target'}
                </div>
              </div>
              <div className={styles.rankCard}>
                <div className={styles.rankValue}>
                  {stats.data ? stats.data.total : '—'}
                </div>
                <div className={styles.rankLabel}>Players</div>
              </div>
            </div>
          )}

          {backend && bins.length > 0 && (!isPhone || detailView === 'dist') && (
            <div className={styles.histSection}>
              <div className={styles.sectionTitle}>Score distribution</div>
              <div className={styles.histBars}>
                {bins.map((b, i) => {
                  const isOwn = own !== undefined && own >= b.lo && own <= b.hi;
                  return (
                    <div
                      key={i}
                      className={styles.histSlot}
                      title={`${b.lo}–${b.hi}: ${b.count}${isOwn ? ' · you' : ''}`}
                    >
                      <div
                        className={`${styles.histBar} ${
                          isOwn ? styles.histBarOwn : ''
                        }`}
                        style={{
                          height: `${Math.max(6, (binCount(b) / maxCount) * 100)}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className={styles.histEdges}>
                {[...bins.map(b => b.lo), bins[bins.length - 1].hi].map(
                  (edge, i) => (
                    <span key={i}>{edge}</span>
                  )
                )}
              </div>
              <div className={styles.histLegend}>
                {selPlay && (
                  <span className={styles.legendYou}>
                    <span className={styles.legendSwatchOwn} aria-hidden="true" />
                    You · {selPlay.score}
                  </span>
                )}
                <span className={styles.legendField}>
                  <span className={styles.legendSwatch} aria-hidden="true" />
                  Field
                </span>
              </div>
            </div>
          )}

          {backend && (!isPhone || detailView === 'board') && (
            <div className={styles.leadersSection}>
              <div className={styles.sectionTitle}>Leaderboard</div>
              {top5.length === 0 ? (
                <span className={styles.emptyNote}>
                  {stats.isLoading
                    ? 'Loading…'
                    : stats.isError
                      ? 'Leaderboard unavailable right now.'
                      : 'No scores posted yet — go first.'}
                </span>
              ) : (
                <>
                  {top5.map(t => (
                    <div
                      key={`${t.rank}-${t.displayName}`}
                      className={`${styles.leaderRow} ${
                        t.isOwn ? styles.leaderOwn : ''
                      }`}
                    >
                      <span className={styles.leaderName}>
                        {t.rank}&nbsp;&nbsp;&nbsp;{t.displayName}
                      </span>
                      <span className={styles.leaderScore}>{t.score}</span>
                    </div>
                  ))}
                  {ownRow && (
                    <div className={`${styles.leaderRow} ${styles.leaderOwn}`}>
                      <span className={styles.leaderName}>
                        #{ownRow.rank}&nbsp;&nbsp;&nbsp;{ownRow.displayName}
                      </span>
                      <span className={styles.leaderScore}>{ownRow.score}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
