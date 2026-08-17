import {
  ALL_ROWS_CARD,
  BONUS_DECK_POOL,
  BonusCard,
  SPECIAL_DECK_POOL,
  SPOTLIGHT_ID,
} from '../../game/bonusCards';
import { Card } from '../../game/cards';
import { seededRng, shuffle } from '../../game/deck';
import {
  Challenge,
  ChallengeId,
  difficultyForLevel,
  findChallenge,
  targetForLevel,
} from '../../game/challenges';
import { DailyRecipe, dailyTargetFor } from '../../game/daily/recipe';
import { seedForInitialSpecials } from '../../game/daily/seed';
import { Difficulty, UNDOS_BY_DIFFICULTY } from '../../game/rules';
import { GameState, newGame } from '../../game/state';
import { TUTORIAL_TARGET, tutorialStart } from '../tutorial/tutorialGame';

export type GameMode =
  | { kind: 'free'; difficulty: Difficulty }
  | { kind: 'tutorial' }
  | { kind: 'challenge'; id: ChallengeId }
  | {
      kind: 'targets';
      level: number;
      deckExtras: BonusCard[];
      superchargedDeckCards: Card[];
    }
  | { kind: 'daily'; dateISO: string; recipe: DailyRecipe };

export interface ModeSetup {
  difficulty: Difficulty;
  target: number;
  maxUndos: number;
  challenge: Challenge | null;
  start: (rng: () => number) => GameState;
}

// Five Draw's 3-card starter pool: the regular bonus pool minus cards
// that are broken in this mode — Spotlight (exclusive-in-hand;
// enforceSpotlight is skipped on the initialBonusCards path) and the
// perk/penalty tells: Frugal (perks unreachable → an always-on ×1.5),
// Burnout (unreachable), Patience (the grid always ends full). The
// joker cards STAY — jokers deal into hands here, so Joker Line / Cozy
// Joker pay off chosen placements and Trash Joker can score a joker
// tossed in the redraw.
const DRAW_POKER_EXCLUDED: ReadonlySet<string> = new Set([
  SPOTLIGHT_ID,
  'burnout-x1_25',
  'frugal-x1_5',
  'patience-no-penalty',
]);
const DRAW_POKER_BONUS_POOL: BonusCard[] = BONUS_DECK_POOL.filter(
  c => !DRAW_POKER_EXCLUDED.has(c.id)
);

/**
 * Translate a play mode into the newGame() configuration. Mirrors the
 * original App.tsx context helpers: challenges run on the Hard ruleset
 * with their own score target; Targets-Up derives difficulty and target
 * from the level and feeds the saved carry-over cards back into the
 * deal. Undos come from UNDOS_BY_DIFFICULTY in every mode (tutorial
 * excepted).
 */
