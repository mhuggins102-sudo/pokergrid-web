# Free-play bot: what a move has to weigh

This is the working reference behind `src/game/bot.ts`. Part 1 is the
rulebook as the engine actually enforces it; Part 2 is the exhaustive
list of factors a decision in free play should consider; Part 3 is how
the shipped bot covers each one (and what it deliberately leaves out).

Everything here was verified against the engine
(`src/game/{state,grid,hands,scoring,bonusCards,actions,rules}.ts`), not
the rules screen.

## Part 1 — the four free-play modes

Free play is `newGame(difficulty, seededRng(seed))` with no options. The
four modes differ only along these axes (`src/game/rules.ts`):

| | Easy | Medium | Hard | Extreme |
|---|---|---|---|---|
| Target | 400 | 450 | 500 | 450 |
| Jokers in deck | 2 | 1 | 1 | 0 |
| Deck size | 54 | 53 | 53 | 52 |
| Spare cards beyond the 24 open slots | 29 | 28 | 28 | 27 |
| Starter bonus card | 1 | 1 | 0 | 0 |
| Bonus pool | 52 | 52 | 52 | 49 (joker cards stripped) |
| ♣ at the 3-card cap | swap or decline | forced swap | ♣ dead | ♣ dead |
| Decline a ♣ offer below the cap | no | yes | yes | yes |
| Discard | yes | yes | yes | **no** |
| Deck peek (multiset) | yes | yes | no | no |
| Undo | 2 | 1 | 1 | 0 |

Mechanics that never vary:

- **Forced placement.** The first deck card is auto-seated at the centre.
  Every placed card goes to the first empty slot in `SPIRAL_ORDER`
  (centre, inner ring clockwise, outer ring clockwise, top row last).
  The player never picks a slot; the only levers are *whether* to place
  the drawn card, and the four suit perks.
- **Jokers auto-place** the moment they are drawn — no decision, no
  perk, no discard. The player can only move or destroy one afterwards.
- **One card per decision.** Place, discard, or a perk each consume the
  drawn card. Slack = deck − empty slots; a discard or perk spends one,
  a ♦ destroy spends two (the card and the re-opened slot). The game
  ends when the grid is full **or the deck is empty**; every unfilled
  line then costs −25, inside the grid multiplier, floored at 0.
- **Perks.** ♥ hop swaps any two cards sharing a row or a column (any
  distance). ♠ slide pushes a card plus the contiguous cards ahead of
  it into empty cells (1..max); the vacated cells become holes. ♦
  destroy removes any card to the discard pile; the hole is the next
  spiral target, so a destroy is a targeted re-roll of that slot. ♣
  draws the top two bonus cards, keep one (the other goes to the bottom
  of the bonus deck); at the cap the kept card replaces a held one.
- **Scoring.** Ten lines (5 rows, 5 columns; no diagonals). Only the
  hand category matters: pair 5, two pair 12, trips 20, straight 30,
  flush 40, full house 50, quads 70, straight flush 90, royal 120, five
  of a kind 150 (joker + quads). Jokers are evaluated as the best
  possible substitution. Per line: `ceil(base × Π line multipliers)`;
  then `ceil(subtotal × Π grid multipliers)`.
- **Information.** The drawn card, the grid, the held bonus cards, the
  bonus-deck count, and the deck count are always visible. The deck's
  composition is deducible on every difficulty by counting (Easy and
  Medium also show it). The deck's *order* is never visible, except
  through undo (which rewinds a committed move after the next card has
  been seen).

## Part 2 — factors to weigh on every move

Grouped by what they concern. Each item says what it is and why it
moves points.

### A. The drawn card at the forced slot

1. **Row/column made-hand gain.** Does the card pair, trip, or boat an
   existing rank group in its row or its column? Pairs are the bread
   and butter; two pair (12) and trips (20) are worth 2.4× and 4× a
   pair; a full house (50) is the accessible big hand.
2. **Both lines at once.** A slot belongs to one row and one column.
   A card that fits both is worth double; a card that fits one and
   *poisons* the other (kills a flush/straight draw, fills the last
   slot of a promising line with junk) nets much less.
3. **Draw potential kept or broken.** Suited triples/quads are flush
   draws (40); consecutive ranks are straight draws (30). Filling a
   draw's last slot with an off-card converts it to a pair at best.
