/**
 * One bot run per free-play deal, shared by everyone who wants it.
 *
 * The bot replays a deal by (difficulty, seed) in a Web Worker
 * (botWorker.ts). A free-play session kicks the run off as the game
 * STARTS, so the bot's score is normally waiting by the time the player
 * finishes — the result screen judges the bot-comparison achievements
 * (Bot Buster) against it right away, and the Bot Score sheet opens on
 * the number instead of a spinner. Runs are cached by deal so a sheet
 * re-open, a viewport re-mount, or the sheet and the result screen
 * asking together never spawn a second worker.
 *
 * Without Worker support (jsdom, ancient embeds) the prefetch is a
 * no-op — a synchronous multi-second run on the main thread mid-game
 * would freeze the board — and only an explicit request (the sheet)
 * computes on the main thread, in a deferred chunk.
 */
import type { Difficulty } from '../../game/rules';
import type { BotWorkerRequest, BotWorkerResult } from './botWorker';

const runs = new Map<string, Promise<BotWorkerResult>>();

const keyOf = (difficulty: Difficulty, seed: number): string =>
  `${difficulty}:${seed}`;

const hasWorker = (): boolean => typeof Worker !== 'undefined';

const runInWorker = (difficulty: Difficulty, seed: number) =>
  new Promise<BotWorkerResult>((resolve, reject) => {
    const worker = new Worker(new URL('./botWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<BotWorkerResult>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = err => {
      reject(err);
      worker.terminate();
    };
    const req: BotWorkerRequest = { difficulty, seed };
    worker.postMessage(req);
  });

const runOnMainThread = (difficulty: Difficulty, seed: number) =>
  import('../../game/bot').then(({ runBotGame }) => {
    const { report, state, actions } = runBotGame(difficulty, seed);
    return {
      score: report.total,
      target: state.target,
      won: report.total >= state.target,
      actions,
    };
  });

const start = (
  difficulty: Difficulty,
  seed: number,
  runner: (d: Difficulty, s: number) => Promise<BotWorkerResult>
): Promise<BotWorkerResult> => {
  const key = keyOf(difficulty, seed);
  const existing = runs.get(key);
  if (existing) return existing;
  const run = runner(difficulty, seed);
  runs.set(key, run);
  // A failed run is forgotten so a later request can retry.
  run.catch(() => {
    if (runs.get(key) === run) runs.delete(key);
  });
  return run;
};

/** Start the bot on this deal in the background, if a Worker exists.
 *  Idempotent per deal. */
export const prefetchBotRun = (difficulty: Difficulty, seed: number): void => {
  if (!hasWorker()) return;
  start(difficulty, seed, runInWorker);
};

/** The run for this deal if one was started (settled or not). */
export const peekBotRun = (
  difficulty: Difficulty,
  seed: number
): Promise<BotWorkerResult> | undefined => runs.get(keyOf(difficulty, seed));

/** The run for this deal, starting one now if needed — in a Worker
 *  where possible, else on the main thread. */
export const requestBotRun = (
  difficulty: Difficulty,
  seed: number
): Promise<BotWorkerResult> =>
  start(difficulty, seed, hasWorker() ? runInWorker : runOnMainThread);

/** Test seam: install a run for a deal as if the prefetch had made it. */
export const primeBotRun = (
  difficulty: Difficulty,
  seed: number,
  run: Promise<BotWorkerResult>
): void => {
  runs.set(keyOf(difficulty, seed), run);
};
