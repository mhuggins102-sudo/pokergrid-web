import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { Tier, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { isBackendConfigured, type TopScoreEntry } from '../../lib/supabaseRpc';
import { DAILY_LAUNCH_ISO, dayMs, toISO, toUTC } from './dailyDates';
import { usePlaysStore } from './sync/playsStore';
import {
  useArchiveRank,
  useDailyHistogram,
  useDailyStats,
} from './sync/useDailyRank';
import { useHandle } from './sync/handleStore';
import styles from './DailyArchiveDesk.module.css';

/*
 * The ≥1024px daily archive, per design-refs/desktop/Daily
 * Archive.dc.html: a month-selectable scrolling day list on the left
 * (score + tier badge for played days, Start for missed ones) and the
 * selected day's result on the right — rank strip, score
 * distribution, and the top of the board — all bound to the real
 * playsStore / daily RPCs. Rendered only by DailyArchivePage's
 * desktop fork.
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

const longDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAME[m - 1]} ${d}, ${y}`;
};

export function DailyArchiveDesk() {
  const plays = usePlaysStore(s => s.plays);
  const backend = isBackendConfigured();
  // Reactive — a rename elsewhere updates the synthesized own row.
  const handle = useHandle();
  const today = currentDateISO();
  const months = useMemo(() => publishedMonths(today), [today]);
  const [month, setMonth] = useState(() => monthOf(today));
  const [sel, setSel] = useState(today);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);

  const dates = useMemo(() => monthDates(month, today), [month, today]);

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
  }, []);

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
    setMonthMenuOpen(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Daily · Archive</div>
      <h1 className={styles.pageTitle}>Past puzzles</h1>

      <div className={styles.columns}>
        {/* ---- Archive list ---- */}
        <div className={styles.listPanel}>
          <div
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
            <span className={styles.monthLabel}>{monthLabel(month)}</span>
            <span className={styles.monthCaret} aria-hidden="true">
              ▾
            </span>
            <div
              className={`${styles.monthMenu} ${
                monthMenuOpen ? styles.monthMenuOpen : ''
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
                // hover/focus-revealed Start link over the right edge,
                // and interactive elements can't nest inside a button.
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
                    ) : (
                      // Unplayed: a quiet dash where the score would
                      // be; hovering (or focusing) the row swaps in the
                      // Start shortcut below.
                      <span className={styles.rowDash} aria-hidden="true">
                        –
                      </span>
                    )}
                  </div>
                  </button>
                  {!play && (
                    <Link to={`/daily/${iso}`} className={styles.rowStart}>
                      Start ▸
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Selected day result ---- */}
        <div className={styles.detailPanel} ref={detailRef}>
          <div className={styles.detailHead}>
            <div>
              <div className={styles.detailEyebrow}>
                {weekdayOf(sel)}, {longDate(sel)}
              </div>
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
                    View full result →
                  </Link>
                </div>
              ) : (
                <div className={styles.detailUnplayed}>
                  <span className={styles.detailNotPlayed}>Not played</span>
                  <Link to={`/daily/${sel}`} className={styles.startBtn}>
                    Start ▸
                  </Link>
                </div>
              )}
            </div>
          </div>

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
                  <div className={styles.rankLabel}>Your rank</div>
                </div>
              )}
              <div className={styles.rankCard}>
                <div className={styles.rankValue}>
                  {stats.data?.winRatePct != null
                    ? `${stats.data.winRatePct}%`
                    : '—'}
                </div>
                <div className={styles.rankLabel}>Beat target</div>
              </div>
              <div className={styles.rankCard}>
                <div className={styles.rankValue}>
                  {stats.data ? stats.data.total : '—'}
                </div>
                <div className={styles.rankLabel}>Players</div>
              </div>
            </div>
          )}

          {backend && bins.length > 0 && (
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

          {backend && (
            <div className={styles.leadersSection}>
              <div className={styles.sectionTitle}>Top of the board</div>
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
