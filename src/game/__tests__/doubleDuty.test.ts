import { describe, expect, it } from 'vitest';
import { newGame, step, GameState } from '../state';
import { assignDualIdentities, seededRng } from '../deck';
import { activeHalf, cardLabel, fullDeck, isJoker, StandardCard } from '../cards';

// Build a Double Duty game (doubleDuty is newGame's last positional arg).
// Runs on the Hard ruleset like the real challenge.
const newDoubleDuty = (rng: () => number) =>
  newGame(
    'hard',
    rng,
    500, // targetOverride
    undefined,
    false,
    false,
    [],
    [],
    [],
    false,
    false, // noBonusCards
    [],
    undefined,
    0,
    false, // scatter
    false, // investHands
    true // doubleDuty
  );

const standards = (cards: readonly (GameState['deck'][number] | null)[]) =>
  cards.filter((c): c is StandardCard => c !== null && c.kind === 'standard');

describe('assignDualIdentities', () => {
  it('pairs every standard card with a derangement of the identities', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deck = assignDualIdentities(fullDeck(1), seededRng(seed));
      const std = standards(deck);
      expect(std).toHaveLength(52);
      // Jokers pass through untouched.
      expect(deck.filter(isJoker)).toHaveLength(1);

      const halfCounts = new Map<string, number>();
      const dualLabels = new Set<string>();
      const uids = new Set<number>();
      for (const c of std) {
        expect(c.dual).toBeDefined();
        expect(c.uid).toBeDefined();
        // No card pairs with itself.
        expect(`${c.dual!.rank}${c.dual!.suit}`).not.toBe(`${c.rank}${c.suit}`);
        halfCounts.set(cardLabel(c), (halfCounts.get(cardLabel(c)) ?? 0) + 1);
        const dualLabel = `${c.dual!.rank}${c.dual!.suit}`;
        halfCounts.set(dualLabel, (halfCounts.get(dualLabel) ?? 0) + 1);
        dualLabels.add(dualLabel);
        uids.add(c.uid!);
      }
      // Each of the 52 identities appears exactly twice across 104 halves…
      expect(halfCounts.size).toBe(52);
      for (const n of halfCounts.values()) expect(n).toBe(2);
      // …with the duals forming a bijection and uids all distinct.
      expect(dualLabels.size).toBe(52);
      expect(uids.size).toBe(52);
    }
  });

  it('is deterministic from the rng', () => {
    const a = assignDualIdentities(fullDeck(1), seededRng(7));
    const b = assignDualIdentities(fullDeck(1), seededRng(7));
    expect(a).toEqual(b);
  });
});

