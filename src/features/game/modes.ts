import { BonusCard, SPECIAL_DECK_POOL } from '../../game/bonusCards';
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
        maxUndos: UNDOS_BY_DIFFICULTY[difficulty],
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
              mode.id === 'bull-market',
            initialBonusCards:
              mode.id === 'three-tricks'
                ? shuffle(SPECIAL_DECK_POOL, rng).slice(0, 3)
                : [],
            slotCategories:
              mode.id === 'mixed-bag'
                ? ['special', 'in-game', 'end-game']
                : undefined,
            randomGridFill: mode.id === 'gridlock' ? 15 : 0,
            scatter: mode.id === 'scatter',
            investHands: mode.id === 'bull-market',
            doubleDuty: mode.id === 'double-duty',
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
      // like every other mode; using one doesn't taint the score.
      const twist = mode.recipe.twist ?? null;
      const difficulty = mode.recipe.difficulty;
      const target = dailyTargetFor(difficulty, mode.recipe.twist);
      return {
        difficulty,
        target,
        maxUndos: UNDOS_BY_DIFFICULTY[difficulty],
        challenge: twist ? findChallenge(twist) : null,
        start: rng =>
          newGame(difficulty, rng, {
            targetOverride: target,
            deckLimit: twist === 'short-deck' ? 45 : undefined,
            noDiscards: twist === 'no-discards',
            randomPerks: twist === 'short-circuit',
            noBonusCards:
              twist === 'poker-purist' ||
              twist === 'three-tricks' ||
              twist === 'bull-market',
            // The Three Tricks trio is seeded off the date (its own
            // salt) so it's globally identical without sharing the
            // deck's rng stream.
            initialBonusCards:
              twist === 'three-tricks'
                ? shuffle(
                    SPECIAL_DECK_POOL,
                    seededRng(seedForInitialSpecials(mode.dateISO))
                  ).slice(0, 3)
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
          }),
      };
    }
  }
};
