/* PokerGrid — playable engine, ported from src/game/hands.ts + scoring.ts.
   Classic script; assigns window.PG_ENGINE. Base scoring only (bonus-card
   effect functions are not ported) — enough for a real, live play loop. */
(function () {
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUITS = ['H', 'S', 'D', 'C'];
  const SUIT_GLYPH = { H: '♥', S: '♠', D: '♦', C: '♣' };
  const SUIT_VAR = { H: 'var(--face-suit-h)', S: 'var(--face-suit-s)', D: 'var(--face-suit-d)', C: 'var(--face-suit-c)' };
  const rankIndex = (r) => (r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : parseInt(r, 10));

  const HAND_BASE_VALUE = {
    HIGH_CARD: 0, PAIR: 5, TWO_PAIR: 12, THREE_OF_A_KIND: 20, STRAIGHT: 30,
    FLUSH: 40, FULL_HOUSE: 50, FOUR_OF_A_KIND: 70, STRAIGHT_FLUSH: 90,
    ROYAL_FLUSH: 120, FIVE_OF_A_KIND: 150,
  };
  const HAND_TIER = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_OF_A_KIND: 3, STRAIGHT: 4, FLUSH: 5,
    FULL_HOUSE: 6, FOUR_OF_A_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9, FIVE_OF_A_KIND: 10,
  };
  const HAND_NAME = {
    HIGH_CARD: 'High Card', PAIR: 'Pair', TWO_PAIR: 'Two Pair', THREE_OF_A_KIND: 'Three of a Kind',
    STRAIGHT: 'Straight', FLUSH: 'Flush', FULL_HOUSE: 'Full House', FOUR_OF_A_KIND: 'Four of a Kind',
    STRAIGHT_FLUSH: 'Straight Flush', ROYAL_FLUSH: 'Royal Flush', FIVE_OF_A_KIND: 'Five of a Kind',
  };
  const INCOMPLETE_LINE_PENALTY = -25;

  const isJoker = (c) => c && c.kind === 'joker';

  const evalStandardFive = (cards) => {
    const counts = new Map();
    for (const c of cards) { const r = rankIndex(c.rank); counts.set(r, (counts.get(r) || 0) + 1); }
    const multiset = [...counts.values()].sort((a, b) => b - a);
    const suitCounts = new Map();
    for (const c of cards) suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
    const isFlush = Math.max(...suitCounts.values()) >= 5;
    const ranks = cards.map((c) => rankIndex(c.rank)).sort((a, b) => a - b);
    const uniq = [...new Set(ranks)];
    let isStraight = false;
    if (uniq.length === 5) {
      if (uniq[4] - uniq[0] === 4) isStraight = true;
      if (uniq.join(',') === '2,3,4,5,14') isStraight = true;
    }
    if (multiset[0] >= 5) return 'FIVE_OF_A_KIND';
    if (isStraight && isFlush) { if (uniq.join(',') === '10,11,12,13,14') return 'ROYAL_FLUSH'; return 'STRAIGHT_FLUSH'; }
    if (multiset[0] === 4) return 'FOUR_OF_A_KIND';
    if (multiset[0] === 3 && multiset[1] >= 2) return 'FULL_HOUSE';
    if (isFlush) return 'FLUSH';
    if (isStraight) return 'STRAIGHT';
    if (multiset[0] === 3) return 'THREE_OF_A_KIND';
    if (multiset[0] === 2 && multiset[1] === 2) return 'TWO_PAIR';
    if (multiset[0] === 2) return 'PAIR';
    return 'HIGH_CARD';
  };

  const evalWithJokers = (standards, jokerCount) => {
    if (jokerCount === 0) return evalStandardFive(standards);
    let best = 'HIGH_CARD';
    for (const suit of SUITS) for (const rank of RANKS) {
      const res = evalWithJokers([...standards, { kind: 'standard', rank, suit }], jokerCount - 1);
      if (HAND_TIER[res] > HAND_TIER[best]) best = res;
    }
    return best;
  };

  // line = array of 5 (card|null). null if any empty.
  const evaluateLine = (line) => {
    if (line.some((c) => c === null || c === undefined)) return null;
    const jokers = line.filter(isJoker).length;
    if (jokers === 0) return evalStandardFive(line);
    return evalWithJokers(line.filter((c) => !isJoker(c)), jokers);
  };

  // Partial-line "hand so far": evaluate only the cards placed (1-4 of them),
  // returning the best COUNT-BASED made hand (pairs/trips/quads/five). Straights
  // and flushes need 5 cards so are not considered until the line is complete.
  // Returns a HAND key, 'HIGH_CARD', or null if empty.
  const evaluatePartialLine = (line) => {
    const cards = line.filter((c) => c !== null && c !== undefined);
    if (cards.length === 0) return null;
    if (cards.length === 5) return evaluateLine(line);
    const jokers = cards.filter(isJoker).length;
    const counts = new Map();
    for (const c of cards) { if (isJoker(c)) continue; const r = rankIndex(c.rank); counts.set(r, (counts.get(r) || 0) + 1); }
    let multiset = [...counts.values()].sort((a, b) => b - a);
    if (multiset.length === 0) multiset = [0];
    multiset[0] += jokers; // jokers always extend the largest group
    const top = multiset[0], second = multiset[1] || 0;
    if (top >= 5) return 'FIVE_OF_A_KIND';
    if (top === 4) return 'FOUR_OF_A_KIND';
    if (top === 3 && second >= 2) return 'FULL_HOUSE';
    if (top === 3) return 'THREE_OF_A_KIND';
    if (top === 2 && second === 2) return 'TWO_PAIR';
    if (top === 2) return 'PAIR';
    return 'HIGH_CARD';
  };

  // grid = array of 25 (card|null). Row-major: index = row*5 + col.
  const linesOf = (grid) => {
    const out = [];
    for (let r = 0; r < 5; r++) out.push({ kind: 'row', index: r, cards: [0, 1, 2, 3, 4].map((c) => grid[r * 5 + c]) });
    for (let c = 0; c < 5; c++) out.push({ kind: 'col', index: c, cards: [0, 1, 2, 3, 4].map((r) => grid[r * 5 + c]) });
    return out;
  };

  const scoreGrid = (grid, opts) => {
    opts = opts || {};
    const ignorePenalty = !!opts.ignoreIncompletePenalty;
    const scored = linesOf(grid).map((ctx) => {
      const filled = ctx.cards.filter((c) => c !== null && c !== undefined).length;
      const incomplete = filled < 5;
      const hand = evaluateLine(ctx.cards);
      if (!hand) {
        const total = incomplete && !ignorePenalty ? INCOMPLETE_LINE_PENALTY : 0;
        return { kind: ctx.kind, index: ctx.index, hand: null, base: 0, total, incomplete };
      }
      const base = HAND_BASE_VALUE[hand];
      return { kind: ctx.kind, index: ctx.index, hand, base, total: base, incomplete: false };
    });
    const subtotal = scored.reduce((s, l) => s + l.total, 0);
    return { lines: scored, subtotal, total: subtotal };
  };

  // Spiral placement order (src/game/grid.ts SPIRAL_ORDER): starts at the
  // center slot (12 = R3C3) and expands clockwise outward. Some challenge
  // modes (Scatter, Gridlock) override this; Free Play / Daily follow it.
  const spiralOrder = [
    12, 13, 18, 17, 16, 11, 6, 7, 8, 9,
    14, 19, 24, 23, 22, 21, 20, 15, 10, 5,
    0, 1, 2, 3, 4,
  ];

  const shuffle = (arr, rng) => {
    const a = [...arr]; rng = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const freshDeck = (jokerCount, rng) => {
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push({ kind: 'standard', rank: r, suit: s });
    for (let i = 0; i < (jokerCount || 0); i++) cards.push({ kind: 'joker', id: 'joker' + i });
    return shuffle(cards, rng);
  };

  // Mulberry32 seeded rng for reproducible demo deals.
  const seededRng = (seed) => {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  const ratingFor = (score, target) => {
    const p = score / target;
    if (p >= 1.5) return { key: 'SS', label: 'Perfect' };
    if (p >= 1.25) return { key: 'S', label: 'Superb' };
    if (p >= 1.1) return { key: 'A', label: 'Great' };
    if (p >= 1.0) return { key: 'B', label: 'Cleared' };
    if (p >= 0.85) return { key: 'C', label: 'Close' };
    return { key: 'D', label: 'Missed' };
  };

  window.PG_ENGINE = {
    RANKS, SUITS, SUIT_GLYPH, SUIT_VAR, rankIndex, isJoker,
    HAND_BASE_VALUE, HAND_NAME, HAND_TIER, INCOMPLETE_LINE_PENALTY,
    evaluateLine, evaluatePartialLine, linesOf, scoreGrid, spiralOrder, freshDeck, seededRng, shuffle, ratingFor,
  };
})();
