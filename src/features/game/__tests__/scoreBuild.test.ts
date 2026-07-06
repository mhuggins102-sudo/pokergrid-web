import { newGame, step } from '../../../game/state';
import { seededRng } from '../../../game/deck';
import { scoreGrid } from '../../../game/scoring';
import { computeScoreBuild } from '../scoreBreakdown';
import { categoryOf } from '../../../lib/bonusCardCategory';

// Play a seeded game to completion, keeping every ♣ draw, so the end
// state carries a mix of gold and purple bonus cards.
const finishedState = (seed: number) => {
  let s = newGame('easy', seededRng(seed));
  for (let i = 0; i < 400 && s.phase.kind !== 'game-over'; i++) {
    if (s.phase.kind === 'bonus-card-resolving') {
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
    } else if (s.phase.kind === 'bonus-card-replacing') {
      s = step(s, { type: 'BONUS_REPLACE', oldIdx: 0 });
    } else if (s.phase.kind === 'awaiting-action') {
      // Spend clubs on ♣ Bonus when possible to accumulate cards.
      const drawn = s.drawn;
      if (drawn && drawn.kind === 'standard' && drawn.suit === 'C') {
        const next = step(s, { type: 'BEGIN_SUIT_ACTION' });
        s = next.phase.kind === s.phase.kind ? step(s, { type: 'PLACE' }) : next;
      } else {
        s = step(s, { type: 'PLACE' });
      }
    } else {
      break;
    }
  }
  return s;
};

describe('computeScoreBuild', () => {
  it.each([5, 93, 7])(
    'per-card rows reproduce the aggregate report (seed %i)',
    seed => {
      const s = finishedState(seed);
      const options = {
        deckRemaining: s.deck.length,
        discards: s.discards,
        perkSpent: s.perkSpent,
        handBoost: s.handBoost,
      };
      const report = scoreGrid(s.grid, s.bonusCards, options);
      const build = computeScoreBuild(s.grid, s.bonusCards, report, options);

      // Gold rows sum exactly to the aggregate gold add.
      const goldSum = build.golds.reduce((a, g) => a + g.add, 0);
      expect(goldSum).toBe(build.goldAdd);

      // Purple factors multiply (and flats sum) back to the report.
      const mult = build.purples.reduce((a, p) => a * p.multiplier, 1);
      const flat = build.purples.reduce((a, p) => a + p.flat, 0);
      expect(mult).toBeCloseTo(report.gridMultiplier, 10);
      expect(flat).toBe(report.gridFlat);

      // The displayed chain reproduces the final score.
      expect(Math.ceil(build.subtotal * report.gridMultiplier) + report.gridFlat).toBe(
        build.total
      );

      // Gold rows only contain gold-category cards; purple rows purple.
      for (const g of build.golds) {
        expect(['hand', 'line', 'suit', 'conditional']).toContain(
          categoryOf(g.card)
        );
      }
      for (const p of build.purples) {
        expect(['grid', 'deck-management']).toContain(categoryOf(p.card));
      }
    }
  );
});
