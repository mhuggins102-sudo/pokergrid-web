import { describe, expect, it } from 'vitest';
import { newGame, step } from '../state';
import { seededRng } from '../deck';

// Build a Scatter game (scatter is newGame's final positional arg).
const newScatter = (rng: () => number) =>
  newGame(
    'hard',
    rng,
    undefined, // targetOverride
    undefined, // deckLimit
    false, // noSwap
    false, // noDiscards
    [], // keptBonusCards
    [], // deckExtras
    [], // superchargedDeckCards
    false, // randomPerks
    false, // noBonusCards
    [], // initialBonusCards
    undefined, // slotCategories
    0, // randomGridFill
    true // scatter
  );

describe('Scatter twist', () => {
  it('targets a random empty slot for the drawn card', () => {
    const s = newScatter(seededRng(7));
    expect(s.scatter).toBe(true);
    expect(s.scatterSlot).not.toBeNull();
    // The target is an empty slot, and the drawn card is waiting.
    expect(s.grid[s.scatterSlot!]).toBeNull();
    expect(s.drawn).not.toBeNull();
  });

  it('places the drawn card on its scatter slot and re-rolls the next', () => {
    const rng = seededRng(7);
    const s0 = newScatter(rng);
    const target = s0.scatterSlot!;
    const s1 = step(s0, { type: 'PLACE' }, rng);
    // The card landed on the pre-rolled slot…
    expect(s1.grid[target]).not.toBeNull();
    // …and a fresh, different slot is chosen for the next card (the old
    // one is now filled).
    expect(s1.scatterSlot).not.toBe(target);
    expect(s1.grid[s1.scatterSlot!]).toBeNull();
  });

  it('does not always start at the center (unlike the spiral)', () => {
    // Across several seeds the first target should land somewhere other
    // than slot 12 at least once (the spiral always starts at 12).
    const offCenter = [1, 2, 3, 4, 5, 6, 7, 8].some(
      seed => newScatter(seededRng(seed)).scatterSlot !== 12
    );
    expect(offCenter).toBe(true);
  });

  it('is deterministic for a fixed seed (same moves → same board)', () => {
    const rngA = seededRng(42);
    const rngB = seededRng(42);
    let a = newScatter(rngA);
    let b = newScatter(rngB);
    expect(a.scatterSlot).toBe(b.scatterSlot);
    for (let i = 0; i < 5; i++) {
      a = step(a, { type: 'PLACE' }, rngA);
      b = step(b, { type: 'PLACE' }, rngB);
    }
    expect(a.grid).toEqual(b.grid);
    expect(a.scatterSlot).toBe(b.scatterSlot);
  });

  it('leaves normal games on the spiral (first card at center)', () => {
    const s = newGame('hard', seededRng(7));
    expect(s.scatter).toBe(false);
    expect(s.scatterSlot).toBeNull();
    expect(s.grid[12]).not.toBeNull();
  });
});
