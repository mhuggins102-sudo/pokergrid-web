import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives';
import { Achievement, botAchievementsEarned } from '../../../game/achievements';
import type { Difficulty } from '../../../game/rules';
import type { ScoreReport } from '../../../game/scoring';
import type { GameState } from '../../../game/state';
import { useStatsStore } from '../../progress/statsStore';
import type { BotWorkerRequest, BotWorkerResult } from '../botWorker';
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

  // The run was recorded when the result screen opened; the bot's
  // score arrives later, so the achievements that need it are judged
  // (and persisted) here, once per run.
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
    if (typeof Worker === 'undefined') {
      // No Worker (jsdom, ancient embeds): compute in a deferred chunk
      // on the main thread — same bot, same deterministic score.
      import('../../../game/bot')
        .then(({ runBotGame }) => {
          const { report, state, actions } = runBotGame(difficulty, seed);
          setResult({
            score: report.total,
            target: state.target,
            won: report.total >= state.target,
            actions,
          });
        })
        .catch(() => setFailed(true));
      return;
    }
    const worker = new Worker(new URL('../botWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<BotWorkerResult>) => {
      setResult(e.data);
      worker.terminate();
    };
    worker.onerror = () => {
      setFailed(true);
      worker.terminate();
    };
    const req: BotWorkerRequest = { difficulty, seed };
    worker.postMessage(req);
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
