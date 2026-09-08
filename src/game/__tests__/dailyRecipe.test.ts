import type { Difficulty } from '../rules';
import {
  ALL_TWISTS,
  CYCLE_EPOCH_ISO,
  CYCLE_LENGTH,
  recipeFor,
} from '../daily/recipe';
import { currentDateISO } from '../daily/seed';

const EPOCH_MS = Date.UTC(2026, 2, 1); // = CYCLE_EPOCH_ISO
const isoAt = (day: number): string =>
  currentDateISO(new Date(EPOCH_MS + day * 86_400_000));

// One cycle's 40 recipes, epoch-aligned.
const cycleAt = (k: number) =>
  Array.from({ length: CYCLE_LENGTH }, (_, i) =>
    recipeFor(isoAt(k * CYCLE_LENGTH + i))
  );

describe('daily recipe — balanced 40-day cycle', () => {
  it('is deterministic for the same date, and epoch-aligned', () => {
    expect(recipeFor('2026-06-05')).toEqual(recipeFor('2026-06-05'));
    expect(currentDateISO(new Date(EPOCH_MS))).toBe(CYCLE_EPOCH_ISO);
  });

  it('every cycle holds the exact composition', () => {
    for (let k = 0; k < 10; k++) {
      const days = cycleAt(k);
      expect(days).toHaveLength(40);

      // 4 Extreme days, never twisted.
      const extreme = days.filter(d => d.difficulty === 'extreme');
      expect(extreme).toHaveLength(4);
      for (const d of extreme) expect(d.twist).toBeUndefined();

      // 10 twist-free non-Extreme days: 3 Easy, 3 Medium, 4 Hard.
      const plain = days.filter(d => !d.twist && d.difficulty !== 'extreme');
      expect(plain).toHaveLength(10);
      expect(plain.filter(d => d.difficulty === 'easy')).toHaveLength(3);
      expect(plain.filter(d => d.difficulty === 'medium')).toHaveLength(3);
      expect(plain.filter(d => d.difficulty === 'hard')).toHaveLength(4);

      // 26 twisted days: every live twist exactly twice, at two
      // DIFFERENT difficulties; totals 7 Easy / 9 Medium / 10 Hard.
      const twisted = days.filter(d => d.twist);
      expect(twisted).toHaveLength(26);
      const byDiff: Record<Difficulty, number> = {
        easy: 0,
        medium: 0,
        hard: 0,
        extreme: 0,
      };
      for (const d of twisted) byDiff[d.difficulty] += 1;
      expect(byDiff).toEqual({ easy: 7, medium: 9, hard: 10, extreme: 0 });
      for (const t of ALL_TWISTS) {
        const copies = twisted.filter(d => d.twist === t);
        expect(copies).toHaveLength(2);
        // The "no exact repeat variant/difficulty combo" guarantee.
        expect(copies[0].difficulty).not.toBe(copies[1].difficulty);
      }
    }
  });

  it('no identity repeats on consecutive days — twists or twist-free, boundaries included', () => {
    // 20 cycles = 800 days, spanning 19 cycle boundaries.
    let prev = recipeFor(isoAt(0));
    for (let day = 1; day < 20 * CYCLE_LENGTH; day++) {
      const cur = recipeFor(isoAt(day));
      expect(cur.twist ?? 'none').not.toBe(prev.twist ?? 'none');
      prev = cur;
    }
  });

  it('handles dates before the epoch and junk input without throwing', () => {
    expect(recipeFor('2026-01-01').difficulty).toBeDefined();
    expect(recipeFor('2020-12-31').difficulty).toBeDefined();
    expect(recipeFor('not-a-date').difficulty).toBeDefined();
  });
});
