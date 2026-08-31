/**
 * Web Worker wrapper for the free-play bot (src/game/bot.ts). The bot
 * takes 1–5 seconds to replay a full deal, so it runs off the main
 * thread; the BotScoreSheet spins it up on demand and shows the score
 * when this posts back. Only plain data crosses the boundary.
 */
import { runBotGame } from '../../game/bot';
import type { Difficulty } from '../../game/rules';

export interface BotWorkerRequest {
  difficulty: Difficulty;
  seed: number;
}

export interface BotWorkerResult {
  score: number;
  target: number;
  won: boolean;
}

// `self` is typed as Window under the app's DOM lib; narrow to the two
// members a dedicated worker actually uses.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<BotWorkerRequest>) => void) | null;
  postMessage: (msg: BotWorkerResult) => void;
};

ctx.onmessage = e => {
  const { difficulty, seed } = e.data;
  const { report, state } = runBotGame(difficulty, seed);
  ctx.postMessage({
    score: report.total,
    target: state.target,
    won: report.total >= state.target,
  });
};
