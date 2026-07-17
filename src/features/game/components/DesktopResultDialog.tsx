import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { bonusShapleyValues, scoreGrid } from '../../../game/scoring';
import type { Achievement } from '../../../game/achievements';
import { Sheet, useToast } from '../../../design/primitives';
import { buildShareUrl, shareUrl } from '../../../lib/share';
import { isBackendConfigured } from '../../../lib/supabaseRpc';
import { useGameSession } from '../GameSessionProvider';
import { useGameFamily } from '../useGameFamily';
import { useRecordResult } from '../../progress/useRecordResult';
import { useLevelUp, useXpEarned } from '../../progress/usePlayerLevel';
import { useTargetsResult } from '../useTargetsResult';
import { recordDailyCompletion } from '../../daily/sync/sync';
import { HandleEditor, RankPanel } from '../../daily/RankPanel';
import { useHandle } from '../../daily/sync/handleStore';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { TIER_RULES } from './TierBreakdownSheet';
import styles from './DesktopResultDialog.module.css';

export interface DesktopResultDialogProps {
  /** Scrim visible? The component itself stays mounted from the moment
   *  the game ends so its one-shot recording effects always run. */
  open: boolean;
  /** "View Grid" — close the dialog, revealing the finished board. */
  onViewGrid: () => void;
  /** Free play / challenge: restart this run. Targets Up: remount the
   *  run page, which re-reads the (advanced or cleared) ladder save.
   *  Daily routes to the archive instead. */
  onReplay: () => void;
}

const tierLabel = (tier: string): string =>
  TIER_RULES.find(r => r.tier === tier)?.label ?? '';

/**
 * The ≥1024px game-over overlay (mockup lines 228–260): the finished
 * three-column view stays behind an ink scrim while a compact verdict
 * card takes the middle — gradient header with the tier letter, the
 * score against its target, the score math, the daily handle claim,
 * and the mode's continue actions. Owns the SAME result-recording side
 * effects ResultView runs on mobile (stats, achievements, the daily
 * submit, the Targets-Up ladder advance) — it is the desktop result
 * surface, not just a skin.
 */
