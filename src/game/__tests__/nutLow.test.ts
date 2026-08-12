import { seededRng } from '../deck';
import { LIVE_CHALLENGES, findChallenge } from '../challenges';
import { dailyTargetFor, recipeFor } from '../daily/recipe';
import { newGame } from '../state';
import { setupForMode } from '../../features/game/modes';

// The real challenge configuration, mirroring modes.ts's 'nut-low' case.
const nutLowGame = (seed = 7) =>
  newGame('hard', seededRng(seed), {
    targetOverride: findChallenge('nut-low').scoreTarget,
    noBonusCards: true,
    lowball: true,
  });

describe('Nut Low — newGame wiring', () => {
  it('sets the lowball flag and strips every bonus card', () => {
    const s = nutLowGame();
    expect(s.lowball).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.bonusCards).toEqual([]);
    expect(s.bonusDeck).toEqual([]);
    expect(s.handBoost).toEqual({});
  });

  it('standard games stay high-hand scored', () => {
    expect(newGame('hard', seededRng(7)).lowball).toBe(false);
  });

  it('setupForMode wires the challenge route', () => {
    const setup = setupForMode({ kind: 'challenge', id: 'nut-low' });
    expect(setup.target).toBe(400);
    const s = setup.start(seededRng(3));
    expect(s.lowball).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.target).toBe(400);
  });
});

describe('Nut Low — challenge catalog', () => {
  it('is the last live entry and configured at a flat 400', () => {
    const c = LIVE_CHALLENGES[LIVE_CHALLENGES.length - 1];
    expect(c.id).toBe('nut-low');
    expect(c.name).toBe('Nut Low');
    expect(c.scoreTarget).toBe(400);
    // The daily-target rewrite (DailyDay) needs the goal to open with
    // the score sentence.
    expect(c.goal.startsWith('Score 400+ points')).toBe(true);
  });

  it('uses the fixed twist target at every difficulty', () => {
    expect(dailyTargetFor('hard', 'nut-low')).toBe(400);
    expect(dailyTargetFor('easy', 'nut-low')).toBe(400);
  });

  it('stays out of the daily rotation while the target is calibrated', () => {
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      expect(recipeFor(iso).twist).not.toBe('nut-low');
    }
  });
});