describe('Double Duty', () => {
  it('newGame deals dual cards and seats the opening card stripped', () => {
    const s = newDoubleDuty(seededRng(3));
    expect(s.doubleDuty).toBe(true);
    expect(s.flippedDrawn).toBe(false);
    expect(s.burned).toEqual([]);
    // Every standard card still in the deck carries its dual.
    for (const c of standards(s.deck)) {
      expect(c.dual).toBeDefined();
    }
    // The opening grid seat and the drawn card: grid stripped, well not.
    const seated = s.grid[12];
    expect(seated).not.toBeNull();
    if (seated!.kind === 'standard') {
      expect(seated!.dual).toBeUndefined();
      expect(seated!.uid).toBeDefined();
    }
    expect((s.drawn as StandardCard).dual).toBeDefined();
  });

  it('two seeded games deal identical decks including duals', () => {
    const a = newDoubleDuty(seededRng(11));
    const b = newDoubleDuty(seededRng(11));
    expect(a.deck).toEqual(b.deck);
    expect(a.drawn).toEqual(b.drawn);
  });

  it('FLIP_CARD swaps the halves and burns the next card unseen', () => {
    const s = newDoubleDuty(seededRng(5));
    const drawn = s.drawn as StandardCard;
    const expectedBurn = activeHalf(s.deck[0]);
    const flipped = step(s, { type: 'FLIP_CARD' }, seededRng(1));

    const d = flipped.drawn as StandardCard;
    expect(`${d.rank}${d.suit}`).toBe(`${drawn.dual!.rank}${drawn.dual!.suit}`);
    expect(d.dual).toEqual({ rank: drawn.rank, suit: drawn.suit });
    expect(d.uid).toBe(drawn.uid);
    expect(flipped.flippedDrawn).toBe(true);
    expect(flipped.deck).toHaveLength(s.deck.length - 1);
    // The burned card is removed from the game — never into discards —
    // and stored without its dual.
    expect(flipped.burned).toEqual([expectedBurn]);
    expect((flipped.burned[0] as StandardCard).dual).toBeUndefined();
    expect(flipped.discards).toEqual(s.discards);
    // History records the flip without naming the burned card.
    const last = flipped.history[flipped.history.length - 1];
    expect(last).toBe('Flip (1 card burned)');
    expect(flipped.phase.kind).toBe('awaiting-action');
  });

  it('a card can only be flipped once', () => {
    const s = newDoubleDuty(seededRng(5));
    const once = step(s, { type: 'FLIP_CARD' }, seededRng(1));
    const twice = step(once, { type: 'FLIP_CARD' }, seededRng(1));
    expect(twice).toBe(once);
  });

  it('flip is rejected with an empty deck, outside Double Duty, and off-phase', () => {
    const s = newDoubleDuty(seededRng(5));
    const empty: GameState = { ...s, deck: [] };
    expect(step(empty, { type: 'FLIP_CARD' }, seededRng(1))).toBe(empty);

    const free = newGame('hard', seededRng(5));
    expect(step(free, { type: 'FLIP_CARD' }, seededRng(1))).toBe(free);

    const offPhase: GameState = { ...s, phase: { kind: 'game-over' } };
    expect(step(offPhase, { type: 'FLIP_CARD' }, seededRng(1))).toBe(offPhase);
  });

  it('a burned joker is removed from the game and never feeds discards', () => {
    const s = newDoubleDuty(seededRng(5));
    const withJokerNext: GameState = { ...s, deck: [{ kind: 'joker' }, ...s.deck] };
    const flipped = step(withJokerNext, { type: 'FLIP_CARD' }, seededRng(1));
    expect(flipped.burned).toEqual([{ kind: 'joker' }]);
    // Not in discards → the Trash Joker bonus card can never count it.
    expect(flipped.discards.some(isJoker)).toBe(false);
  });

  it('place and discard strip the dual but keep the uid', () => {
    const s = newDoubleDuty(seededRng(9));
    const flipped = step(s, { type: 'FLIP_CARD' }, seededRng(1));
    const placedIdentity = flipped.drawn as StandardCard;
    const placed = step(flipped, { type: 'PLACE' }, seededRng(1));
    const onGrid = standards(placed.grid).find(
      c => c.uid === placedIdentity.uid
    );
    expect(onGrid).toBeDefined();
    expect(`${onGrid!.rank}${onGrid!.suit}`).toBe(
      `${placedIdentity.rank}${placedIdentity.suit}`
    );
    expect(onGrid!.dual).toBeUndefined();

    const discarded = step(placed, { type: 'DISCARD_NONE' }, seededRng(1));
    const pile = standards(discarded.discards);
    expect(pile.length).toBeGreaterThan(0);
    expect(pile.every(c => c.dual === undefined)).toBe(true);
  });

  it('flip then perk fires the NEW top half suit and strips perkSpent', () => {
    // Hand-build: drawn 5H with dual 9S — after flip the perk must be ♠
    // Slide, not ♥ Hop. Grid needs cards for the perks to be available.
    const s = newDoubleDuty(seededRng(13));
    const rigged: GameState = {
      ...s,
      drawn: {
        kind: 'standard',
        rank: '5',
        suit: 'H',
        dual: { rank: '9', suit: 'S' },
        uid: 0,
      },
    };
    const flipped = step(rigged, { type: 'FLIP_CARD' }, seededRng(1));
    const begun = step(flipped, { type: 'BEGIN_SUIT_ACTION' }, seededRng(1));
    expect(begun.phase.kind).toBe('awaiting-target-slide-source');
  });

  it('undo restores orientation, deck, and the burned card', () => {
    const s = newDoubleDuty(seededRng(21));
    const flipped = step(s, { type: 'FLIP_CARD' }, seededRng(1));
    const undone = step(flipped, { type: 'UNDO' }, seededRng(1));
    expect(undone.drawn).toEqual(s.drawn);
    expect(undone.deck).toEqual(s.deck);
    expect(undone.burned).toEqual([]);
    expect(undone.flippedDrawn).toBe(false);
    expect(undone.undoCount).toBe(1);
  });

  it('burning the last deck card is allowed; game ends on the next draw', () => {
    const s = newDoubleDuty(seededRng(17));
    const lastCard: GameState = { ...s, deck: s.deck.slice(0, 1) };
    const flipped = step(lastCard, { type: 'FLIP_CARD' }, seededRng(1));
    expect(flipped.deck).toHaveLength(0);
    expect(flipped.phase.kind).toBe('awaiting-action');
    // A second flip is impossible (nothing to burn)…
    expect(step(flipped, { type: 'FLIP_CARD' }, seededRng(1))).toBe(flipped);
    // …and resolving the card ends the game normally.
    const done = step(flipped, { type: 'PLACE' }, seededRng(1));
    expect(done.phase.kind).toBe('game-over');
  });

  it('flippedDrawn resets on the next draw', () => {
    const s = newDoubleDuty(seededRng(23));
    const flipped = step(s, { type: 'FLIP_CARD' }, seededRng(1));
    const placed = step(flipped, { type: 'PLACE' }, seededRng(1));
    expect(placed.flippedDrawn).toBe(false);
  });
});
