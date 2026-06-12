import { useState } from 'react';
import { Button, Sheet, useToast } from '../../design/primitives';
import {
  HandleInvalidError,
  HandleTakenError,
  isBackendConfigured,
  setHandleRemote,
} from '../../lib/supabaseRpc';
import { getOrCreateDeviceId } from './sync/deviceId';
import { useQueueStore } from './sync/queue';
import { drainQueue } from './sync/sync';
import {
  useDailyHistogram,
  useDailyRank,
  useDailyStats,
} from './sync/useDailyRank';
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
        <span className={styles.date}>{dateISO}</span>
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
      />
    </section>
  );
}

function DayStatsSheet({
  dateISO,
  open,
  onClose,
}: {
  dateISO: string;
  open: boolean;
  onClose: () => void;
}) {
  const stats = useDailyStats(dateISO, open);
  const histo = useDailyHistogram(dateISO, open);
  const maxCount = Math.max(1, ...(histo.data?.bins.map(b => b.count) ?? []));

  return (
    <Sheet open={open} onClose={onClose} title={`Leaderboard — ${dateISO}`}>
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
            <div className={styles.histo}>
              {histo.data.bins.map((b, i) => (
                <div
                  key={i}
                  className={styles.histoBar}
                  style={{ height: `${(b.count / maxCount) * 100}%` }}
                  title={`${b.lo}–${b.hi}: ${b.count}`}
                />
              ))}
            </div>
            <div className={styles.histoLabels}>
              <span>{histo.data.min}</span>
              <span>median {histo.data.median ?? '—'}</span>
              <span>{histo.data.max}</span>
            </div>
          </div>
        )}

        {stats.data && stats.data.topScores.length > 0 && (
          <div>
            <h3 className="text-section">Top scores</h3>
            {stats.data.topScores.map(t => (
              <div
                key={`${t.rank}-${t.displayName}`}
                className={`${styles.topRow} ${t.isOwn ? styles.own : ''}`}
              >
                <span>#{t.rank}</span>
                <span>{t.displayName}</span>
                <span>{t.score}</span>
              </div>
            ))}
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

        <HandleEditor />
      </div>
    </Sheet>
  );
}

const KEY_HANDLE = 'pokergrid:daily:handle';

function HandleEditor() {
  const { toast } = useToast();
  const [handle, setHandle] = useState(
    () => localStorage.getItem(KEY_HANDLE) ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = handle.trim();
      await setHandleRemote(getOrCreateDeviceId(), trimmed || null);
      if (trimmed) localStorage.setItem(KEY_HANDLE, trimmed);
      else localStorage.removeItem(KEY_HANDLE);
      toast('Leaderboard name saved.', 'success');
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
      <h3 className="text-section">Leaderboard name</h3>
      <div className={styles.handleRow}>
        <input
          className={styles.handleInput}
          value={handle}
          maxLength={20}
          placeholder="Anonymous"
          aria-label="Leaderboard name"
          onChange={e => setHandle(e.target.value)}
        />
        <Button size="sm" variant="secondary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error ? (
        <span className={`${styles.handleNote} ${styles.error}`}>{error}</span>
      ) : (
        <span className={styles.handleNote}>
          Shown on the top-scores list. Leave empty to stay anonymous.
        </span>
      )}
    </div>
  );
}
