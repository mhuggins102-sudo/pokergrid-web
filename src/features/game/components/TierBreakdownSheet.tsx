import { Fragment } from 'react';
import { Sheet } from '../../../design/primitives';
import { Tier } from '../../../lib/stats';
import styles from './TierBreakdownSheet.module.css';

// Tier rules — mirrors tierForRun() in lib/stats.ts: win bands use
// score / target ratio, loss bands compare to the same target. Port of
// the original TierBreakdownModal.
const TIER_RULES: ReadonlyArray<{
  tier: Tier;
  label: string;
  ratio: number;
  won: boolean;
}> = [
  { tier: 'SS', label: 'Perfect', ratio: 1.6, won: true },
  { tier: 'S', label: 'Strong win', ratio: 1.3, won: true },
  { tier: 'A', label: 'Win', ratio: 1.0, won: true },
  { tier: 'B', label: 'Close', ratio: 0.85, won: false },
  { tier: 'C', label: 'Missed', ratio: 0.5, won: false },
  { tier: 'D', label: 'Far miss', ratio: 0, won: false },
];

// Per-tier Targets-Up rewards — shown only in that mode.
const TU_REWARDS: Partial<Record<Tier, string>> = {
  SS: '1 bonus + 1 grid supercharge',
  S: '1 supercharge (bonus or grid)',
  A: 'Advance · no reward',
};

const thresholdFor = (
  rule: (typeof TIER_RULES)[number],
  target: number
): number => (rule.ratio === 0 ? 0 : Math.ceil(target * rule.ratio));

const requirementFor = (
  rule: (typeof TIER_RULES)[number],
  target: number
): string => {
  if (rule.ratio === 0) return `below ${Math.ceil(target * 0.5)}`;
  return `${thresholdFor(rule, target)}+`;
};

export interface TierBreakdownSheetProps {
  open: boolean;
  onClose: () => void;
  target: number;
  /** Targets-Up adds its per-tier reward column. */
  showRewards?: boolean;
  /** Result screens: slot a "your score" row between the tiers it
   *  landed between, so the distance to the next band is visible. */
  score?: number;
}

/**
 * What each result tier requires for this run's target — opens from a
 * tap on the score (live in-game, or final on the result screens).
 */
export function TierBreakdownSheet({
  open,
  onClose,
  target,
  showRewards = false,
  score,
}: TierBreakdownSheetProps) {
  // Your-score row goes above the first tier whose threshold you met.
  const scoreRowBefore =
    score === undefined
      ? -1
      : TIER_RULES.findIndex(rule => thresholdFor(rule, target) <= score);

  const yourRow =
    score !== undefined ? (
      <div className={`${styles.row} ${styles.you}`}>
        <span className={styles.tier} aria-hidden="true">
          →
        </span>
        <span className={styles.label}>Your score</span>
        <span className={styles.req}>{score}</span>
        {showRewards && <span className={styles.reward} />}
      </div>
    ) : null;

  return (
    <Sheet open={open} onClose={onClose} title="Score tiers">
      <div className={styles.list}>
        <p className={styles.targetLine}>
          Target: <strong>{target}</strong>
        </p>
        {TIER_RULES.map((rule, i) => (
          <Fragment key={rule.tier}>
            {i === scoreRowBefore && yourRow}
            <div
              className={`${styles.row} ${rule.won ? styles.win : styles.loss}`}
            >
              <span className={styles.tier}>{rule.tier}</span>
              <span className={styles.label}>{rule.label}</span>
              <span className={styles.req}>{requirementFor(rule, target)}</span>
              {showRewards && (
                <span className={styles.reward}>
                  {TU_REWARDS[rule.tier] ?? '—'}
                </span>
              )}
            </div>
          </Fragment>
        ))}
        {score !== undefined && scoreRowBefore === -1 && yourRow}
        <p className={styles.note}>
          Win tiers compare your score to the target; B–D grade how close a
          missed run came.
        </p>
      </div>
    </Sheet>
  );
}
