import { ReactNode, useState } from 'react';
import { Button, Sheet, useToast } from '../../design/primitives';
import {
  HandleInvalidError,
  HandleTakenError,
  isBackendConfigured,
  setHandleRemote,
  type TopScoreEntry,
} from '../../lib/supabaseRpc';
import { getOrCreateDeviceId } from './sync/deviceId';
import { getLocalHandle, setLocalHandle, useHandle } from './sync/handleStore';
import { usePlaysStore } from './sync/playsStore';
import { useQueueStore } from './sync/queue';
import { drainQueue, refreshDailyNames } from './sync/sync';
import {
  useArchiveRank,
  useDailyHistogram,
  useDailyRank,
  useDailyStats,
} from './sync/useDailyRank';
import { formatDailyDate } from './dailyDates';
import styles from './RankPanel.module.css';

/**
 * Leaderboard standing for one date as a slim bar — rank on the left,
 * the date in the middle, Day stats on the right; the day's stats
 * (median, win rate, top 10, score histogram) and the handle editor
 * live behind the sheet. Queue-aware: while this device's play is
 * still pending it shows a retryable "submitting" state instead of
 * hanging.
 */
export function RankPanel({ dateISO }: { dateISO: string }) {
  const rank = useDailyRank(dateISO);
  const pending = useQueueStore(s =>
    s.pending.some(p => p.dateISO === dateISO)
  );
  const [statsOpen, setStatsOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // No leaderboard backend (local builds): the bar still owns showing
  // the date, since the verdict hero no longer carries it.
  if (!isBackendConfigured()) {
    return (
      <section className={styles.panel} aria-label="Daily date">
        <span className={styles.date}>{formatDailyDate(dateISO)}</span>
      </section>
    );
  }

  const retry = async () => {
    setRetrying(true);
    try {
      await drainQueue();
      await rank.refetch();
    } finally {
      setRetrying(false);
    }
  };

  const standing = rank.data ? (
    <span className={styles.rank}>
      #{rank.data.rank} <span className={styles.sub}>of {rank.data.total}</span>
    </span>
  ) : pending ? (
    <span className={styles.statusRow}>
      <span
        className={styles.status}
        role="status"
        aria-label="Score saved — submitting to the leaderboard"
      >
        Submitting…
      </span>
      <Button size="sm" variant="secondary" disabled={retrying} onClick={retry}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </span>
  ) : rank.isError ? (
    <span className={styles.statusRow}>
      <span className={`${styles.status} ${styles.error}`} role="status">
        No connection.
      </span>
      <Button size="sm" variant="secondary" disabled={retrying} onClick={retry}>
        Retry
      </Button>
    </span>
  ) : rank.isLoading ? (
    <span className={styles.status}>Fetching rank…</span>
  ) : (
    <span className={styles.status}>Rank pending…</span>
  );

  return (
    <section className={styles.panel} aria-label="Leaderboard">
      {standing}
      <Button size="sm" variant="ghost" onClick={() => setStatsOpen(true)}>
        <svg
          className={styles.podium}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <rect x="1" y="9" width="4" height="6" />
          <rect x="6" y="4" width="4" height="11" />
          <rect x="11" y="11" width="4" height="4" />
        </svg>
        Leaderboard
      </Button>

      <DayStatsSheet
        dateISO={dateISO}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        ownScore={rank.data?.score}
      />
    </section>
  );
}

/**
 * Compact leaderboard presence for the result hero's top-right corner:
 * a podium icon button (opens the day-stats sheet) sitting to the left
 * of the hero's ⓘ button (passed as children), with the standing on
 * its own line beneath. Backendless builds render just the children —
 * there is no leaderboard to link to.
 */
export function RankCorner({
  dateISO,
  children,
}: {
  dateISO: string;
  /** The hero's own corner controls (the ⓘ details button). */
  children?: ReactNode;
}) {
  const rank = useDailyRank(dateISO);
  const pending = useQueueStore(s =>
    s.pending.some(p => p.dateISO === dateISO)
  );
  const [statsOpen, setStatsOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!isBackendConfigured()) return <>{children}</>;

  const retry = async () => {
    setRetrying(true);
    try {
      await drainQueue();
      await rank.refetch();
    } finally {
      setRetrying(false);
    }
  };

  // Just the placement — "rank / total" — as the corner's leaderboard
  // presence (the old podium-icon link read as clunky leftover chrome).
  // Still tappable to open the day stats, but it reads as a plain
  // standing, not a button.
  const standing = rank.data ? (
    <button
      type="button"
      className={styles.cornerRank}
      aria-label={`Ranked ${rank.data.rank} of ${rank.data.total} — open the leaderboard`}
      onClick={() => setStatsOpen(true)}
    >
      {rank.data.rank}
      <span className={styles.sub}>/{rank.data.total}</span>
    </button>
  ) : pending || rank.isError ? (
    <button
      type="button"
      className={`${styles.cornerStatus} ${styles.cornerRetry} ${
        rank.isError && !pending ? styles.error : ''
      }`}
      disabled={retrying}
      onClick={retry}
    >
      {retrying
        ? 'Retrying…'
        : pending
          ? 'Submitting… · retry'
          : 'No connection · retry'}
    </button>
  ) : (
    <span className={styles.cornerStatus}>
      {rank.isLoading ? 'Fetching rank…' : 'Rank pending…'}
    </span>
  );

  return (
    <>
      <span className={styles.cornerIcons}>{children}</span>
      {standing}

      <DayStatsSheet
        dateISO={dateISO}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        ownScore={rank.data?.score}
      />
    </>
  );
}

/**
 * The leaderboard popup for one date — day stats, distribution, top
 * scores. Owned by the rank bar/corner, and openable directly from an
 * archive row's score cell.
 */
export function DayStatsSheet({
  dateISO,
  open,
  onClose,
  ownScore,
}: {
  dateISO: string;
  open: boolean;
  onClose: () => void;
  /** The player's submitted score for the date (from the rank RPC) —
   *  used to highlight their band in the distribution. */
  ownScore?: number;
}) {
  const stats = useDailyStats(dateISO, open);
  const histo = useDailyHistogram(dateISO, open);
  const maxCount = Math.max(1, ...(histo.data?.bins.map(b => b.count) ?? []));
  // The local play is authoritative even while the rank RPC is pending.
  const localScore = usePlaysStore(s => s.plays[dateISO]?.score);
  const own = localScore ?? ownScore;
  // Own standing (shared cache with the rank corner/bar — no extra
  // fetch in practice); fills in the player's row when they're outside
  // the fetched top list entirely.
  const ownRank = useArchiveRank(dateISO);
  // The handle editor shows only until a name is saved — changing it
  // later lives in Settings → More. Reactive, so a save (here or in the
  // desktop result dialog) retires the editor and renames the own row
  // immediately.
  const savedHandle = useHandle();

  // Top 5, plus the player's own row when they didn't make the cut:
  // taken from the fetched list when it reaches that far (real server
  // display name), otherwise rebuilt from the rank RPC + local handle.
  const top = stats.data?.topScores ?? [];
  const top5 = top.slice(0, 5);
  const ownRow: TopScoreEntry | null = top5.some(t => t.isOwn)
    ? null
    : (top.find(t => t.isOwn) ??
      (ownRank.data
        ? {
            rank: ownRank.data.rank,
            displayName: savedHandle ?? 'Anonymous',
            score: ownRank.data.score,
            isOwn: true,
          }
        : null));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Leaderboard — ${formatDailyDate(dateISO)}`}
    >
      <div className={styles.statsBody}>
        <div className={styles.statChips}>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{stats.data?.total ?? '—'}</span>
            <span className={styles.statLabel}>Players</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statValue}>{stats.data?.median ?? '—'}</span>
            <span className={styles.statLabel}>Median</span>
          </div>
          <div className={styles.statChip}>
            <span className={styles.statValue}>
              {stats.data?.winRatePct != null ? `${stats.data.winRatePct}%` : '—'}
            </span>
            <span className={styles.statLabel}>Beat target</span>
          </div>
        </div>

        {histo.data && histo.data.bins.length > 0 && (
          <div>
            <h3 className="text-section">Score distribution</h3>
            {/* Always 8 bands, width adapted to the day's spread (50s,
                falling back to 100s/150s — daily_histogram_bands.sql);
                zero-count bands render as empty slots on the axis so
                gaps read truthfully. Solo days come back binless and
                the whole section hides. */}
            <div className={styles.histo}>
              {histo.data.bins.map((b, i) => {
                // "Green = you", matching the own-row highlight in the
                // Top Scores list; the rest of the field mutes to a
                // neutral once the player's band is known.
                const isOwn = own !== undefined && own >= b.lo && own <= b.hi;
                const muted = own !== undefined && !isOwn;
                return (
                  <div
                    key={i}
                    className={styles.histoSlot}
                    title={`${b.lo}–${b.hi}: ${b.count}${isOwn ? ' · you' : ''}`}
                  >
                    {b.count > 0 && (
                      <div
                        className={`${styles.histoBar} ${
                          isOwn
                            ? styles.histoBarOwn
                            : muted
                              ? styles.histoBarMuted
                              : ''
                        }`}
                        style={{ height: `${(b.count / maxCount) * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className={styles.histoLabels}>
              {histo.data.bins.map((b, i) => (
                <span key={i} className={styles.histoTick}>
                  {histo.data!.bins.length <= 6 || i % 2 === 0 ? b.lo : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {top5.length > 0 && (
          <div>
            <h3 className="text-section">Top scores</h3>
            {/* One grid for the whole table (rows are subgrids), so
                the rank/name/score columns align across rows while
                still hugging their content. */}
            <div className={styles.topTable}>
              {top5.map(t => (
                <div
                  key={`${t.rank}-${t.displayName}`}
                  className={`${styles.topRow} ${t.isOwn ? styles.own : ''}`}
                >
                  <span>#{t.rank}</span>
                  <span>{t.displayName}</span>
                  <span>{t.score}</span>
                </div>
              ))}
              {ownRow && (
                <>
                  {ownRow.rank > top5.length + 1 && (
                    <div className={styles.topGap} aria-hidden="true">
                      ⋯
                    </div>
                  )}
                  <div className={`${styles.topRow} ${styles.own}`}>
                    <span>#{ownRow.rank}</span>
                    <span>{ownRow.displayName}</span>
                    <span>{ownRow.score}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {(stats.isLoading || histo.isLoading) && (
          <span className={styles.status}>Loading day stats…</span>
        )}
        {stats.isError && (
          <span className={`${styles.status} ${styles.error}`}>
            Couldn&apos;t load day stats.
          </span>
        )}

        {/* First-time naming only — once saved, the box retires from
            this sheet (rename lives in Settings → More). */}
        {!savedHandle && <HandleEditor />}
      </div>
    </Sheet>
  );
}

/**
 * Screen-name editor for the daily leaderboard. Lives in the stats
 * sheet until a name is first saved; afterwards Settings → More is
 * the place to change it (heading=null renders it bare for that row).
 */
export function HandleEditor({
  heading = 'Screen name',
  note = true,
  onSaved,
}: {
  /** Section heading; null renders the editor without one. */
  heading?: string | null;
  /** The explanatory note under the input — hosts whose row already
   *  explains the handle (phone Settings' ⓘ) pass false. Errors always
   *  render regardless. */
  note?: boolean;
  /** Called after a successful save with the new handle (null = cleared). */
  onSaved?: (handle: string | null) => void;
} = {}) {
  const { toast } = useToast();
  const [handle, setHandle] = useState(() => getLocalHandle() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = handle.trim();
      await setHandleRemote(getOrCreateDeviceId(), trimmed || null);
      // Local write is reactive (every synthesized own row renames at
      // once); the invalidation refetches the server-side lists, whose
      // display names the rename RPC just updated for ALL past scores.
      setLocalHandle(trimmed || null);
      refreshDailyNames();
      toast('Screen name saved.', 'success');
      onSaved?.(trimmed || null);
    } catch (e) {
      if (e instanceof HandleTakenError) {
        setError('That name is taken — try another.');
      } else if (e instanceof HandleInvalidError) {
        setError(e.message);
      } else {
        setError('Could not save the name. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {heading && <h3 className="text-section">{heading}</h3>}
      <div className={styles.handleRow}>
        <input
          className={styles.handleInput}
          value={handle}
          maxLength={20}
          placeholder="Anonymous"
          aria-label="Screen name"
          onChange={e => setHandle(e.target.value)}
        />
        <Button size="sm" variant="secondary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error ? (
        <span className={`${styles.handleNote} ${styles.error}`}>{error}</span>
      ) : note ? (
        <span className={styles.handleNote}>
          Shown on the top-scores list. Leave empty to stay anonymous.
        </span>
      ) : null}
    </div>
  );
}
