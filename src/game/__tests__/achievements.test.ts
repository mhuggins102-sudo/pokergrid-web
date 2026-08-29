import { describe, expect, it } from 'vitest';
import {
  AchievementCheckCtx,
  AchievementId,
  MilestoneInputs,
  achievementEarned,
  findAchievement,
} from '../achievements';
import { Card, Rank, StandardCard, Suit } from '../cards';
import { emptyGrid, Grid, GRID_SLOTS } from '../grid';
import { HandRank } from '../hands';
import { ScoreReport, scoreGrid } from '../scoring';
import type { GameState } from '../state';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});

const milestone: MilestoneInputs = {
  winsByDifficulty: { easy: 0, medium: 0, hard: 0, extreme: 0 },
  ssByDifficulty: { easy: 0, medium: 0, hard: 0, extreme: 0 },
  totalWins: 0,
  challengesCompleted: 0,
  totalChallenges: 10,
  challengeSilverPlus: 0,
  challengeGold: 0,
  runBonusShapley: [],
  runWasFreePlay: false,
  uniqueBonusCardsScored: 0,
  totalBonusCardsInPool: 40,
};

// Minimal GameState carrying just the fields the achievement conditions
// touch. The cast keeps the fixtures readable; conditions only ever read
// what's listed here.
const stateWith = (over: Partial<GameState> = {}): GameState =>
  ({
    difficulty: 'easy',
    grid: emptyGrid(),
    deck: [],
    discards: [],
    perkSpent: [],
    bonusCards: [],
    handBoost: {},
    timeTrial: false,
    elapsedMs: 0,
    burned: [],
    swappedBonus: false,
    ...over,
  }) as unknown as GameState;

// Fabricated report: a total plus (optionally) per-line hands, for
// conditions that only read report.total / report.lines[].hand.
const reportWith = (
  total: number,
  hands: (HandRank | null)[] = []
): ScoreReport =>
  ({
    total,
    lines: hands.map(hand => ({ hand, total: 0, incomplete: false })),
  }) as unknown as ScoreReport;

const ctx = (over: Partial<AchievementCheckCtx>): AchievementCheckCtx => ({
  state: stateWith(),
  report: reportWith(1000),
  milestone,
  mode: 'free',
  activeVariant: null,
  ...over,
});

const earn = (id: AchievementId, over: Partial<AchievementCheckCtx>): boolean =>
  achievementEarned(findAchievement(id)!, ctx(over));

describe('difficulty tiers earn on any twist-free run', () => {
  it('awards Easy/Medium on Free Play and on a twist-free daily', () => {
    expect(earn('easy-grand', { mode: 'free' })).toBe(true);
    expect(earn('easy-grand', { mode: 'daily' })).toBe(true);
  });

  it('blocks the difficulty tiers when a twist is active', () => {
    expect(
      earn('easy-grand', { mode: 'daily', activeVariant: 'short-deck' })
    ).toBe(false);
  });

  it('awards Hard/Extreme on a twist-free Hard daily', () => {
    expect(
      earn('balanced', {
        mode: 'daily',
        state: stateWith({ difficulty: 'hard' }),
        report: reportWith(520),
      })
    ).toBe(true);
  });

  it('still blocks Hard/Extreme on Challenge runs (Hard ruleset + twist)', () => {
    expect(
      earn('balanced', {
        mode: 'challenge',
        activeVariant: 'short-deck',
        state: stateWith({ difficulty: 'hard' }),
        report: reportWith(600),
      })
    ).toBe(false);
  });

  it('requires a matching difficulty', () => {
    expect(
      earn('easy-grand', {
        mode: 'daily',
        state: stateWith({ difficulty: 'hard' }),
      })
    ).toBe(false);
  });

  it('keeps milestones off the daily per-run path (cumulative path owns them)', () => {
    const m = { ...milestone, totalWins: 30 };
    expect(earn('wins-25', { mode: 'daily', milestone: m })).toBe(false);
    expect(earn('wins-25', { mode: 'free', milestone: m })).toBe(true);
  });

  it('awards milestones from Challenge runs (wins span every mode)', () => {
    const m = { ...milestone, totalWins: 30 };
    expect(
      earn('wins-25', {
        mode: 'challenge',
        activeVariant: 'short-deck',
        milestone: m,
      })
    ).toBe(true);
  });
});

