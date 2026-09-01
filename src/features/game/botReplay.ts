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

/** One run of caption text. Card tokens carry their suit (or joker
 *  flag) so the viewer can tint them to match the deck's colors. */
export interface CaptionPart {
  text: string;
  suit?: Suit;
  joker?: boolean;
}

export interface ReplayFrame {
  state: GameState;
  /** Plain-text caption (aria labels, tests). */
  caption: string;
  /** The caption split into runs for suit-tinted rendering. */
  parts: CaptionPart[];
  /** Grid slots that changed vs the previous frame (for highlights). */
  changed: number[];
}

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', C: '♣', D: '♦' };

const cardPart = (c: Card | null | undefined): CaptionPart =>
  !c
    ? { text: '?' }
    : c.kind === 'joker'
      ? { text: 'the joker', joker: true }
      : { text: `${c.rank}${SUIT_GLYPH[c.suit]}`, suit: c.suit };

// Caption for the action taken FROM `prev`. Null = a silent step (phase
// bookkeeping) whose effect the next visible frame narrates instead.
const captionFor = (prev: GameState, action: Action): CaptionPart[] | null => {
  switch (action.type) {
    case 'PLACE':
      return [{ text: 'Places ' }, cardPart(prev.drawn)];
    case 'DISCARD_NONE':
      return [{ text: 'Discards ' }, cardPart(prev.drawn)];
    case 'RESOLVE_HOP':
      return [
        { text: 'Swaps ' },
        cardPart(prev.grid[action.i]),
        { text: ' ↔ ' },
        cardPart(prev.grid[action.j]),
      ];
    case 'RESOLVE_SLIDE': {
      const dist = action.distance > 1 ? ` ${action.distance}` : '';
      return [
        { text: 'Slides ' },
        cardPart(prev.grid[action.from]),
        { text: ` ${action.direction}${dist}` },
      ];
    }
    case 'RESOLVE_DESTROY':
      return [{ text: 'Destroys ' }, cardPart(prev.grid[action.slot])];
    case 'BONUS_KEEP':
    case 'BONUS_SELECT_NEW':
      return [
        {
          text:
            prev.phase.kind === 'bonus-card-resolving'
              ? `Keeps ${prev.phase.drawn[action.idx].name}`
              : 'Keeps a bonus card',
        },
      ];
    case 'BONUS_REPLACE':
      return [
        {
          text:
            prev.phase.kind === 'bonus-card-replacing'
              ? `Swaps in ${prev.phase.drawn[prev.phase.pickedNew].name}`
              : 'Swaps a bonus card',
        },
      ];
    case 'BONUS_DECLINE':
      return [{ text: 'Declines the bonus draw' }];
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
    {
      state: s,
      caption: 'Opening deal',
      parts: [{ text: 'Opening deal' }],
      changed: [],
    },
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
    const parts = captionFor(prev, action) ?? [{ text: '…' }];
    frames.push({
      state: s,
      caption: parts.map(p => p.text).join(''),
      parts,
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
