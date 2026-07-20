import { seededRng } from '../deck';
import { findChallenge } from '../challenges';
import { suitActionAvailable } from '../actions';
import { Card } from '../cards';
import {
  BonusCard,
  BONUS_DECK_POOL,
  cardMatchesSlot,
  DOUBLER_CARD,
  isPlaceholder,
  isSpentSlot,
  SlotKind,
  SPOTLIGHT_ID,
} from '../bonusCards';
import { GameState, newGame, step } from '../state';

const SLOT_KINDS: SlotKind[] = ['special', 'in-game', 'end-game'];

// Mixed Bag challenge — newGame seeded with slotCategories. The Hard
// difficulty matches what App.tsx uses for challenges; medium exists
// for twisted dailies (swap semantics differ by difficulty).
const mixedBagAt = (difficulty: 'easy' | 'medium' | 'hard'): GameState =>
  newGame(difficulty, seededRng(42), {
    targetOverride: findChallenge('mixed-bag').scoreTarget,
    slotCategories: SLOT_KINDS,
  });
const mixedBag = (): GameState => mixedBagAt('hard');

describe('Mixed Bag challenge', () => {
  it('seeds 3 placeholder slots in category order', () => {
    const s = mixedBag();
    expect(s.bonusCards).toHaveLength(3);
    expect(s.bonusCards.map(c => c.placeholderKind)).toEqual([
      'special',
      'in-game',
      'end-game',
    ]);
    expect(s.bonusCards.every(c => isPlaceholder(c))).toBe(true);
    expect(s.slotCategories).toEqual(SLOT_KINDS);
  });

  it('bonus deck mixes regular + special pools so every slot has cards to draw', () => {
    const s = mixedBag();
    // Every slot kind has at least one drawable card in the deck.
    for (const kind of SLOT_KINDS) {
      expect(s.bonusDeck.some(c => cardMatchesSlot(c, kind))).toBe(true);
    }
  });

  it('♣ availability gate matches the reducer at the placeholder-filled cap', () => {
    // Regression: Mixed Bag runs on the Hard ruleset (bonusSwapAtCap
    // 'off') with all 3 slots seeded from turn 1, so the plain at-cap
    // gate would disable the ♣ perk for the entire game even though
    // handleBeginSuitAction accepts it. The slot-drawable context must
    // exempt Mixed Bag, exactly like the reducer.
    const s = mixedBag();
    const club: Card = { kind: 'standard', rank: '2', suit: 'C' };
    const slotDrawable = s.slotCategories!.some(
      (kind, i) =>
        !isSpentSlot(s.bonusCards[i]) &&
        s.bonusDeck.some(c => cardMatchesSlot(c, kind))
    );
    expect(slotDrawable).toBe(true);
    expect(
      suitActionAvailable(
        club,
        s.grid,
        s.bonusDeck.length,
        s.bonusCards.length,
        s.bonusSwapAtCap === 'off',
        s.investHands,
        slotDrawable
      )
    ).toBe(true);
    // …and the reducer indeed accepts the action in the same state.
    expect(step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' }).phase.kind).toBe(
      'awaiting-bonus-slot-choice'
    );
    // No drawable slot left → the gate goes dark (reducer no-ops too).
    expect(
      suitActionAvailable(
        club,
        s.grid,
        s.bonusDeck.length,
        s.bonusCards.length,
        s.bonusSwapAtCap === 'off',
        s.investHands,
        false
      )
    ).toBe(false);
  });

  it('♣ goes to awaiting-bonus-slot-choice instead of drawing directly', () => {
    let s = mixedBag();
    // Wait — Hard difficulty starts with no bonus card, and the drawn
    // card is whatever the seeded shuffle produced. To exercise the
    // ♣ path deterministically we drive it via BEGIN_SUIT_ACTION with
    // an explicit suit override.
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    expect(s.phase.kind).toBe('awaiting-bonus-slot-choice');
  });

  it('picking a slot draws 2 cards filtered to that slot category', () => {
    let s = mixedBag();
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    expect(s.phase.kind).toBe('awaiting-bonus-slot-choice');

    // Pick the green (special) slot.
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 0 });
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected to transition to bonus-card-resolving');
    }
    expect(s.phase.targetSlot).toBe(0);
    expect(s.phase.drawn.length).toBeGreaterThan(0);
    expect(s.phase.drawn.length).toBeLessThanOrEqual(2);
    for (const card of s.phase.drawn) {
      expect(cardMatchesSlot(card, 'special')).toBe(true);
    }
  });

  it('BONUS_KEEP replaces the placeholder at targetSlot, not appended', () => {
    let s = mixedBag();
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 }); // yellow slot
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected to transition to bonus-card-resolving');
    }
    const kept = s.phase.drawn[0];

    s = step(s, { type: 'BONUS_KEEP', idx: 0 });
    // Hand stays length 3, the yellow placeholder is gone, the kept
    // card is in slot 1.
    expect(s.bonusCards).toHaveLength(3);
    expect(s.bonusCards[1]).toBe(kept);
    // The other two slots are still placeholders.
    expect(isPlaceholder(s.bonusCards[0])).toBe(true);
    expect(isPlaceholder(s.bonusCards[2])).toBe(true);
  });

  it('on HARD, a live card LOCKS its slot — no re-draw, open slots still work', () => {
    let s = mixedBag();
    // First ♣ → pick slot 1 → keep a card.
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected to transition to bonus-card-resolving');
    }
    const firstKept = s.phase.drawn[0];
    s = step(s, { type: 'BONUS_KEEP', idx: 0 });
    expect(s.bonusCards[1]).toBe(firstKept);

    // Second ♣ → picking slot 1 again is REJECTED: no-swap rules
    // (bonusSwapAtCap 'off') commit a live card to its slot for the
    // run. Mixed Bag's per-slot draw is its version of the swap.
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    if (s.phase.kind !== 'awaiting-bonus-slot-choice') {
      throw new Error('Expected awaiting-bonus-slot-choice');
    }
    const atChoice = s;
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
    expect(s).toBe(atChoice);
    // An OPEN slot still draws normally.
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 2 });
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected the open slot to draw');
    }
    expect(s.phase.targetSlot).toBe(2);
  });

  it('on MEDIUM, a subsequent draw into the same slot overwrites the real card (swap)', () => {
    let s = mixedBagAt('medium');
    // First ♣ → pick slot 1 → keep a card.
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected to transition to bonus-card-resolving');
    }
    const firstKept = s.phase.drawn[0];
    s = step(s, { type: 'BONUS_KEEP', idx: 0 });
    expect(s.bonusCards[1]).toBe(firstKept);

    // Second ♣ → pick slot 1 again → overwrites (Medium keeps Mixed
    // Bag's swap-on-pick; finishBonusFlow's drawNext left us back in
    // awaiting-action with a fresh draw).
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    if (s.phase.kind !== 'awaiting-bonus-slot-choice') {
      throw new Error('Expected awaiting-bonus-slot-choice');
    }
    s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
    if (s.phase.kind !== 'bonus-card-resolving') {
      throw new Error('Expected to transition to bonus-card-resolving');
    }
    const secondKept = s.phase.drawn[0];
    s = step(s, { type: 'BONUS_KEEP', idx: 0 });
    // Slot 1 now holds the second-kept card; firstKept is gone.
    expect(s.bonusCards[1]).toBe(secondKept);
    // swappedBonus flagged because we overwrote a real card.
    expect(s.swappedBonus).toBe(true);
  });

  describe('declining a categorized draw', () => {
    // The 3 placeholder slots make bonusCards.length read "at cap" from
    // turn 1, so the decline gate must judge by the TARGET SLOT's
    // occupant: an open (placeholder) slot follows the below-cap
    // difficulty rule, a held card follows bonusDeclineAllowed.
    it('on HARD, an open-slot draw can be declined — ♣ to discards, drawn back to the deck', () => {
      let s = mixedBag();
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
      if (s.phase.kind !== 'bonus-card-resolving') {
        throw new Error('Expected bonus-card-resolving');
      }
      const drawnCount = s.phase.drawn.length;
      const deckBefore = s.bonusDeck.length;
      const discardsBefore = s.discards.length;
      const perkSpentBefore = s.perkSpent.length;
      s = step(s, { type: 'BONUS_DECLINE' });
      expect(s.phase.kind).toBe('awaiting-action');
      // Hand untouched — all three slots still placeholders.
      expect(s.bonusCards.every(c => isPlaceholder(c))).toBe(true);
      // The drawn cards went back to the deck…
      expect(s.bonusDeck.length).toBe(deckBefore + drawnCount);
      // …and the ♣ retired to discards, not perkSpent (Burnout/Frugal
      // don't count a declined draw).
      expect(s.discards.length).toBe(discardsBefore + 1);
      expect(s.perkSpent.length).toBe(perkSpentBefore);
    });

    it('on MEDIUM, an open-slot draw can be declined too', () => {
      let s = mixedBagAt('medium');
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 2 });
      expect(s.phase.kind).toBe('bonus-card-resolving');
      s = step(s, { type: 'BONUS_DECLINE' });
      expect(s.phase.kind).toBe('awaiting-action');
      expect(s.bonusCards.every(c => isPlaceholder(c))).toBe(true);
    });

    it('on MEDIUM, drawing onto a HELD card cannot be declined (committed swap)', () => {
      // Seat a real card, then draw onto its slot: picking an occupied
      // slot commits to the swap on Medium (bonusDeclineAllowed=false),
      // exactly like the classic at-cap draw.
      let s = mixedBagAt('medium');
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
      if (s.phase.kind !== 'bonus-card-resolving') {
        throw new Error('Expected bonus-card-resolving');
      }
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
      if (s.phase.kind !== 'bonus-card-resolving') {
        throw new Error('Expected bonus-card-resolving for the re-draw');
      }
      const atResolve = s;
      s = step(s, { type: 'BONUS_DECLINE' });
      expect(s).toBe(atResolve);
    });

    it('on EASY, an open-slot draw cannot be declined (taking is free)', () => {
      let s = mixedBagAt('easy');
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 0 });
      if (s.phase.kind !== 'bonus-card-resolving') {
        throw new Error('Expected bonus-card-resolving');
      }
      const atResolve = s;
      s = step(s, { type: 'BONUS_DECLINE' });
      expect(s).toBe(atResolve);
    });
  });

  it('CANCEL_ACTION on slot-choice returns to awaiting-action without spending the ♣', () => {
    let s = mixedBag();
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
    expect(s.phase.kind).toBe('awaiting-bonus-slot-choice');
    const beforePerkSpent = s.perkSpent.length;
    s = step(s, { type: 'CANCEL_ACTION' });
    expect(s.phase.kind).toBe('awaiting-action');
    // Drawn card is still in hand (cancel doesn't spend it).
    expect(s.perkSpent.length).toBe(beforePerkSpent);
  });

  describe('spent green slot (used one-time action)', () => {
    const seatCard = (s: GameState, slot: number, card: BonusCard): GameState => {
      const hand = s.bonusCards.slice();
      hand[slot] = card;
      return { ...s, bonusCards: hand };
    };

    it('a used special slot refuses BONUS_PICK_SLOT — spent for the game', () => {
      let s = mixedBag();
      s = seatCard(s, 0, { ...DOUBLER_CARD, used: true });
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      expect(s.phase.kind).toBe('awaiting-bonus-slot-choice');
      const before = s;
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 0 });
      // No-op: the pick is rejected, the choice stays open, and the
      // used card is untouched.
      expect(s).toBe(before);
      expect(s.bonusCards[0].id).toBe(DOUBLER_CARD.id);
      expect(s.bonusCards[0].used).toBe(true);
    });

    it('other slots stay replaceable while the green slot is spent', () => {
      let s = mixedBag();
      s = seatCard(s, 0, { ...DOUBLER_CARD, used: true });
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      s = step(s, { type: 'BONUS_PICK_SLOT', slot: 1 });
      if (s.phase.kind !== 'bonus-card-resolving') {
        throw new Error('Expected bonus-card-resolving for the yellow slot');
      }
      expect(s.phase.targetSlot).toBe(1);
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      // The kept yellow landed; the spent green card persisted, still
      // marked used.
      expect(isPlaceholder(s.bonusCards[1])).toBe(false);
      expect(s.bonusCards[0].id).toBe(DOUBLER_CARD.id);
      expect(s.bonusCards[0].used).toBe(true);
    });

    it('an UNUSED special locks its slot on HARD, but stays swappable on MEDIUM', () => {
      // Hard: a live card (used or not) commits its slot — rejected.
      let hard = mixedBag();
      hard = seatCard(hard, 0, { ...DOUBLER_CARD });
      hard = step(hard, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      const atChoice = hard;
      hard = step(hard, { type: 'BONUS_PICK_SLOT', slot: 0 });
      expect(hard).toBe(atChoice);
      // Medium keeps the swap-on-pick.
      let med = mixedBagAt('medium');
      med = seatCard(med, 0, { ...DOUBLER_CARD });
      med = step(med, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      med = step(med, { type: 'BONUS_PICK_SLOT', slot: 0 });
      expect(med.phase.kind).toBe('bonus-card-resolving');
    });

    it('♣ is unavailable when the only drawable slot is spent', () => {
      let s = mixedBag();
      s = seatCard(s, 0, { ...DOUBLER_CARD, used: true });
      // Deck reduced to special-only cards: the green slot is the only
      // category with drawable cards, and it is spent.
      s = {
        ...s,
        bonusDeck: s.bonusDeck.filter(c => cardMatchesSlot(c, 'special')),
      };
      const before = s;
      s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'C' });
      expect(s).toBe(before);
      expect(s.phase.kind).toBe('awaiting-action');
    });
  });

  describe('Spotlight exclusivity', () => {
    // Helper: surgically pre-place a card at a Mixed Bag slot. Mirrors
    // what handleBonusKeep does for the categorized-slot path.
    const seatCard = (s: GameState, slot: number, card: BonusCard): GameState => {
      const hand = s.bonusCards.slice();
      hand[slot] = card;
      return { ...s, bonusCards: hand };
    };
    const spotlightCard = (): BonusCard => {
      const c = BONUS_DECK_POOL.find(b => b.id === SPOTLIGHT_ID);
      if (!c) throw new Error('Spotlight not in pool');
      return c;
    };
    const aYellow = (): BonusCard => {
      const c = BONUS_DECK_POOL.find(b => b.lineEffect && !b.gridEffect);
      if (!c) throw new Error('No yellow card in pool');
      return c;
    };
    const aPurple = (): BonusCard => {
      // Pick a purple that ISN'T Spotlight so the "another purple
      // arrives" scenario works.
      const c = BONUS_DECK_POOL.find(
        b => b.gridEffect && !b.lineEffect && b.id !== SPOTLIGHT_ID
      );
      if (!c) throw new Error('No non-Spotlight purple card in pool');
      return c;
    };

    it('picking up Spotlight clears unused real cards from the other slots', () => {
      let s = mixedBag();
      // Slot 1 (yellow): a real bonus card. Slot 0 (green): leave the
      // placeholder. Slot 2 (purple): about to receive Spotlight.
      s = seatCard(s, 1, aYellow());
      // Stuff Spotlight directly into the drawn flow at slot 2.
      s = {
        ...s,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: [spotlightCard()],
          targetSlot: 2,
          returnTo: 'awaiting-action',
        },
      };
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      // Slot 2 holds Spotlight, slot 1 has been reset to its yellow
      // placeholder, slot 0 was already a green placeholder.
      expect(s.bonusCards[2].id).toBe(SPOTLIGHT_ID);
      expect(isPlaceholder(s.bonusCards[1])).toBe(true);
      expect(s.bonusCards[1].placeholderKind).toBe('in-game');
      expect(isPlaceholder(s.bonusCards[0])).toBe(true);
      expect(s.bonusCards[0].placeholderKind).toBe('special');
    });

    it('used green specials survive a Spotlight pickup', () => {
      let s = mixedBag();
      // Slot 0 (green): a USED special card. Spotlight arrives in slot 2.
      s = seatCard(s, 0, { ...DOUBLER_CARD, used: true });
      s = {
        ...s,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: [spotlightCard()],
          targetSlot: 2,
          returnTo: 'awaiting-action',
        },
      };
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      // The used Doubler stays — it was already disabled, not active.
      expect(s.bonusCards[0].id).toBe(DOUBLER_CARD.id);
      expect(s.bonusCards[0].used).toBe(true);
      expect(s.bonusCards[2].id).toBe(SPOTLIGHT_ID);
    });

    it('Spotlight is discarded when another bonus card lands in another slot', () => {
      let s = mixedBag();
      // Slot 2 (purple): Spotlight already held.
      s = seatCard(s, 2, spotlightCard());
      // A new yellow card arrives in slot 1.
      const yellow = aYellow();
      s = {
        ...s,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: [yellow],
          targetSlot: 1,
          returnTo: 'awaiting-action',
        },
      };
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      // Slot 1 holds the new yellow; Spotlight's slot is back to its
      // purple placeholder.
      expect(s.bonusCards[1].id).toBe(yellow.id);
      expect(isPlaceholder(s.bonusCards[2])).toBe(true);
      expect(s.bonusCards[2].placeholderKind).toBe('end-game');
    });

    it("Spotlight is also discarded if another purple card lands in Spotlight's own slot", () => {
      let s = mixedBag();
      s = seatCard(s, 2, spotlightCard());
      const purple = aPurple();
      s = {
        ...s,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: [purple],
          targetSlot: 2,
          returnTo: 'awaiting-action',
        },
      };
      s = step(s, { type: 'BONUS_KEEP', idx: 0 });
      // The new purple replaces Spotlight at slot 2 naturally — no
      // surviving Spotlight anywhere.
      expect(s.bonusCards[2].id).toBe(purple.id);
      expect(s.bonusCards.some(c => c.id === SPOTLIGHT_ID)).toBe(false);
    });
  });
});