describe('Waste Not (750+ with 15+ deck cards left)', () => {
  const deck = (n: number): Card[] => Array.from({ length: n }, () => C('2', 'C'));

  it('fires at the thresholds', () => {
    expect(
      earn('easy-waste-not', {
        state: stateWith({ deck: deck(15) }),
        report: reportWith(750),
      })
    ).toBe(true);
  });

  it('needs both the score and the deck floor', () => {
    expect(
      earn('easy-waste-not', {
        state: stateWith({ deck: deck(14) }),
        report: reportWith(900),
      })
    ).toBe(false);
    expect(
      earn('easy-waste-not', {
        state: stateWith({ deck: deck(20) }),
        report: reportWith(749),
      })
    ).toBe(false);
  });
});

describe('Triple Crown (750+ with 3+ straight/royal flushes)', () => {
  it('counts straight and royal flushes together', () => {
    expect(
      earn('easy-triple-crown', {
        report: reportWith(800, [
          'STRAIGHT_FLUSH',
          'ROYAL_FLUSH',
          'STRAIGHT_FLUSH',
          'PAIR',
          null,
        ]),
      })
    ).toBe(true);
  });

  it('two flushes are not enough, and Five of a Kind does not count', () => {
    expect(
      earn('easy-triple-crown', {
        report: reportWith(800, [
          'STRAIGHT_FLUSH',
          'ROYAL_FLUSH',
          'FIVE_OF_A_KIND',
          'FLUSH',
        ]),
      })
    ).toBe(false);
  });
});

describe('Variant tier gating', () => {
  const timeTrialState = stateWith({
    difficulty: 'hard',
    timeTrial: true,
    elapsedMs: 89_000,
  });

  it('fires on the matching Challenge run and the matching twisted daily', () => {
    expect(
      earn('variant-time-trial', {
        mode: 'challenge',
        activeVariant: 'time-trial',
        state: timeTrialState,
        report: reportWith(510),
      })
    ).toBe(true);
    expect(
      earn('variant-time-trial', {
        mode: 'daily',
        activeVariant: 'time-trial',
        state: timeTrialState,
        report: reportWith(510),
      })
    ).toBe(true);
  });

  it('never fires under a different (or no) twist, or on Free Play', () => {
    expect(
      earn('variant-time-trial', {
        mode: 'challenge',
        activeVariant: 'short-deck',
        state: timeTrialState,
        report: reportWith(510),
      })
    ).toBe(false);
    expect(
      earn('variant-time-trial', {
        mode: 'daily',
        activeVariant: null,
        state: timeTrialState,
        report: reportWith(510),
      })
    ).toBe(false);
    expect(
      earn('variant-time-trial', {
        mode: 'free',
        activeVariant: null,
        state: timeTrialState,
        report: reportWith(510),
      })
    ).toBe(false);
  });

  it('requires Hard — a twisted Easy/Medium daily does not count', () => {
    (['easy', 'medium'] as const).forEach(difficulty => {
      expect(
        earn('variant-time-trial', {
          mode: 'daily',
          activeVariant: 'time-trial',
          state: stateWith({
            difficulty,
            timeTrial: true,
            elapsedMs: 89_000,
          }),
          report: reportWith(510),
        })
      ).toBe(false);
    });
  });
});

describe('Lightning Round (Time Trial under 1:30)', () => {
  const at = (elapsedMs: number): boolean =>
    earn('variant-time-trial', {
      mode: 'challenge',
      activeVariant: 'time-trial',
      state: stateWith({ difficulty: 'hard', timeTrial: true, elapsedMs }),
      report: reportWith(500),
    });

  it('needs a finish strictly under 90 seconds', () => {
    expect(at(89_999)).toBe(true);
    expect(at(90_000)).toBe(false);
  });
});

