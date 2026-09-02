/**
 * Bot simulation — runs N games per difficulty with the production bot
 * (src/game/bot.ts) and reports the score distribution + tier rates.
 *
 * OPT-IN: skipped unless SIMULATE=1 is set. Default `npm test`
 * ignores it because the runs add minutes to the suite for no
 * day-to-day benefit.
 *
 *   SIMULATE=1 npm test -- --testPathPattern botSimulation
 *   SIM_N=500 SIMULATE=1 npm test -- --testPathPattern botSimulation
 *
 * The bot is the honest Monte-Carlo player shipped to the "Bot Score"
 * feature: it never sees the deck's order, only its multiset —
 * decisions average a projected end-score over SIM_SAMPLES shuffles
 * per decision (default 8 here; the shipped bot uses
 * BOT_DEFAULT_SAMPLES). More samples = stronger and slower.
 *
 * Reference (2026-09, the fit-based rollout player, default 48
 * samples, fixed seeds 1001–1040 via runBotGame): means easy 574 /
 * medium 476 / hard 474 / extreme 355 — see docs/BOT_STRATEGY.md.
 * Lower SIM_SAMPLES here trades strength for speed. The NUT LOW block
 * below is much weaker than free play (random projections bust nearly
 * every low line, so its decisions go blind); treat its numbers as a
 * floor, not a calibration.
 */
import { playBotGame } from '../bot';
import { findChallenge } from '../challenges';
import { Difficulty, TARGET_BY_DIFFICULTY } from '../rules';
import { NewGameOptions, newGame } from '../state';

const SHOULD_RUN = process.env.SIMULATE === '1';
const N_GAMES = parseInt(process.env.SIM_N ?? '200', 10);
const SIM_SAMPLES = parseInt(process.env.SIM_SAMPLES ?? '8', 10);
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

const runOneGame = (
  difficulty: Difficulty,
  options: NewGameOptions = {}
): number => {
  const initial = newGame(difficulty, Math.random, options);
  const { report } = playBotGame(initial, {
    samples: SIM_SAMPLES,
    botSeed: Math.floor(Math.random() * 0x7fffffff),
  });
  return report.total;
};

interface Stats {
  difficulty: Difficulty;
  target: number;
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  p95: number;
  pctSS: number;
  pctS: number;
  pctA: number;
  pctWin: number;
}

// Optional target override per difficulty — used to bucket the same
// score distribution against multiple proposed target schedules in
// one sim run. When undefined, falls back to TARGET_BY_DIFFICULTY.
const summarize = (
  difficulty: Difficulty,
  scores: number[],
  targetOverride?: number
): Stats => {
  const target = targetOverride ?? TARGET_BY_DIFFICULTY[difficulty];
  const sorted = [...scores].sort((a, b) => a - b);
  const pct = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const pctAtLeast = (mul: number) =>
    scores.filter(s => s >= target * mul).length / scores.length;
  return {
    difficulty,
    target,
    n: scores.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 10) / 10,
    median: pct(0.5),
    p25: pct(0.25),
    p75: pct(0.75),
    p95: pct(0.95),
    pctSS: pctAtLeast(1.6),
    pctS: pctAtLeast(1.3) - pctAtLeast(1.6),
    pctA: pctAtLeast(1.0) - pctAtLeast(1.3),
    pctWin: pctAtLeast(1.0),
  };
};

const formatPct = (p: number) => `${(p * 100).toFixed(1)}%`;

const reportStats = (s: Stats): string => {
  const lines = [
    `--- ${s.difficulty.toUpperCase()} (target ${s.target}, n=${s.n}) ---`,
    `  min / max     : ${s.min} / ${s.max}`,
    `  mean / median : ${s.mean} / ${s.median}`,
    `  p25 / p75 / p95: ${s.p25} / ${s.p75} / ${s.p95}`,
    `  win rate (A+) : ${formatPct(s.pctWin)}`,
    `  A  (1.0–1.3×) : ${formatPct(s.pctA)}`,
    `  S  (1.3–1.6×) : ${formatPct(s.pctS)}`,
    `  SS (≥1.6×)    : ${formatPct(s.pctSS)}`,
  ];
  return lines.join('\n');
};

(SHOULD_RUN ? describe : describe.skip)('bot simulation', () => {
  test(
    `${N_GAMES} games per difficulty`,
    () => {
      const allStats: Stats[] = [];
      for (const difficulty of DIFFICULTIES) {
        const scores: number[] = [];
        for (let i = 0; i < N_GAMES; i++) {
          scores.push(runOneGame(difficulty));
        }
        const stats = summarize(difficulty, scores);
        allStats.push(stats);
        console.log(reportStats(stats));
      }
      for (const s of allStats) {
        expect(s.n).toBe(N_GAMES);
      }
    },
    600_000
  );

  // Nut Low target calibration: the same bot, lowball objective (the
  // argmax already maximizes scoreGrid().total, which IS the lowball
  // score here). Buckets the distribution against the challenge's
  // configured target — rerun with SIM_N to taste when retuning it.
  test(
    `${N_GAMES} Nut Low games (target calibration)`,
    () => {
      const scores: number[] = [];
      for (let i = 0; i < N_GAMES; i++) {
        scores.push(
          runOneGame('hard', {
            targetOverride: findChallenge('nut-low').scoreTarget,
            noBonusCards: true,
            lowball: true,
            noJokers: true,
            deckLimit: findChallenge('nut-low').deckLimit,
          })
        );
      }
      const stats = summarize(
        'hard',
        scores,
        findChallenge('nut-low').scoreTarget
      );
      console.log('NUT LOW\n' + reportStats(stats));
      expect(stats.n).toBe(N_GAMES);
    },
    600_000
  );
});