4. **Growth potential of a placement.** A lone card seeded into an
   empty line is not worthless: it is what later pairs form around.
   Its worth scales with the open slots left in its lines and how many
   copies of its rank remain in the deck.
5. **Line completion effects.** The 5th card in a line locks the hand.
   The last five placements each complete a column (and the final one
   completes a row and a column together); the outer ring completes
   rows 1–4 first. Know which lines are about to close.
6. **The joker in a line.** A joker guarantees at least a pair, turns
   four suited cards into a flush, four-to-a-straight into a straight,
   quads into five of a kind. Lines holding a joker deserve high-value
   partners; a joker should never be spent completing a mediocre line
   when a hop can move it.
7. **Held bonus multipliers on the affected lines.** With Pair ×4 a
   pair is worth 20, with Row 3 ×2 every hand on row 3 doubles. The
   marginal value of a fit is the bonus-weighted value, not the base.

### B. Slack and deck management

8. **Spare cards per open slot.** 27–29 spares mean roughly one
   rejection per placement over a whole game. Early, rejecting a card
   is cheap; late, every rejection risks the −25 per line penalty.
9. **Never strand the grid.** deck − empty slots must stay ≥ 0 after
   every non-placement; a destroy needs two spares. Jokers in the deck
   are free placements (they auto-place).
10. **Deck composition (the honest card count).** Which ranks and suits
    remain decides what a slot can still draw: a lone 7 with three 7s
    left is a live pair seed; with zero left it is dead weight forever.
    This is where the multiset knowledge earns its keep.
11. **Speedrun / Frugal / Burnout.** Speedrun pays ×1.04 per card left
    in the deck at the end (×3 for a no-discard game); Frugal ×1.5 at
    ≤14 perks; Burnout ×1.5 at ≥22 perks. Holding any of these changes
    the price of every discard or perk for the rest of the game.
12. **Patience.** Removes the incomplete-line penalty, which makes
    running the deck dry survivable — but only Patience does.
13. **Extreme has no discard.** The only way to reject a card is a
    perk, and every perk changes the board; on Extreme a "neutral" hop
    is the closest thing to a discard.

### C. The four perks

14. **♥ hop — moving rank matches.** Swapping two cards that share a
    row changes their columns (and vice versa). The strong hops bring
    matching ranks into the same line, move a joker to where it
    upgrades the most, or separate two cards that block each other's
    draws. Both cards' other lines change: price all four affected
    lines.
15. **♠ slide — chains and holes.** A slide moves a whole contiguous
    chain and leaves holes behind. It can (a) shift a made pair into a
    boosted row, (b) pull a card out of a line it hurts, (c) open a
    slot *behind the spiral frontier* that the next placement refills,
    or (d) push cards ahead of the frontier so the spiral skips them.
    Which slot becomes "next" after the slide is part of the move.
16. **♦ destroy — a targeted re-roll.** Remove the worst card of a
    nearly-complete line and the very next placement lands there. Costs
    two spares; the value depends on what the deck can still deliver to
    that slot (factor 10) and what the removed card was doing in *both*
    its lines. Destroying a joker feeds Trash Joker.
17. **♣ bonus draw — the offer's expected value.** Two hidden cards,
    keep the better. The pool is public and every seen card is known,
    so the offer's distribution is computable. Below the cap on Hard /
    Extreme a slot is permanent: a weak offer should be declined (legal
    below the cap on every difficulty but Easy). At the cap on Easy /
    Medium a ♣ is a swap: worth it only if a held card is dead weight.
18. **Perk versus place versus discard — same currency.** All three
    cost exactly one card. A perk has to beat both placing the card and
    plainly discarding it; a marginal perk that "does something" is
    worse than a discard when the something is negative elsewhere.
19. **Perk timing.** A hop or slide is worth more once the board has
    structure (mid-game), a destroy is worth more when the deck still
    holds good replacements (early/mid), a ♣ is worth more early (more
    placements to shape). The suit of the drawn card decides which perk
    is on offer *this* turn; none can be banked.

### D. Bonus cards (the multiplier hand)

20. **Which card to keep.** Value each offer jointly with the held hand
    and the current board — not in isolation. Cards interact: Pair ×4
    and Row 3 ×2 stack on a pair in row 3; No Flushes and Flush ×1.5
    fight; Spotlight evicts everything else (and is evicted by any
    later keep).