export function DesktopResultDialog({
  open,
  onViewGrid,
  onReplay,
}: DesktopResultDialogProps) {
  const { state, mode, setup, seed, viewOnly } = useGameSession();
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
  const levelUp = useLevelUp(viewOnly);
  // XP this run earned, split by source (null in the archive view).
  const xpEarned = useXpEarned(viewOnly);
  const [xpOpen, setXpOpen] = useState(false);
  // Targets-Up ladder lifecycle — the hook shared with mobile's
  // ResultView; its module-level guard keeps the advance/clear commit
  // single-owner even if both surfaces mount across a resize.
  const targetsFlow = useTargetsResult(won, tier);
  // Tapped just-earned achievement → explainer sheet (mobile parity).
  const [achInfo, setAchInfo] = useState<Achievement | null>(null);

  // Daily: save locally, then queue-first submit (mirrors ResultView).
  // Never for a re-hydrated archive view — that play is already saved.
  const dailyRecordedRef = useRef(false);
  useEffect(() => {
    if (mode.kind !== 'daily' || dailyRecordedRef.current || viewOnly) return;
    dailyRecordedRef.current = true;
    recordDailyCompletion(mode.dateISO, mode.recipe, state, report.total, won);
  }, [mode, state, report.total, won, viewOnly]);

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
  const isChallenge = mode.kind === 'challenge';
  const isTargets = mode.kind === 'targets';
  // The daily rank row is a COLUMN-family (mobile) affordance only: the
  // desk / desk-lite game surfaces already carry the leaderboard in the
  // left rail, so showing it in their result popup would be redundant
  // (and would change the desktop result — kept byte-identical).
  const columnFamily = useGameFamily() === 'column';
  // Reactive: the claim box swaps to "Posted as …" the instant the
  // editor's save lands (and the leaderboard panel renames with it).
  const savedHandle = useHandle();

  const verdict = isChallenge
    ? won
      ? 'Challenge beaten'
      : 'Challenge missed'
    : isTargets
      ? won
        ? `Level ${mode.level} cleared`
        : `Run ended — level ${mode.level}`
      : won
        ? 'Target cleared'
        : 'Just short';

  // Key highlights — the run at a glance, in place of the old line-by-line
  // math table (the full board is one tap away via View Grid).
  const margin = report.total - state.target;
  const scoringLines = report.lines.filter(
    l => l.hand !== null && l.hand !== 'HIGH_CARD' && !l.incomplete
  );
  let bestLine: (typeof scoringLines)[number] | null = null;
  for (const l of scoringLines) {
    if (!bestLine || l.total > bestLine.total) bestLine = l;
  }
  const fmtMult = (m: number): string => `×${m.toFixed(2).replace(/\.?0+$/, '')}`;
  const highlights: { icon: string; text: string }[] = [];
  if (bestLine && bestLine.hand) {
    highlights.push({
      icon: '★',
      text: `Best hand — ${HAND_LABEL[bestLine.hand]} (${lineLabel(
        bestLine.kind,
        bestLine.index
      )}) +${bestLine.total}`,
    });
  }
  highlights.push({
    icon: '▦',
    text: `${scoringLines.length} of 10 lines scored`,
  });
  if (report.gridMultiplier !== 1) {
    highlights.push({
      icon: '✦',
      text: `Grid multiplier ${fmtMult(report.gridMultiplier)}`,
    });
  }
  if (report.gridFlat !== 0) {
    highlights.push({ icon: '✦', text: `Grid bonus +${report.gridFlat}` });
  }
  if (report.incompletePenalty !== 0) {
    highlights.push({
      icon: '⚠',
      text: `${report.incompletePenalty} for unfinished lines`,
    });
  }

  const onShare = async () => {
    const url = buildShareUrl({
      score: report.total,
      mode: isTargets
        ? 'targets-up'
        : isChallenge
          ? 'challenge'
          : isDaily
            ? 'daily'
            : 'free',
      difficulty: state.difficulty,
      grid: state.grid,
      dateISO: isDaily && mode.kind === 'daily' ? mode.dateISO : undefined,
      seed: mode.kind === 'free' ? seed : undefined,
    });
    const result = await shareUrl(url, `PokerGrid — ${report.total} points`);
    if (result.outcome === 'copied') toast('Link copied.', 'success');
    else if (result.outcome === 'failed') toast('Could not share.', 'danger');
  };

  // Targets Up: exactly ONE contextual primary next to View Grid —
  // Choose Reward(s) (S/SS win, picks pending) → the shared
  // RewardsSheet; Next Round (won, picks done or none earned); Play
  // Again (lost — the save is already cleared, so the remount starts
  // the run over at level 1).
  const targetsPrimary = targetsFlow.rewardsPending ? (
    <button
      type="button"
      className={styles.primaryBtn}
      onClick={targetsFlow.openRewards}
    >
      {targetsFlow.rewardCount === 2 ? 'Choose Rewards' : 'Choose Reward'}
    </button>
  ) : (
    <button type="button" className={styles.primaryBtn} onClick={onReplay}>
      {won ? 'Next Round' : 'Play Again'}
    </button>
  );

  if (!open) {
    // Keep the RewardsSheet reachable even while the player inspects
    // the grid — it is a top-layer <dialog>, independent of the scrim.
    return <>{targetsFlow.rewardsSheet}</>;
  }

  return (
    <div className={styles.scrim}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Game result"
      >
        <div className={`${styles.head} ${won ? styles.headWin : styles.headLoss}`}>
          <span className={styles.verdict}>{verdict}</span>
          <span className={styles.tier}>{tier}</span>
          <span className={styles.tierLabel}>{tierLabel(tier)}</span>
          {isChallenge && setup.challenge && (
            <span className={styles.headContext}>
              <span aria-hidden="true">✦</span> {setup.challenge.name}
            </span>
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.scoreRow}>
            <span className={styles.score} data-testid="final-score">
              {report.total}
            </span>
            <span className={styles.target}>/ {state.target}</span>
          </div>
          <div
            className={`${styles.margin} ${
              margin >= 0 ? styles.marginWin : styles.marginLoss
            }`}
          >
            {margin >= 0
              ? `Beat the target by +${margin}`
              : `${Math.abs(margin)} short of the target`}
          </div>

          {/* The run at a glance — a few punchy highlights instead of a
              line-by-line table (the full board is a tap away, View Grid). */}
          <ul className={styles.highlights}>
            {highlights.map((h, i) => (
              <li key={i} className={styles.highlight}>
                <span className={styles.highlightIcon} aria-hidden="true">
                  {h.icon}
                </span>
                {h.text}
              </li>
            ))}
          </ul>

          {(xpEarned && xpEarned.total > 0) || levelUp !== null ? (
            <div className={styles.rewards}>
              {xpEarned && xpEarned.total > 0 && (
                <button
                  type="button"
                  className={styles.xpEarned}
                  onClick={() => setXpOpen(true)}
                  aria-label={`Earned ${xpEarned.total} XP this game — show breakdown`}
                >
                  <span aria-hidden="true">✨</span> +{xpEarned.total} XP
                  <span className={styles.xpHint} aria-hidden="true">
                    ⓘ
                  </span>
                </button>
              )}
              {levelUp !== null && (
                <span className={styles.levelUp} role="status">
                  <span aria-hidden="true">⬆</span> Level {levelUp} reached
                </span>
              )}
            </div>
          ) : null}
          {/* Daily, mobile only: the player's standing for this date,
              reusing the leaderboard bar (rank / of-total + the retryable
              "submitting…" queue state) — the column game has no
              leaderboard rail, so the result popup carries it. Free /
              challenge / Targets-Up show no rank row (no per-date
              leaderboard), and desk / desk-lite already show the rail.
              RankPanel owns its own hooks, so gating its render here keeps
              this component's hook order stable. */}
          {mode.kind === 'daily' && columnFamily && isBackendConfigured() && (
            <div className={styles.rankRow}>
              <RankPanel dateISO={mode.dateISO} placementOnly />
            </div>
          )}
          {/* Just-earned achievements — mobile's 🏆 callout at dialog
              weight: a warm callout box, each name tappable for its
              explainer. */}
          {newAchievements.length > 0 && (
            <div className={styles.achievements} role="status">
              <span className={styles.achievementsLabel}>
                <span aria-hidden="true">🏆</span>{' '}
                {newAchievements.length > 1
                  ? 'Achievements unlocked'
                  : 'Achievement unlocked'}
              </span>
              <span className={styles.achievementsList}>
                {newAchievements.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.achievementBtn}
                    onClick={() => setAchInfo(a)}
                  >
                    {a.name}
                    {/* Hover/focus explainer — the dark tooltip
                        pattern; click still opens the full sheet. */}
                    <span className={styles.achTip} role="tooltip">
                      {a.description}
                    </span>
                  </button>
                ))}
              </span>
            </div>
          )}

          {isDaily &&
            isBackendConfigured() &&
            (savedHandle ? (
              <div className={styles.posted}>
                <span aria-hidden="true">✓</span>
                Posted as {savedHandle}
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
                <HandleEditor heading={null} />
              </div>
            ))}
          <div className={styles.footer}>
            {isDaily ? (
              <Link to="/daily/archive" className={styles.primaryBtn}>
                Play Again
              </Link>
            ) : isTargets ? (
              targetsPrimary
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={onReplay}
              >
                {isChallenge && !won ? 'Retry challenge' : 'Play Again'}
              </button>
            )}
            {!isTargets && (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={onShare}
              >
                Share result
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
          {(isChallenge || isTargets) && (
            <div className={styles.quietRow}>
              {isChallenge ? (
                <Link to="/challenges" className={styles.quietLink}>
                  All challenges
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.quietLink}
                    onClick={onShare}
                  >
                    Share result
                  </button>
                  <Link to="/targets" className={styles.quietLink}>
                    Targets Up home
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Sheet
        open={achInfo !== null}
        onClose={() => setAchInfo(null)}
        title={achInfo ? `🏆 ${achInfo.name}` : ''}
      >
        {achInfo && <p className="text-body">{achInfo.description}</p>}
      </Sheet>
      <Sheet open={xpOpen} onClose={() => setXpOpen(false)} title="XP earned">
        {xpEarned && (
          <div className={styles.xpBreakdown}>
            {xpEarned.items.map(i => (
              <div key={i.bucket} className={styles.xpBreakRow}>
                <span>{i.label}</span>
                <span>+{i.xp}</span>
              </div>
            ))}
            <div className={`${styles.xpBreakRow} ${styles.xpBreakTotal}`}>
              <span>Total</span>
              <span>+{xpEarned.total} XP</span>
            </div>
          </div>
        )}
      </Sheet>
      {targetsFlow.rewardsSheet}
    </div>
  );
}
