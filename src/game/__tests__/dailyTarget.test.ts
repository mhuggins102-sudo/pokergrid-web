import { dailyTargetFor } from '../daily/recipe';
import { CHALLENGES } from '../challenges';

describe('dailyTargetFor', () => {
  describe('no twist — base difficulty target', () => {
    it.each([
      ['easy', 400],
      ['medium', 450],
      ['hard', 500],
      ['extreme', 450],
    ])('%s → %s', (difficulty, expected) => {
      expect(dailyTargetFor(difficulty as 'easy')).toBe(expected);
    });
  });

  describe('every twist keeps the full base target — except poker-purist', () => {
    const FULL_BASE_TWISTS = CHALLENGES.map(c => c.id).filter(
      id => id !== 'poker-purist'
    );
    it.each([
      ['easy', 400],
      ['medium', 450],
      ['hard', 500],
    ])('%s → %s', (difficulty, expected) => {
      for (const twist of FULL_BASE_TWISTS) {
        expect(dailyTargetFor(difficulty as 'easy', twist)).toBe(expected);
      }
    });
  });

  describe('fixed-target twists', () => {
    it('poker-purist is 350 across all difficulties', () => {
      expect(dailyTargetFor('easy', 'poker-purist')).toBe(350);
      expect(dailyTargetFor('medium', 'poker-purist')).toBe(350);
      expect(dailyTargetFor('hard', 'poker-purist')).toBe(350);
    });
  });

  it('every challenge target equals its hard-daily value', () => {
    for (const c of CHALLENGES) {
      expect(c.scoreTarget).toBe(dailyTargetFor('hard', c.id));
    }
  });

  it('defensively handles extreme + twist even though the recipe never emits it', () => {
    // Extreme has empty twistEligibility so this shouldn't appear in
    // recipeFor output, but the formula still resolves sanely.
    expect(dailyTargetFor('extreme', 'no-discards')).toBe(450); // base, delta 0
    expect(dailyTargetFor('extreme', 'poker-purist')).toBe(350); // fixed
    expect(dailyTargetFor('extreme', 'three-tricks')).toBe(450); // base, delta 0
  });
});
