import { describe, expect, it } from 'vitest';
import { categoryOf } from '../../lib/bonusCardCategory';
import { setupForMode } from '../../features/game/modes';
import { SPOTLIGHT_ID } from '../bonusCards';
import { StandardCard } from '../cards';
import { recipeFor } from '../daily/recipe';
import { currentDateISO } from '../daily/seed';
import { seededRng } from '../deck';
import { GameState, step } from '../state';

const CLUB: StandardCard = { kind: 'standard', rank: '7', suit: 'C' };

const newTradingPost = (seed = 5): GameState =>
  setupForMode({ kind: 'challenge', id: 'trading-post' }).start(
    seededRng(seed)
  );

// The reducer only reads s.drawn for perk legality, so rigging a club
// into the well is the standard way to exercise a suit flow on demand.
const withClubDrawn = (s: GameState): GameState => ({ ...s, drawn: CLUB });

const GOLD = new Set(['hand', 'line', 'suit', 'conditional']);

describe('Trading Post — construction', () => {
  it('deals 2 gold + 1 purple, locked (no bonus deck), flag set', () => {
    const s = newTradingPost();
    expect(s.tradingPost).toBe(true);
    expect(s.target).toBe(500);
    expect(s.bonusDeck).toHaveLength(0);
    expect(s.bonusCards).toHaveLength(3);
    const cats = s.bonusCards.map(categoryOf);
    expect(cats.filter(c => GOLD.has(c))).toHaveLength(2);
    expect(cats.filter(c => !GOLD.has(c))).toHaveLength(1);
    // No duplicates, and Spotlight (exclusive-in-hand) sits out.
    expect(new Set(s.bonusCards.map(c => c.id)).size).toBe(3);
    expect(s.bonusCards.some(c => c.id === SPOTLIGHT_ID)).toBe(false);
  });

  it('is deterministic per seed', () => {
    const ids = (seed: number) => newTradingPost(seed).bonusCards.map(c => c.id);
    expect(ids(7)).toEqual(ids(7));
    expect(ids(7)).not.toEqual(ids(8));
  });
});

describe('Trading Post dailies', () => {
  it('is in the rotation, wires the flag, and deals a globally-identical trio', () => {
    // Sweep years of recipes until the twist channel picks it (1/13 of
    // twisted days under the flat weights; a decade is plenty).
    let hit: string | null = null;
    const start = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 3650 && !hit; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      const iso = currentDateISO(d);
      if (recipeFor(iso).twist === 'trading-post') hit = iso;
    }
    expect(hit).not.toBeNull();
    const setup = setupForMode({
      kind: 'daily',
      dateISO: hit!,
      recipe: recipeFor(hit!),
    });
    // The trio is date-salted, so two players' deals (different deck
    // rngs) still hold the identical locked hand.
    const a = setup.start(seededRng(1));
    const b = setup.start(seededRng(2));
    expect(a.tradingPost).toBe(true);
    expect(a.bonusDeck).toHaveLength(0);
    expect(a.bonusCards.map(c => c.id)).toEqual(b.bonusCards.map(c => c.id));
    const cats = a.bonusCards.map(categoryOf);
    expect(cats.filter(c => GOLD.has(c))).toHaveLength(2);
    expect(cats.filter(c => !GOLD.has(c))).toHaveLength(1);
  });
});

describe('Trading Post — the ♣ Trade flow', () => {
  it('BEGIN with a club opens slot targeting on occupied slots', () => {
    const s = withClubDrawn(newTradingPost());
    const t = step(s, { type: 'BEGIN_SUIT_ACTION' });
    expect(t.phase.kind).toBe('awaiting-target-trade');
    if (t.phase.kind !== 'awaiting-target-trade') return;
    expect(t.phase.targets.length).toBeGreaterThan(0);
    for (const slot of t.phase.targets) {
      expect(s.grid[slot]).not.toBeNull();
    }
    // Nothing drawn yet — the deck is untouched until a slot is picked.
    expect(t.deck).toHaveLength(s.deck.length);
  });

  it('BEGIN is rejected with fewer than 2 cards in the deck', () => {
    const s = withClubDrawn(newTradingPost());
    const short = { ...s, deck: s.deck.slice(0, 1) };
    expect(step(short, { type: 'BEGIN_SUIT_ACTION' }).phase.kind).toBe(
      'awaiting-action'
    );
  });

  it('cancel from targeting returns to awaiting-action, deck intact', () => {
    const s = withClubDrawn(newTradingPost());
    const t = step(s, { type: 'BEGIN_SUIT_ACTION' });
    const back = step(t, { type: 'CANCEL_ACTION' });
    expect(back.phase.kind).toBe('awaiting-action');
    expect(back.deck).toHaveLength(s.deck.length);
  });

  const toPick = (seed = 5) => {
    const s = withClubDrawn(newTradingPost(seed));
    const t = step(s, { type: 'BEGIN_SUIT_ACTION' });
    if (t.phase.kind !== 'awaiting-target-trade') throw new Error('no target phase');
    const slot = t.phase.targets[0];
    return { start: s, slot, pick: step(t, { type: 'TRADE_SELECT_SLOT', slot }) };
  };

  it('picking a slot reveals the top two deck cards', () => {
    const { start, slot, pick } = toPick();
    expect(pick.phase.kind).toBe('trade-pick');
    if (pick.phase.kind !== 'trade-pick') return;
    expect(pick.phase.slot).toBe(slot);
    expect(pick.phase.drawn).toHaveLength(2);
    expect(pick.phase.drawn).toEqual(start.deck.slice(0, 2));
    expect(pick.deck).toHaveLength(start.deck.length - 2);
  });

  it('a slot outside the targets is rejected', () => {
    const s = withClubDrawn(newTradingPost());
    const t = step(s, { type: 'BEGIN_SUIT_ACTION' });
    if (t.phase.kind !== 'awaiting-target-trade') throw new Error();
    const empty = s.grid.findIndex(c => c === null);
    expect(step(t, { type: 'TRADE_SELECT_SLOT', slot: empty })).toBe(t);
  });

  it('the reveal cannot be cancelled — the pick must resolve', () => {
    const { pick } = toPick();
    const after = step(pick, { type: 'CANCEL_ACTION' });
    expect(after.phase).toBe(pick.phase);
  });

  it('resolving seats the chosen card and trashes both the old one and the pass', () => {
    const { start, slot, pick } = toPick();
    if (pick.phase.kind !== 'trade-pick') throw new Error();
    const [passed, chosen] = pick.phase.drawn;
    const old = start.grid[slot]!;
    const done = step(pick, { type: 'RESOLVE_TRADE', idx: 1 });
    expect(done.grid[slot]).toEqual(chosen);
    // Both the old board card AND the passed-over draw are trashed to
    // discards (Trash Joker territory) — nothing returns to the deck…
    expect(done.discards).toContain(old);
    expect(done.discards).toContain(passed);
    expect(done.deck).not.toContain(passed);
    // …the spent club logs as a perk, and the next card has drawn.
    expect(done.perkSpent).toContain(CLUB);
    // Net deck cost of a trade turn: both revealed cards + the next draw.
    expect(done.deck).toHaveLength(start.deck.length - 3);
  });

  it('undo rewinds the whole trade', () => {
    const { start, slot, pick } = toPick();
    const done = step(pick, { type: 'RESOLVE_TRADE', idx: 0 });
    const undone = step(done, { type: 'UNDO' });
    expect(undone.grid[slot]).toEqual(start.grid[slot]);
  });
});
