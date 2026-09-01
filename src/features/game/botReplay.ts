/**
 * Bot replay frames — pure reconstruction of the bot's game for the
 * "watch its game" viewer. The bot's action trace replays through the
 * real reducer from the same (difficulty, seed) deal, and each frame
 * pairs a reducer state with a human caption of the move that produced
 * it ("Places 7♥", "Swaps K♠ ↔ 2♦", "Keeps High Kicker").
 *
 * Frames are VISIBLE steps only: actions that change nothing on screen
 * (entering a perk's targeting phase, picking a slide source) are
 * folded into the resolving action's frame, so playback never stalls
 * on an identical board.
 */
import { Card, Suit } from '../../game/cards';
import { seededRng } from '../../game/deck';
import { Difficulty } from '../../game/rules';
import { scoreGrid } from '../../game/scoring';
import { Action, GameState, newGame, step } from '../../game/state';

export interface ReplayFrame {
  state: GameState;
  caption: string;
  /** Grid slots that changed vs the previous frame (for highlights). */
  changed: number[];
}

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', C: '♣', D: '♦' };

const cardName = (c: Card | null | undefined): string =>
  !c ? '?' : c.kind === 'joker' ? 'the joker' : `${c.rank}${SUIT_GLYPH[c.suit]}`;

// Caption for the action taken FROM `prev`. Null = a silent step (phase
// bookkeeping) whose effect the next visible frame narrates instead.
const captionFor = (prev: GameState, action: Action): string | null => {
  switch (action.type) {
    case 'PLACE':
      return `Places ${cardName(prev.drawn)}`;
    case 'DISCARD_NONE':
      return `Discards ${cardName(prev.drawn)}`;
    case 'RESOLVE_HOP':
      return `Swaps ${cardName(prev.grid[action.i])} ↔ ${cardName(
        prev.grid[action.j]
      )}`;
    case 'RESOLVE_SLIDE': {
      const dist = action.distance > 1 ? ` ${action.distance}` : '';
      return `Slides ${cardName(prev.grid[action.from])} ${action.direction}${dist}`;
    }
    case 'RESOLVE_DESTROY':
      return `Destroys ${cardName(prev.grid[action.slot])}`;
    case 'BONUS_KEEP':
    case 'BONUS_SELECT_NEW':
      return prev.phase.kind === 'bonus-card-resolving'
        ? `Keeps ${prev.phase.drawn[action.idx].name}`
        : 'Keeps a bonus card';
    case 'BONUS_REPLACE':
      return prev.phase.kind === 'bonus-card-replacing'
        ? `Swaps in ${prev.phase.drawn[prev.phase.pickedNew].name}`
        : 'Swaps a bonus card';
    case 'BONUS_DECLINE':
      return 'Declines the bonus draw';
    default:
      return null;
  }
};

/**
 * Rebuild the bot's run as visible frames. `actions` is the trace the
 * bot worker returned for this exact (difficulty, seed) deal — the
 * reducer is pure, so the replay lands on the identical final board.
 */
export const buildReplayFrames = (
  difficulty: Difficulty,
  seed: number,
  actions: ReadonlyArray<Action>
): ReplayFrame[] => {
  let s = newGame(difficulty, seededRng(seed));
  const frames: ReplayFrame[] = [
    { state: s, caption: 'Opening deal', changed: [] },
  ];
  for (const action of actions) {
    const prev = s;
    s = step(s, action);
    const changed: number[] = [];
    for (let i = 0; i < 25; i++) {
      if (prev.grid[i] !== s.grid[i]) changed.push(i);
    }
    const visible =
      changed.length > 0 ||
      prev.drawn !== s.drawn ||
      prev.bonusCards !== s.bonusCards ||
      s.phase.kind === 'game-over';
    if (!visible) continue;
    frames.push({
      state: s,
      caption: captionFor(prev, action) ?? '…',
      changed,
    });
  }
  return frames;
};

/** The score readout for a frame — live semantics mid-run (incomplete
 *  lines don't punish yet), full final rules on the last frame. */
export const frameScore = (s: GameState): number =>
  scoreGrid(s.grid, s.bonusCards, {
    deckRemaining: s.deck.length,
    ignoreIncompletePenalty: s.phase.kind !== 'game-over',
    discards: s.discards,
    perkSpent: s.perkSpent,
    handBoost: s.handBoost,
    lowball: s.lowball,
  }).total;
