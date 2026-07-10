import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import { useToast } from '../../../design/primitives';
import { buildShareUrl, shareUrl } from '../../../lib/share';
import { isBackendConfigured } from '../../../lib/supabaseRpc';
import { useGameSession } from '../GameSessionProvider';
import { useRecordResult } from '../../progress/useRecordResult';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { HandleEditor } from '../../daily/RankPanel';
import { KEY_HANDLE } from '../../daily/sync/deviceId';
import { HAND_LABEL } from '../handLabels';
import { TIER_RULES } from './TierBreakdownSheet';
import styles from './DesktopResultDialog.module.css';

export interface DesktopResultDialogProps {
  /** Scrim visible? The component itself stays mounted from the moment
   *  the game ends so its one-shot recording effects always run. */
  open: boolean;
  /** "View Grid" — close the dialog, revealing the finished board. */
  onViewGrid: () => void;
  /** Free play: start a fresh run (daily routes to the archive). */
  onReplay: () => void;
}

const tierLabel = (tier: string): string =>
  TIER_RULES.find(r => r.tier === tier)?.label ?? '';

/**
 * The ≥1024px game-over overlay (mockup lines 228–260): the finished
 * three-column view stays behind an ink scrim while a compact verdict
 * card takes the middle — gradient header with the tier letter, the
 * score against its target, three stat rows, the daily handle claim,
 * and Play Again / View Grid. Owns the SAME result-recording side
 * effects ResultView runs on mobile (stats, achievements, the daily
 * submit) — it is the desktop result surface, not just a skin.
 */
export function DesktopResultDialog({
  open,
  onViewGrid,
  onReplay,
}: DesktopResultDialogProps) {
  const { state, mode, seed } = useGameSession();
  const { toast } = useToast();

  const { report, shapley } = useMemo(() => {
    const options = {
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
      handBoost: state.handBoost,
    };
    return {
      report: scoreGrid(state.grid, state.bonusCards, options),
      shapley: bonusShapleyValues(state.grid, state.bonusCards, options),
    };
  }, [state]);

  const { won, tier, newAchievements } = useRecordResult(report, shapley);

  // Daily: save locally, then queue-first submit (mirrors ResultView).
  const dailyRecordedRef = useRef(false);
  useEffect(() => {
    if (mode.kind !== 'daily' || dailyRecordedRef.current) return;
    dailyRecordedRef.current = true;
    recordDailyCompletion(mode.dateISO, mode.recipe, state, report.total, won);
  }, [mode, state, report.total, won]);

  // Esc = View Grid (the dialog's only dismissal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onViewGrid();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onViewGrid]);

  const isDaily = mode.kind === 'daily';
  const [hasHandle, setHasHandle] = useState(
    () => !!localStorage.getItem(KEY_HANDLE)
  );

  const scoredLines = report.lines.filter(
    l => l.hand && l.hand !== 'HIGH_CARD'
  ).length;
  const best = report.lines.reduce(
    (b, l) => (b === null || l.total > b.total ? l : b),
    null as (typeof report.lines)[number] | null
  );

  const onShare = async () => {
    const url = buildShareUrl({
      score: report.total,
      mode: isDaily ? 'daily' : 'free',
      difficulty: state.difficulty,
      grid: state.grid,
      dateISO: isDaily && mode.kind === 'daily' ? mode.dateISO : undefined,
      seed: !isDaily ? seed : undefined,
    });
    const result = await shareUrl(url, `PokerGrid — ${report.total} points`);
    if (result.outcome === 'copied') toast('Link copied.', 'success');
    else if (result.outcome === 'failed') toast('Could not share.', 'danger');
  };

  if (!open) return null;

  return (
    <div className={styles.scrim}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Game result"
      >
        <div className={`${styles.head} ${won ? styles.headWin : styles.headLoss}`}>
          <span className={styles.verdict}>
            {won ? 'Target cleared' : 'Just short'}
          </span>
          <span className={styles.tier}>{tier}</span>
          <span className={styles.tierLabel}>{tierLabel(tier)}</span>
        </div>
        <div className={styles.body}>
          <div className={styles.scoreRow}>
            <span className={styles.score} data-testid="final-score">
              {report.total}
            </span>
            <span className={styles.target}>/ {state.target}</span>
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Lines scored</span>
              <span className={styles.rowValue}>{scoredLines} / 10</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Incomplete-line penalty</span>
              <span className={`${styles.rowValue} ${styles.rowDanger}`}>
                {report.incompletePenalty === 0
                  ? '0'
                  : String(report.incompletePenalty)}
              </span>
            </div>
            <div className={`${styles.row} ${styles.rowLast}`}>
              <span className={styles.rowLabel}>Best line</span>
              <span className={styles.rowValue}>
                {best?.hand ? HAND_LABEL[best.hand] : '—'}
              </span>
            </div>
          </div>
          {newAchievements.length > 0 && (
            <p className={styles.achievements} role="status">
              🏆 {newAchievements.map(a => a.name).join(' · ')}
            </p>
          )}
          {isDaily &&
            isBackendConfigured() &&
            (hasHandle ? (
              <div className={styles.posted}>
                <span aria-hidden="true">✓</span>
                Posted as {localStorage.getItem(KEY_HANDLE)}
              </div>
            ) : (
              <div className={styles.claim}>
                <span className={styles.claimTitle}>
                  Claim your spot on the leaderboard
                </span>
                <span className={styles.claimSub}>
                  Pick a handle to post this score and track your daily
                  streak.
                </span>
                <HandleEditor
                  heading={null}
                  onSaved={handle => setHasHandle(handle !== null)}
                />
              </div>
            ))}
          <div className={styles.footer}>
            {isDaily ? (
              <Link to="/daily/archive" className={styles.primaryBtn}>
                Play Again
              </Link>
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={onReplay}
              >
                Play Again
              </button>
            )}
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onViewGrid}
            >
              View Grid
            </button>
          </div>
          <div className={styles.shareRow}>
            <button type="button" className={styles.shareLink} onClick={onShare}>
              Share result
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
