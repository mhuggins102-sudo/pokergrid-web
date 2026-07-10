/* PokerGrid — real game data, lifted verbatim from mhuggins102-sudo/pokergrid-web.
   Loaded as a classic script; assigns window.PG_DATA. */
(function () {
  // ---- Difficulty axes (src/game/rules.ts) ----
  const DIFFICULTIES = [
    {
      id: 'easy', name: 'Easy', target: 400, jokers: 2, undos: 1, starterBonus: 1,
      declineAtCap: true, noDiscards: false, canPreviewDeck: true,
      blurb: 'Two jokers in the deck, a starter bonus card, deck peek, and one undo. The gentlest way in.',
    },
    {
      id: 'medium', name: 'Medium', target: 450, jokers: 1, undos: 1, starterBonus: 1,
      declineAtCap: false, noDiscards: false, canPreviewDeck: true,
      blurb: 'One joker, a starter bonus, deck peek, one undo — but a ♣ at the cap forces a swap.',
    },
    {
      id: 'hard', name: 'Hard', target: 500, jokers: 1, undos: 0, starterBonus: 0,
      declineAtCap: false, noDiscards: false, canPreviewDeck: false,
      blurb: 'One joker, no starter card, no deck peek, no undo. You build your whole hand from ♣ draws.',
    },
    {
      id: 'extreme', name: 'Extreme', target: 450, jokers: 0, undos: 0, starterBonus: 0,
      declineAtCap: false, noDiscards: true, canPreviewDeck: false,
      blurb: 'A pure 52-card deck — no jokers, no discards, no peek, no undo. Same 450 as Medium, none of the help.',
    },
  ];

  // ---- Hand base values (src/game/scoring.ts, HAND_BASE_VALUE) ----
  const HANDS = [
    { key: 'HIGH_CARD', name: 'High Card', base: 0 },
    { key: 'PAIR', name: 'Pair', base: 5 },
    { key: 'TWO_PAIR', name: 'Two Pair', base: 12 },
    { key: 'THREE_OF_A_KIND', name: 'Three of a Kind', base: 20 },
    { key: 'STRAIGHT', name: 'Straight', base: 30 },
    { key: 'FLUSH', name: 'Flush', base: 40 },
    { key: 'FULL_HOUSE', name: 'Full House', base: 50 },
    { key: 'FOUR_OF_A_KIND', name: 'Four of a Kind', base: 70 },
    { key: 'STRAIGHT_FLUSH', name: 'Straight Flush', base: 90 },
    { key: 'ROYAL_FLUSH', name: 'Royal Flush', base: 120 },
    { key: 'FIVE_OF_A_KIND', name: 'Five of a Kind', base: 150 },
  ];
  const INCOMPLETE_LINE_PENALTY = -25;

  // ---- Bonus cards (src/game/bonusCards.ts). category: in-game | end-game | special ----
  // in-game = yellow (per-line lineEffect); end-game = purple (gridEffect); special = green (one-time action)
  const BONUS_CARDS = [
    // Hand-type boosts (in-game)
    { title: 'Pair', mult: '×4 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Pair.' },
    { title: 'Two Pair', mult: '×3 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Two Pair.' },
    { title: 'Three of a Kind', mult: '×3 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Three of a Kind.' },
    { title: 'Straight', mult: '×2 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Straight.' },
    { title: 'Flush', mult: '×1.5 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Flush.' },
    { title: 'Full House', mult: '×1.5 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Full House.' },
    { title: 'Four of a Kind', mult: '×1.5 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Four of a Kind.' },
    { title: 'Straight Flush', mult: '×1.5 (each)', category: 'in-game', group: 'Hand type', description: 'Lines scoring Straight Flush.' },
    // Row / column / location (in-game)
    { title: 'Row 1', mult: '×2', category: 'in-game', group: 'Location', description: "Row 1's score." },
    { title: 'Row 2', mult: '×2', category: 'in-game', group: 'Location', description: "Row 2's score." },
    { title: 'Row 3', mult: '×2', category: 'in-game', group: 'Location', description: "Row 3's score." },
    { title: 'Row 4', mult: '×2', category: 'in-game', group: 'Location', description: "Row 4's score." },
    { title: 'Row 5', mult: '×2', category: 'in-game', group: 'Location', description: "Row 5's score." },
    { title: 'Col 1', mult: '×2', category: 'in-game', group: 'Location', description: "Column 1's score." },
    { title: 'Col 2', mult: '×2', category: 'in-game', group: 'Location', description: "Column 2's score." },
    { title: 'Col 3', mult: '×2', category: 'in-game', group: 'Location', description: "Column 3's score." },
    { title: 'Col 4', mult: '×2', category: 'in-game', group: 'Location', description: "Column 4's score." },
    { title: 'Col 5', mult: '×2', category: 'in-game', group: 'Location', description: "Column 5's score." },
    { title: 'Crossroads', mult: '×1.5 (each)', category: 'in-game', group: 'Location', description: 'The center row and center column (R3, C3).' },
    { title: 'Outer Edge', mult: '×1.25 (each)', category: 'in-game', group: 'Location', description: 'The 4 outer rows and columns (R1, R5, C1, C5).' },
    // Suit density (in-game)
    { title: '♥ Density', mult: '×1.1 (each)', category: 'in-game', group: 'Suit density', description: 'Each ♥ in the line.' },
    { title: '♠ Density', mult: '×1.1 (each)', category: 'in-game', group: 'Suit density', description: 'Each ♠ in the line.' },
    { title: '♦ Density', mult: '×1.1 (each)', category: 'in-game', group: 'Suit density', description: 'Each ♦ in the line.' },
    { title: '♣ Density', mult: '×1.1 (each)', category: 'in-game', group: 'Suit density', description: 'Each ♣ in the line.' },
    // Per-line conditional (in-game)
    { title: 'Rainbow', mult: '×1.25 (each)', category: 'in-game', group: 'Line condition', description: 'Lines with 4+ distinct suits.' },
    { title: 'Joker Line', mult: '×1.25 (each)', category: 'in-game', group: 'Line condition', description: "The joker's row and column." },
    { title: 'Royal Touch', mult: '×1.5 (each)', category: 'in-game', group: 'Line condition', description: 'Lines containing an Ace.' },
    { title: 'Highball', mult: '×1.5 (each)', category: 'in-game', group: 'Line condition', description: 'Lines totalling 45+ (A=11, face=10).' },
    { title: 'Lowball', mult: '×1.5 (each)', category: 'in-game', group: 'Line condition', description: 'Lines totalling 20 or less (A=1, face=10).' },
    { title: 'Blackjack', mult: '×3 (each)', category: 'in-game', group: 'Line condition', description: 'Lines totalling exactly 21 (each A is 1 or 11).' },
    { title: 'Lowhand', mult: '×3 (each)', category: 'in-game', group: 'Line condition', description: 'Lines tying the lowest hand rank on the board (Pair+).' },
    { title: 'High Kicker', mult: '×1.5 (each)', category: 'in-game', group: 'Line condition', description: 'Pair / 2 Pair / 3 or 4 of a Kind with a J / Q / K / A kicker.' },
    // Grid-wide (end-game)
    { title: 'Clean Border', mult: '×1.1 (each)', category: 'end-game', group: 'Grid pattern', description: 'Each fully-filled grid edge with no face cards. Stacks up to ×1.1⁴.' },
    { title: 'Monochrome Border', mult: '×1.15 (each)', category: 'end-game', group: 'Grid pattern', description: 'Each fully-filled grid edge of one color (red or black). Stacks up to ×1.15⁴.' },
    { title: 'Rainbow Corners', mult: '×1.25', category: 'end-game', group: 'Grid pattern', description: 'The 4 corners are 4 distinct suits.' },
    { title: 'Cozy Joker', mult: '×1.15 (each)', category: 'end-game', group: 'Grid pattern', description: 'Each joker placed in the inner 3×3.' },
    { title: 'Speedrun', mult: '×1.04 (each)', category: 'end-game', group: 'Deck management', description: 'Each playing card still in the deck at game end.' },
    { title: 'No Flushes', mult: '×1.25', category: 'end-game', group: 'Grid pattern', description: 'No line scores a flush of any kind.' },
    { title: 'No Straights', mult: '×1.25', category: 'end-game', group: 'Grid pattern', description: 'No line scores a straight of any kind.' },
    { title: 'Balance', mult: '×1.25', category: 'end-game', group: 'Grid pattern', description: 'Every line scores Pair or better.' },
    { title: 'Diversity', mult: '×1.25', category: 'end-game', group: 'Grid pattern', description: 'Board contains 6+ distinct scoring hand types.' },
    { title: 'Trash Joker', mult: '×1.5 (each)', category: 'end-game', group: 'Deck management', description: 'Each joker destroyed during the run.' },
    { title: 'Diagonal', mult: '×1.25 (each)', category: 'end-game', group: 'Grid pattern', description: 'Each grid diagonal that forms a Straight or higher.' },
    { title: 'Symmetric Frame', mult: '×1.25 (each)', category: 'end-game', group: 'Grid pattern', description: 'R1/R5 or C1/C5 sharing a scoring hand type (Pair or better).' },
    { title: 'Burnout', mult: '×1.5', category: 'end-game', group: 'Perk volume', description: '22+ suit perks spent across the run.' },
    { title: 'Frugal', mult: '×1.5', category: 'end-game', group: 'Perk volume', description: '14 or fewer suit perks spent across the run.' },
    { title: 'Spotlight', mult: '×1.5', category: 'end-game', group: 'Special rule', description: '×1.5 at game end. Must be your only bonus card — discards the others when picked up.' },
    { title: 'Patience', mult: '(no penalty)', category: 'end-game', group: 'Special rule', description: 'Removes the −25 penalty for incomplete rows or columns at game end.' },
    // One-time action cards (special / green) — Three Tricks & Mixed Bag
    { title: 'Power Swap', mult: 'one-time', category: 'special', group: 'Action', description: 'Pick any two cards on the grid and swap them. No row / column restriction. Consumed on use.' },
    { title: 'The Doubler', mult: 'one-time', category: 'special', group: 'Action', description: 'Turn a grid card into a "double" — counts as two of its rank for pair-class hands and +1 to suit density. Consumed on use.' },
    { title: 'Wildcard', mult: 'one-time', category: 'special', group: 'Action', description: "Turn a grid card wild — its suit becomes flexible for flush / straight-flush. Rank unchanged. Consumed on use." },
    { title: 'Mega Destroy', mult: 'one-time', category: 'special', group: 'Action', description: 'Destroy up to 5 cards on the grid in one shot. Tap each, then confirm. Consumed on use.' },
    { title: 'Slip & Slide', mult: 'one-time', category: 'special', group: 'Action', description: 'Move a row/column of 2+ adjacent cards as a unit along a path of single-cell hops that can change direction. Consumed on use.' },
    { title: 'Jump, Jump', mult: 'one-time', category: 'special', group: 'Action', description: 'Pick a card, then tap any empty slot to move it there. Consumed on use.' },
    { title: 'Shuffle', mult: 'one-time', category: 'special', group: 'Action', description: 'Pick 3–5 cards; they are pulled, shuffled, and dropped back into the same slots. Consumed on use.' },
    { title: 'Plus/Minus', mult: 'one-time', category: 'special', group: 'Action', description: "Bump a grid card's rank up or down by 1. Aces wrap. Joker can't be picked. Consumed on use." },
    { title: 'Revive', mult: 'one-time', category: 'special', group: 'Action', description: 'Pick any card from the discard pile and place it on the grid (next spiral slot). Consumed on use.' },
    { title: 'Rewind', mult: 'one-time', category: 'special', group: 'Action', description: 'Pick 3–5 grid cards; they are removed and shuffled back into the deck for later. Consumed on use.' },
  ];

  const CATEGORY_META = {
    'in-game': { label: 'In-game multiplier', tone: 'var(--warn)', note: 'Yellow · boosts a line while you play' },
    'end-game': { label: 'End-game multiplier', tone: 'var(--joker)', note: 'Purple · scores the whole grid at the finish' },
    'special': { label: 'One-time action', tone: 'var(--accent)', note: 'Green · a single-use move, then spent' },
  };

  // ---- Challenges (src/game/challenges.ts) ----
  const CHALLENGES = [
    { id: 'short-deck', name: 'Short Deck', synopsis: 'Deck contains only 45 cards', target: 500, goal: 'Score 500+ points with a 45-card deck. 8 cards are removed at random before the start of the game.' },
    { id: 'poker-purist', name: 'Poker Purist', synopsis: 'No bonus cards', target: 350, goal: 'Score 350+ points with no bonus cards at all — no starter, no ♣ draws, no multipliers. Pure rows and columns scoring as 5-card poker hands.' },
    { id: 'no-discards', name: 'No Discards', synopsis: 'Discard button disabled', target: 500, goal: 'Score 500+ points without using the Discard button — every drawn card must be placed or spent on a suit perk.' },
    { id: 'short-circuit', name: 'Short Circuit', synopsis: 'Suit perks fire at random', target: 500, goal: "Score 500+ points with random suit perks — you won't know which of ♥/♠/♦/♣'s effects you'll get until you commit to spending the card." },
    { id: 'gridlock', name: 'Gridlock', synopsis: 'First 15 cards pre-placed at random', target: 500, goal: 'Score 500+ points with 15 cards pre-placed at random positions. Spiral placement resumes from whichever slots are still empty — you fill the remaining 10 in normal play.' },
    { id: 'scatter', name: 'Scatter', synopsis: 'Each card lands at a random spot', target: 500, goal: 'Score 500+ points with no spiral. Every card drawn targets a random empty slot, re-rolled for each new card — even after a suit perk. Jokers scatter too.' },
    { id: 'mixed-bag', name: 'Mixed Bag', synopsis: 'Bonus slots locked to green/yellow/purple', target: 500, goal: 'Score 500+ with bonus slots locked to categories. Slot 1 holds a green one-time action, slot 2 a yellow (per-line) card, slot 3 a purple (end-game) card. ♣ asks which slot to draw for, then shows 2 matching cards to pick from.' },
    { id: 'three-tricks', name: 'Three Tricks', synopsis: 'One-time actions (green) replace bonus cards', target: 500, goal: "Score 500+ with no bonus-card deck. Instead you start holding three green one-time action cards, dealt at random from the special deck — tap one to read it, tap Use to fire it; each is consumed on use." },
    { id: 'bull-market', name: 'Bull Market', synopsis: '♣ invests in hand values', target: 500, goal: 'Score 500+ with no bonus cards. Spending a ♣ "invests" twice its blackjack value into a random hand type, permanently raising that hand\'s base value. Boosts stack — press ⓘ to see the revised hand values.' },
    { id: 'double-duty', name: 'Double Duty', synopsis: 'Two-way cards — Flip burns 2 cards', target: 500, goal: 'Score 500+ with a two-way deck. Every card carries a second identity printed upside-down — Flip the drawn card to play its other half; the cost: the next two deck cards are burned, sight unseen. Jokers can\'t flip.' },
  ];

  // ---- Achievements (src/game/achievements.ts) ----
  const ACHIEVEMENTS = [
    { id: 'easy-overshot', tier: 'easy', name: 'Overshot', description: 'Score 750+ points on Easy.' },
    { id: 'easy-grand', tier: 'easy', name: 'Grand', description: 'Score 1000+ points on Easy.' },
    { id: 'easy-soloist', tier: 'easy', name: 'Soloist', description: 'Score 500+ on Easy with no joker on the grid at game end.' },
    { id: 'dynamite', tier: 'hard-extreme', name: 'Dynamite', description: 'Score 500+ with at least one row or column worth 300+.' },
    { id: 'line-only', tier: 'hard-extreme', name: 'Line Only', description: 'Score 500+ holding no end-of-game multiplier bonus cards.' },
    { id: 'grid-only', tier: 'hard-extreme', name: 'Grid Only', description: 'Score 500+ holding only end-of-game multiplier bonus cards.' },
    { id: 'balanced', tier: 'hard-extreme', name: 'Balanced', description: 'Score 500+ without any single row or column worth 100+.' },
    { id: 'jokerless', tier: 'hard-extreme', name: 'Jokerless', description: 'Score 500+ with no joker on the grid at game end.' },
    { id: 'no-swap', tier: 'hard-extreme', name: 'No Swap', description: 'Score 500+ without swapping out a bonus card at the cap.' },
    { id: 'high-hands', tier: 'hard-extreme', name: 'High Hands', description: 'Score 500+ with every scoring line a Three of a Kind or higher.' },
    { id: 'low-hands', tier: 'hard-extreme', name: 'Low Hands', description: 'Score 500+ with no line scoring higher than Three of a Kind.' },
    { id: 'gaps-and-glory', tier: 'hard-extreme', name: 'Gaps & Glory', description: 'Score 500+ with 3 or more incomplete lines on the board.' },
    { id: 'full-spectrum', tier: 'hard-extreme', name: 'Full Spectrum', description: 'Score 500+ with 8 or more distinct scoring hand types.' },
    { id: 'daily-first', tier: 'daily', name: 'Daily Debut', description: 'Win your first daily puzzle.' },
    { id: 'daily-20', tier: 'daily', name: 'Daily Devotee', description: 'Win 20 daily puzzles.' },
    { id: 'daily-streak-3', tier: 'daily', name: 'On a Roll', description: 'Win 3+ daily puzzles in a row.' },
    { id: 'daily-streak-10', tier: 'daily', name: 'Perfect Fortnight', description: 'Win 10+ daily puzzles in a row.' },
    { id: 'win-every-difficulty', tier: 'milestone', name: 'Globetrotter', description: 'Win a game at each difficulty.' },
    { id: 'perfect-every-difficulty', tier: 'milestone', name: 'Perfectionist', description: 'Win with Perfect (SS rating) at each difficulty.' },
    { id: 'wins-25', tier: 'milestone', name: 'Quarter Century', description: 'Win 25+ games, free play and daily combined.' },
    { id: 'wins-100', tier: 'milestone', name: 'Centurion', description: 'Win 100+ games, free play and daily combined.' },
    { id: 'all-challenges', tier: 'milestone', name: 'Challenge Sweep', description: 'Beat every Challenge.' },
    { id: 'full-bonus-hand', tier: 'milestone', name: 'Full Slate', description: 'Score points with every bonus card at least once.' },
  ];

  const TIER_META = {
    easy: { label: 'Easy', note: 'Earned on Free Play · Easy' },
    'hard-extreme': { label: 'Hard / Extreme', note: 'Earned on Free Play · Hard or Extreme' },
    daily: { label: 'Daily Puzzles', note: 'Cumulative across daily plays' },
    milestone: { label: 'Milestones', note: 'Long-term goals across all modes' },
  };

  // ---- Tier ratings (result grading) ----
  const RATINGS = [
    { key: 'SS', label: 'Perfect', pct: 1.5 },
    { key: 'S', label: 'Superb', pct: 1.25 },
    { key: 'A', label: 'Great', pct: 1.1 },
    { key: 'B', label: 'Cleared', pct: 1.0 },
    { key: 'C', label: 'Close', pct: 0.85 },
    { key: 'D', label: 'Missed', pct: 0.0 },
  ];

  window.PG_DATA = {
    DIFFICULTIES, HANDS, INCOMPLETE_LINE_PENALTY,
    BONUS_CARDS, CATEGORY_META, CHALLENGES, ACHIEVEMENTS, TIER_META, RATINGS,
  };
})();