21. **Grid-shaping cards need a plan.** Rainbow Corners, Clean /
    Monochrome Border, Diagonal, Symmetric Frame, Stairway / Waterfall,
    Oddball / Even Steven, Highball / Lowball, Blackjack, suit density,
    Royal Touch, Lowhand, Balance, Diversity all pay only if placements
    and perks steer toward them from the moment they are held.
22. **Passive cards are late-game gold.** No Flushes / No Straights,
    Pair ×4 / Two Pair ×4, Frugal, Spotlight and Patience pay for what
    the board already is; they are the safest picks when few
    placements remain.
23. **Dead cards at the cap.** A held card that adds nothing to the
    projected score is a free swap on Easy / Medium; on Hard / Extreme
    it is a permanent lost slot, which is why weak offers get declined
    there.
24. **Cap rules by difficulty** (Part 1 table). On Medium a ♣ at the cap
    *forces* a swap; only take it when the worst held card is expendable.

### E. End-of-game

25. **Incomplete lines.** −25 each, multiplied by grid cards, floored at
    0. One empty slot costs 50 (its row and column).
26. **Remaining deck.** Zero at the end unless the grid filled first;
    only Speedrun rewards leftovers, so with no Speedrun every spare
    card should be spent on something useful before the last slot.
27. **Target and tier are thresholds**, but the head-to-head number is
    the score itself; the bot maximises expected score.

### F. Things a player could use that the bot deliberately does not

28. **Undo as a peek.** Undo restores the pre-move deck, so a committed
    move followed by undo reveals the next card at no cost (2 on Easy,
    1 on Medium/Hard). The bot never uses undo: it is documented as
    playing with the deck's order hidden, and the order-blindness test
    pins that.
29. **Reducer shortcuts the UI never exposes** (`forSuit` overrides,
    cancelling out of a bonus offer to void it). Never used.

## Part 3 — how the shipped bot covers this

The bot is a determinized Monte Carlo player: every alternative at a
decision is projected to the end of the run on the same set of shuffled
copies of the remaining deck (common random numbers), each projection
played by a *rollout player* and scored with the real `scoreGrid`
(penalties, every bonus card, discard / perk piles). The alternative
whose paired projection beats plain placement by a noise-aware margin
wins.

| Factor | Coverage |
|---|---|
| A1–A7 (fit) | The rollout player's `fitAt`: bonus-weighted made-hand gain in both lines, growth potential of rank groups, flush / straight draw slices, real evaluation once a line completes. Terminal scoring is exact. |
| B8–B9 (slack) | Rollouts discard only while spare cards remain; every non-placement is gated on `deck − empty ≥ 0` after the move (destroy needs 2). |
| B10 (card count) | Rollouts deal the actual remaining multiset, so pair seeds and dead ranks are priced by what the deck can still deliver. |
| B11–B12 | Priced exactly by `scoreGrid` on each projected end state; `perkSpent` / `discards` piles are carried per candidate. |
| B13 | On Extreme the rollout still passes on harmful cards (the real self can spend a perk); discards are never emitted. |
| C14–C16 | Every legal hop / slide / destroy is ranked by a deterministic board heuristic, and the leaders are projected on the full sample set. Slides' new spiral target falls out of the projection. |
| C17 | The ♣ offer is sampled from the sorted-then-shuffled unseen pool, crediting each pair's better card; weak offers are declined below the cap on Hard / Extreme; at the cap on Easy / Medium the draw is taken only when a held card is dead. |
| C18–C19 | Place, discard and the perk compete on the same projection; the bar is `max(2, 1.25 × paired standard error)`. |
| D20–D24 | Offers are valued jointly with the hand and board, with Spotlight's eviction rule applied to hypotheticals. |
| E25–E27 | Exact in the terminal score. |
| F28–F29 | Excluded by design. |

Known limits, in order of likely cost:

- The rollout player never uses perks, so the projected future is a
  place-or-discard player. The value of *keeping* cards for future
  perks is under-priced, and grid-shaping bonus cards are valued by
  what the board drifts into rather than what a planner would steer.
- Decisions are one ply: no destroy-then-slide combinations.
- The offer sample for ♣ is small (4 pairs), so its estimate is noisy.

## Measuring

`SIMULATE=1 npm test -- botSimulation` runs the opt-in distribution
harness (random deals). For tuning, compare paired on fixed seeds — the
same `(difficulty, seed)` for old and new — since game-to-game variance
is several hundred points.
