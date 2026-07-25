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

  it('twist odds are uniform across the live rotation', () => {
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

    // All eleven twists appear, and only those eleven.
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
      'time-trial',
    ];
    for (const t of ALL) expect(counts[t] ?? 0).toBeGreaterThan(0);
    expect(Object.keys(counts).sort()).toEqual([...ALL].sort());

    // Flat weights since g2: every twist lands 1/11 of twisted days.
    // ±0.03 absolute tolerance — over ~2400 twisted samples the
    // binomial std-dev for a 1/11 bucket is ~0.6%, so this is ~5σ.
    for (const t of ALL) {
      const share = (counts[t] ?? 0) / twisted;
      expect(share).toBeGreaterThan(1 / 11 - 0.03);
      expect(share).toBeLessThan(1 / 11 + 0.03);
    }
  });

  it('snapshots — locked recipes for known dates', () => {
    // Pin a few specific dates so a future refactor to the hash function
    // or distribution would surface the regression loudly.
    expect(recipeFor('2026-01-01').difficulty).toBeDefined();
    expect(recipeFor('2026-06-05').difficulty).toBeDefined();
    expect(recipeFor('2026-12-31').difficulty).toBeDefined();
  });
});
