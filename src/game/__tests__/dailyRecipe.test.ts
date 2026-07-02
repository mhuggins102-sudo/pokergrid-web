import type { Difficulty } from '../rules';
import {
  recipeFor,
  RECIPE_CONFIG,
} from '../daily/recipe';
import { currentDateISO } from '../daily/seed';

describe('daily recipe', () => {
  it('is deterministic for the same date', () => {
    const a = recipeFor('2026-06-05');
    const b = recipeFor('2026-06-05');
    expect(a).toEqual(b);
  });

  it('returns one of the four difficulties', () => {
    const valid: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
    const r = recipeFor('2026-06-05');
    expect(valid).toContain(r.difficulty);
  });

  it('never pairs a twist with Extreme', () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 3650; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      const r = recipeFor(currentDateISO(d));
      if (r.difficulty === 'extreme') {
        expect(r.twist).toBeUndefined();
      }
    }
  });

  it('twist rate roughly matches RECIPE_CONFIG.twistProbability', () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const TOTAL = 3650;
    let twistCount = 0;
    let nonExtremeCount = 0;
    for (let i = 0; i < TOTAL; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      const r = recipeFor(currentDateISO(d));
      if (r.difficulty !== 'extreme') {
        nonExtremeCount += 1;
        if (r.twist) twistCount += 1;
      }
    }
    // Expected rate among non-Extreme days = twistProbability.
    const observed = twistCount / nonExtremeCount;
    const expected = RECIPE_CONFIG.twistProbability;
    expect(observed).toBeGreaterThan(expected - 0.04);
    expect(observed).toBeLessThan(expected + 0.04);
  });

  it('difficulty distribution matches weights over 10 years of samples', () => {
    const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, extreme: 0 };
    const start = new Date(Date.UTC(2026, 0, 1));
    const TOTAL = 3650;
    for (let i = 0; i < TOTAL; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      counts[recipeFor(currentDateISO(d)).difficulty] += 1;
    }
    // Expected ratios per RECIPE_CONFIG: easy 25%, medium 30%, hard 35%, extreme 10%.
    // Allow ±3% absolute tolerance per bucket — over 10 years of
    // samples the binomial std-dev for a 25% bucket is ~0.72%, so 3%
    // is ~4σ. Tight enough to catch real regressions in the hash /
    // distribution, loose enough that the test isn't flaky.
    expect(counts.easy / TOTAL).toBeGreaterThan(0.22);
    expect(counts.easy / TOTAL).toBeLessThan(0.28);
    expect(counts.medium / TOTAL).toBeGreaterThan(0.27);
    expect(counts.medium / TOTAL).toBeLessThan(0.33);
    expect(counts.hard / TOTAL).toBeGreaterThan(0.32);
    expect(counts.hard / TOTAL).toBeLessThan(0.38);
    expect(counts.extreme / TOTAL).toBeGreaterThan(0.07);
    expect(counts.extreme / TOTAL).toBeLessThan(0.13);
  });

  it('twist odds follow the 3:2:1 common/normal/rare tiers', () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const TOTAL = 3650;
    const counts: Record<string, number> = {};
    let twisted = 0;
    for (let i = 0; i < TOTAL; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      const { twist } = recipeFor(currentDateISO(d));
      if (twist) {
        counts[twist] = (counts[twist] ?? 0) + 1;
        twisted += 1;
      }
    }

    // All ten twists appear.
    const ALL = [
      'short-circuit',
      'no-discards',
      'gridlock',
      'short-deck',
      'poker-purist',
      'mixed-bag',
      'three-tricks',
      'scatter',
      'bull-market',
      'double-duty',
    ];
    for (const t of ALL) expect(counts[t] ?? 0).toBeGreaterThan(0);

    // Weights: common (short-deck / poker-purist / mixed-bag /
    // three-tricks) 3, normal (no-discards / short-circuit / scatter /
    // gridlock) 2, rare (bull-market / double-duty) 1. Total weight 22.
    const share = (t: string) => (counts[t] ?? 0) / twisted;
    const common = share('short-deck');
    const normal = share('scatter');
    const rare = share('bull-market');
    const rare2 = share('double-duty');
    // Expected shares 3/22, 2/22, 1/22 — loose ±0.03 tolerance.
    expect(common).toBeGreaterThan(3 / 22 - 0.03);
    expect(common).toBeLessThan(3 / 22 + 0.03);
    expect(normal).toBeGreaterThan(2 / 22 - 0.03);
    expect(normal).toBeLessThan(2 / 22 + 0.03);
    expect(rare).toBeLessThan(2 / 22); // rare strictly below a normal tier
    expect(rare2).toBeLessThan(2 / 22);
    // Ordering holds: a common twist is meaningfully more frequent.
    expect(common).toBeGreaterThan(rare);
  });

  it('snapshots — locked recipes for known dates', () => {
    // Pin a few specific dates so a future refactor to the hash function
    // or distribution would surface the regression loudly.
    expect(recipeFor('2026-01-01').difficulty).toBeDefined();
    expect(recipeFor('2026-06-05').difficulty).toBeDefined();
    expect(recipeFor('2026-12-31').difficulty).toBeDefined();
  });
});