export const setupForMode = (mode: GameMode): ModeSetup => {
  switch (mode.kind) {
    case 'free': {
      const difficulty = mode.difficulty;
      return {
        difficulty,
        target: 0, // resolved by newGame from the difficulty table
        maxUndos: UNDOS_BY_DIFFICULTY[difficulty],
        challenge: null,
        start: rng => newGame(difficulty, rng),
      };
    }
    case 'tutorial':
      // Guided first game: a handcrafted Easy deal with a soft target.
      // No undos — the coach script tracks the reducer state move for
      // move, and a rewind would desync them.
      return {
        difficulty: 'easy',
        target: TUTORIAL_TARGET,
        maxUndos: 0,
        challenge: null,
        start: () => tutorialStart(),
      };
    case 'challenge': {
      const challenge = findChallenge(mode.id);
      const difficulty: Difficulty = 'hard';
      return {
        difficulty,
        target: challenge.scoreTarget,
        // Five Draw plays with no undos at all (the tutorial precedent):
        // hold/redraw/arrange IS the decision space, and rewinding a
        // committed row would unravel the whole hand.
        maxUndos: mode.id === 'draw-poker' ? 0 : UNDOS_BY_DIFFICULTY[difficulty],
        challenge,
        start: rng =>
          newGame(difficulty, rng, {
            targetOverride: challenge.scoreTarget,
            deckLimit: challenge.deckLimit,
            noDiscards: mode.id === 'no-discards',
            randomPerks: mode.id === 'short-circuit',
            noBonusCards:
              mode.id === 'poker-purist' ||
              mode.id === 'three-tricks' ||
              mode.id === 'bull-market' ||
              mode.id === 'nut-low' ||
              mode.id === 'draw-poker',
            lowball: mode.id === 'nut-low',
            // Nut Low's Hard ruleset is jokerless: the joker goes first,
            // then the catalog's deckLimit (44) trims 8 random standards.
            noJokers: mode.id === 'nut-low',
            // Five Draw: the whole run flows through the draw phases;
            // the exclusive All Rows ×5 always leads the starter trio,
            // the other two come from the filtered regular pool.
            drawPoker: mode.id === 'draw-poker',
            initialBonusCards:
              mode.id === 'three-tricks'
                ? shuffle(SPECIAL_DECK_POOL, rng).slice(0, 3)
                : mode.id === 'draw-poker'
                  ? [
                      ALL_ROWS_CARD,
                      ...shuffle(DRAW_POKER_BONUS_POOL, rng).slice(0, 2),
                    ]
                  : [],
            slotCategories:
              mode.id === 'mixed-bag'
                ? ['special', 'in-game', 'end-game']
                : undefined,
            randomGridFill: mode.id === 'gridlock' ? 15 : 0,
            scatter: mode.id === 'scatter',
            investHands: mode.id === 'bull-market',
            doubleDuty: mode.id === 'double-duty',
            spiraling: mode.id === 'spiraling',
            timeTrial: mode.id === 'time-trial',
          }),
      };
    }
    case 'targets': {
      const difficulty = difficultyForLevel(mode.level);
      const target = targetForLevel(mode.level);
      return {
        difficulty,
        target,
        maxUndos: UNDOS_BY_DIFFICULTY[difficulty],
        challenge: null,
        start: rng =>
          newGame(difficulty, rng, {
            targetOverride: target,
            // keptBonusCards stays empty — no hand carry-over in the
            // current spec; carried cards ride the deck instead.
            deckExtras: mode.deckExtras,
            superchargedDeckCards: mode.superchargedDeckCards,
          }),
      };
    }
    case 'daily': {
      // A twisted daily is structurally identical to the same-named
      // challenge — same flag plumbing — but seeded so every player
      // worldwide gets the same deal. Undos follow the difficulty table
      // like every other mode (Five Draw excepted — no undos there,
      // matching its challenge); using one doesn't taint the score.
      const twist = mode.recipe.twist ?? null;
      const difficulty = mode.recipe.difficulty;
      const target = dailyTargetFor(difficulty, mode.recipe.twist);
      return {
        difficulty,
        target,
        maxUndos:
          twist === 'draw-poker' ? 0 : UNDOS_BY_DIFFICULTY[difficulty],
        challenge: twist ? findChallenge(twist) : null,
        start: rng =>
          newGame(difficulty, rng, {
            targetOverride: target,
            // Deck-trimming twists carry their size on the catalog entry
            // (Short Deck 45, Nut Low 40); everything else stays full.
            deckLimit: twist ? findChallenge(twist).deckLimit : undefined,
            noDiscards: twist === 'no-discards',
            randomPerks: twist === 'short-circuit',
            noBonusCards:
              twist === 'poker-purist' ||
              twist === 'three-tricks' ||
              twist === 'bull-market' ||
              twist === 'nut-low' ||
              twist === 'draw-poker',
            lowball: twist === 'nut-low',
            // Nut Low dailies: Hard plays jokerless like the challenge;
            // Easy/Medium keep their jokers in the random trim pool, so
            // the 44-card deck may hold 0..2 of them.
            noJokers: twist === 'nut-low' && difficulty === 'hard',
            // Five Draw dailies (out of rotation today, wired anyway):
            // jokers deal into hands at the difficulty's usual count.
            drawPoker: twist === 'draw-poker',
            // The Three Tricks trio (and Five Draw's starter trio) is
            // seeded off the date (its own salt) so it's globally
            // identical without sharing the deck's rng stream.
            initialBonusCards:
              twist === 'three-tricks'
                ? shuffle(
                    SPECIAL_DECK_POOL,
                    seededRng(seedForInitialSpecials(mode.dateISO))
                  ).slice(0, 3)
                : twist === 'draw-poker'
                  ? [
                      ALL_ROWS_CARD,
                      ...shuffle(
                        DRAW_POKER_BONUS_POOL,
                        seededRng(seedForInitialSpecials(mode.dateISO))
                      ).slice(0, 2),
                    ]
                  : [],
            slotCategories:
              twist === 'mixed-bag'
                ? ['special', 'in-game', 'end-game']
                : undefined,
            randomGridFill: twist === 'gridlock' ? 15 : 0,
            scatter: twist === 'scatter',
            investHands: twist === 'bull-market',
            // Dual pairing draws from the same seeded rng inside newGame,
            // so a Double Duty daily is globally identical for free.
            doubleDuty: twist === 'double-duty',
            timeTrial: twist === 'time-trial',
          }),
      };
    }
  }
};
