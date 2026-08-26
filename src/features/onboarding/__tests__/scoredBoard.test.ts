import { describe, expect, it } from 'vitest';
import { scoreGrid } from '../../../game/scoring';
import { cardLabel, isJoker } from '../../../game/cards';
import { dealScoredBoard } from '../introTourPages';

describe('dealScoredBoard (slide 7 demo board)', () => {
  it('always builds a full, duplicate-free board with ≥4 hand types', () => {
    for (let i = 0; i < 50; i++) {
      const { deal, report } = dealScoredBoard();
      expect(deal).toHaveLength(25);
      // Real deck: no jokers, no duplicate cards.
      expect(deal.some(isJoker)).toBe(false);
      expect(new Set(deal.map(cardLabel)).size).toBe(25);
      // The rails show this exact report; it must carry at least four
      // distinct scoring hand types across its ten lines.
      const kinds = new Set(
        report.lines.map(l => l.hand).filter(h => h && h !== 'HIGH_CARD')
      );
      expect(kinds.size).toBeGreaterThanOrEqual(4);
      // And the report really is the deal's scoring.
      expect(
        scoreGrid(deal, [], { ignoreIncompletePenalty: true }).total
      ).toBe(report.total);
    }
  });
});