describe('Flipping Out (Double Duty, 10+ flips)', () => {
  const withBurned = (n: number): boolean =>
    earn('variant-double-duty', {
      mode: 'challenge',
      activeVariant: 'double-duty',
      state: stateWith({
        difficulty: 'hard',
        // Each flip burns exactly 2 deck cards.
        burned: Array.from({ length: n }, () => C('2', 'C')),
      }),
      report: reportWith(520),
    });

  it('counts flips via the burned pile (2 cards per flip)', () => {
    expect(withBurned(20)).toBe(true);
    expect(withBurned(18)).toBe(false);
  });
});

describe('Backdoor Draw (Five Draw, under 100 points from rows)', () => {
  // Fabricated report with typed row/col lines — the shared reportWith
  // helper carries no kind/index, and this condition reads both.
  const rowColReport = (
    rowTotals: number[],
    colTotals: number[],
    total: number
  ): ScoreReport =>
    ({
      total,
      lines: [
        ...rowTotals.map((t, index) => ({
          kind: 'row',
          index,
          hand: 'PAIR',
          total: t,
          incomplete: false,
        })),
        ...colTotals.map((t, index) => ({
          kind: 'col',
          index,
          hand: 'PAIR',
          total: t,
          incomplete: false,
        })),
      ],
    }) as unknown as ScoreReport;

  const withRows = (rowTotals: number[]): boolean =>
    earn('variant-draw-poker', {
      mode: 'challenge',
      activeVariant: 'draw-poker',
      state: stateWith({ difficulty: 'hard' }),
      report: rowColReport(rowTotals, [200, 200, 200, 200, 200], 520),
    });

  it('sums ROW totals only — columns carry the run', () => {
    expect(withRows([20, 20, 20, 20, 19])).toBe(true); // 99 from rows
    expect(withRows([20, 20, 20, 20, 20])).toBe(false); // 100 from rows
  });

  it('still demands the 500 floor', () => {
    expect(
      earn('variant-draw-poker', {
        mode: 'challenge',
        activeVariant: 'draw-poker',
        state: stateWith({ difficulty: 'hard' }),
        report: rowColReport([0, 0, 0, 0, 0], [99, 99, 99, 99, 99], 499),
      })
    ).toBe(false);
  });
});

describe('Bull Run (Bull Market, 400+ invested points)', () => {
  // Row 0 is a pair of Kings; the junk fill gives each column four of a
  // kind, so the un-boosted board already clears the 500 floor once the
  // PAIR boost lands on top.
  const junkRanks: Rank[] = ['2', '3', '4', '6', '7'];
  const junkSuits: Suit[] = ['C', 'D', 'S', 'H', 'C'];
  const grid = ((): Grid => {
    const g = emptyGrid();
    const row0 = [C('K', 'H'), C('K', 'C'), C('5', 'D'), C('8', 'S'), C('9', 'H')];
    for (let i = 0; i < 5; i++) g[i] = row0[i];
    for (let i = 5; i < GRID_SLOTS; i++) {
      g[i] = C(junkRanks[i % 5], junkSuits[i % 5]);
    }
    return g;
  })();

  const withBoost = (boost: number) => {
    const handBoost = { PAIR: boost };
    const state = stateWith({ difficulty: 'hard', handBoost, grid });
    const report = scoreGrid(grid, [], { handBoost });
    return { state, report };
  };

  it('measures the invested contribution against a boost-free re-score', () => {
    const { state, report } = withBoost(400);
    // Sanity: the boosted board clears the achievement's 500 floor.
    expect(report.total).toBeGreaterThanOrEqual(500);
    expect(
      earn('variant-bull-market', {
        mode: 'challenge',
        activeVariant: 'bull-market',
        state,
        report,
      })
    ).toBe(true);
  });

  it('399 invested points are not enough', () => {
    const { state, report } = withBoost(399);
    expect(report.total).toBeGreaterThanOrEqual(500);
    expect(
      earn('variant-bull-market', {
        mode: 'challenge',
        activeVariant: 'bull-market',
        state,
        report,
      })
    ).toBe(false);
  });
});
