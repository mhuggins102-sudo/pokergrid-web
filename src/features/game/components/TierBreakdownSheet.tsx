import { Sheet } from '../../../design/primitives';
import { Tier } from '../../../lib/stats';
import { useGameSession } from '../GameSessionProvider';
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

const requirementFor = (
  rule: (typeof TIER_RULES)[number],
  target: number
): string => {
  if (rule.ratio === 0) return `below ${Math.ceil(target * 0.5)}`;
  return `${Math.ceil(target * rule.ratio)}+`;
};

export interface TierBreakdownSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * What each result tier requires for this run's target — opens from a
 * tap on the live score. Targets-Up adds its per-tier reward column.
 */
export function TierBreakdownSheet({ open, onClose }: TierBreakdownSheetProps) {
  const { state, mode } = useGameSession();
  const showRewards = mode.kind === 'targets';

  return (
    <Sheet open={open} onClose={onClose} title="Score tiers">
      <div className={styles.list}>
        <p className={styles.targetLine}>
          Target: <strong>{state.target}</strong>
        </p>
        {TIER_RULES.map(rule => (
          <div
            key={rule.tier}
            className={`${styles.row} ${rule.won ? styles.win : styles.loss}`}
          >
            <span className={styles.tier}>{rule.tier}</span>
            <span className={styles.label}>{rule.label}</span>
            <span className={styles.req}>{requirementFor(rule, state.target)}</span>
            {showRewards && (
              <span className={styles.reward}>{TU_REWARDS[rule.tier] ?? '—'}</span>
            )}
          </div>
        ))}
        <p className={styles.note}>
          Win tiers compare your score to the target; B–D grade how close a
          missed run came.
        </p>
      </div>
    </Sheet>
  );
}
