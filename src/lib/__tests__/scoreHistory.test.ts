import {
  EMPTY_STATS,
  RunRecord,
  SCORE_HISTORY_CAP,
  Stats,
  hydrateStats,
  recordRun,
} from '../stats';

const run = (score: number, ts = score): RunRecord => ({
  ts,
  difficulty: 'easy',
  score,
  target: 250,
  won: score >= 250,
});

describe('scoreHistory', () => {
  it('appends every run, newest first', () => {
    let s = recordRun(EMPTY_STATS, run(100, 1));
    s = recordRun(s, run(300, 2));
    expect(s.scoreHistory.map(p => p.score)).toEqual([300, 100]);
    expect(s.scoreHistory[0]).toEqual({
      ts: 2,
      difficulty: 'easy',
      score: 300,
      won: true,
    });
  });

  it('caps at SCORE_HISTORY_CAP, dropping the oldest', () => {
    // Newest first, like the store keeps it: head ts = CAP-1 … tail ts = 0.
    const full: Stats = {
      ...EMPTY_STATS,
      scoreHistory: Array.from({ length: SCORE_HISTORY_CAP }, (_, i) => ({
        ts: SCORE_HISTORY_CAP - 1 - i,
        difficulty: 'easy' as const,
        score: i,
        won: false,
      })),
    };
    const next = recordRun(full, run(9999));
    expect(next.scoreHistory).toHaveLength(SCORE_HISTORY_CAP);
    expect(next.scoreHistory[0].score).toBe(9999);
    // The oldest point (ts 0) fell off the tail.
    expect(next.scoreHistory[next.scoreHistory.length - 1].ts).toBe(1);
  });

  it('hydrate seeds a missing history from the recent buffer', () => {
    const hydrated = hydrateStats({
      recent: [run(200, 10), run(150, 5)],
    });
    expect(hydrated.scoreHistory.map(p => p.score)).toEqual([200, 150]);
    // Slim points only — no target field carried over.
    expect(hydrated.scoreHistory[0]).toEqual({
      ts: 10,
      difficulty: 'easy',
      score: 200,
      won: false,
    });
  });

  it('hydrate keeps a stored history as-is', () => {
    const stored = [{ ts: 1, difficulty: 'hard' as const, score: 42, won: false }];
    expect(hydrateStats({ scoreHistory: stored }).scoreHistory).toEqual(stored);
  });
});
