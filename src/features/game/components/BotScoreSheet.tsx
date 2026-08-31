import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives';
import type { Difficulty } from '../../../game/rules';
import type { BotWorkerRequest, BotWorkerResult } from '../botWorker';
import styles from './BotScoreSheet.module.css';

export interface BotScoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** The finished run's ruleset + deal — the bot replays exactly it. */
  difficulty: Difficulty;
  seed: number;
  /** The player's final score, for the head-to-head line. */
  playerScore: number;
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
}: BotScoreSheetProps) {
  const [result, setResult] = useState<BotWorkerResult | null>(null);
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    if (typeof Worker === 'undefined') {
      // No Worker (jsdom, ancient embeds): compute in a deferred chunk
      // on the main thread — same bot, same deterministic score.
      import('../../../game/bot')
        .then(({ runBotGame }) => {
          const { report, state } = runBotGame(difficulty, seed);
          setResult({
            score: report.total,
            target: state.target,
            won: report.total >= state.target,
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
            <p className={styles.note}>
              The bot replayed your exact deal under the same rules. It
              counts cards, but never sees the deck&apos;s order or what
              the bonus deck will offer.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
