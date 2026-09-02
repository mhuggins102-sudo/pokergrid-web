import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives';
import { Achievement, botAchievementsEarned } from '../../../game/achievements';
import type { Difficulty } from '../../../game/rules';
import type { ScoreReport } from '../../../game/scoring';
import type { GameState } from '../../../game/state';
import { useStatsStore } from '../../progress/statsStore';
import { requestBotRun } from '../botRun';
import type { BotWorkerResult } from '../botWorker';
import { BotReplayDialog } from './BotReplayDialog';
import styles from './BotScoreSheet.module.css';

export interface BotScoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** The finished run's ruleset + deal — the bot replays exactly it. */
  difficulty: Difficulty;
  seed: number;
  /** The player's final score, for the head-to-head line. */
  playerScore: number;
  /** The finished run itself — the bot-comparison achievements (Bot
   *  Buster) are judged against it once the bot's score is known. */
  state: GameState;
  report: ScoreReport;
}

/**
 * "Bot Score" — the free-play endgame sheet. On first open it hands the
 * finished run's (difficulty, seed) to the bot worker, which replays
 * the exact same deal under the same rules and posts back its final
 * score; the result is deterministic per run, so it's computed once and
 * kept for re-opens. The bot plays honestly: it counts cards but never
 * sees the deck's order or upcoming bonus cards.
 */
export function BotScoreSheet({
  open,
  onClose,
  difficulty,
  seed,
  playerScore,
  state,
  report,
}: BotScoreSheetProps) {
  const [result, setResult] = useState<BotWorkerResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [earned, setEarned] = useState<Achievement[]>([]);
  const startedRef = useRef(false);
  const judgedRef = useRef(false);

  // The result screen judges the bot-comparison achievements itself
  // when a prefetched run exists (useRecordResult). This is the
  // fallback for a run started only on demand (no Worker — the
  // prefetch is skipped there): judge here, once, when the score
  // lands. Idempotent against the stats store either way.
  useEffect(() => {
    if (result === null || judgedRef.current) return;
    judgedRef.current = true;
    const store = useStatsStore.getState();
    const fresh = botAchievementsEarned(state, report, result.score).filter(
      a => !store.stats.achievementsDone.includes(a.id)
    );
    for (const a of fresh) store.recordAchievement(a.id);
    if (fresh.length > 0) setEarned(fresh);
  }, [result, state, report]);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    // Usually already computed: the session started the bot on this
    // deal when the game began (botRun.ts), so this resolves at once.
    // Otherwise it starts the run now — worker where possible, else a
    // deferred main-thread chunk.
    let cancelled = false;
    requestBotRun(difficulty, seed).then(
      r => {
        if (!cancelled) setResult(r);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, difficulty, seed]);

  const diff = result === null ? 0 : playerScore - result.score;

  return (
    <Sheet open={open} onClose={onClose} title="🤖 Bot score">
      <div className={styles.wrap}>
        {failed ? (
          <p className="text-body">
            The bot couldn&apos;t finish its run — try reopening this
            sheet.
          </p>
        ) : result === null ? (
          <>
            <p className={styles.thinking} role="status">
              The bot is replaying your deal<span aria-hidden="true">…</span>
            </p>
            <p className={styles.note}>
              Same deck, same rules. It counts cards, but never sees the
              deck&apos;s order or what the bonus deck will offer.
            </p>
          </>
        ) : (
          <>
            <div className={styles.scoreRow}>
              <span
                className={styles.botScore}
                data-testid="bot-final-score"
              >
                {result.score}
              </span>
              <span className={styles.target}>/ {result.target}</span>
              <span
                className={`${styles.verdict} ${
                  result.won ? styles.verdictWin : styles.verdictLoss
                }`}
              >
                {result.won ? 'Target cleared' : 'Just short'}
              </span>
            </div>
            <p className={styles.compare}>
              {diff > 0
                ? `You beat the bot by ${diff}.`
                : diff < 0
                  ? `The bot beat you by ${-diff}.`
                  : 'Dead heat — you tied the bot.'}
              <span className={styles.compareOwn}> (You scored {playerScore}.)</span>
            </p>
            {earned.map(a => (
              <p
                key={a.id}
                className={styles.achievement}
                role="status"
                data-testid="bot-achievement"
              >
                🏆 Achievement earned: <strong>{a.name}</strong> — {a.description}
              </p>
            ))}
            <button
              type="button"
              className={styles.watchBtn}
              onClick={() => setReplayOpen(true)}
            >
              ▶ Watch the bot&apos;s game
            </button>
            <p className={styles.note}>
              The bot replayed your exact deal under the same rules. It
              counts cards, but never sees the deck&apos;s order or what
              the bonus deck will offer.
            </p>
          </>
        )}
      </div>
      {result !== null && (
        <BotReplayDialog
          open={replayOpen}
          onClose={() => setReplayOpen(false)}
          difficulty={difficulty}
          seed={seed}
          actions={result.actions}
        />
      )}
    </Sheet>
  );
}
