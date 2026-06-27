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
 * with their own score target and no undos; Targets-Up derives
 * difficulty and target from the level and feeds the saved carry-over
 * cards back into the deal.
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
        maxUndos: 0,
        challenge,
        start: rng =>
          newGame(
            difficulty,
            rng,
            challenge.scoreTarget,
            challenge.deckLimit,
            false, // noSwap
            mode.id === 'no-discards',
            [], // keptBonusCards
            [], // deckExtras
            [], // superchargedDeckCards
            mode.id === 'short-circuit',
            mode.id === 'poker-purist' || mode.id === 'three-tricks',
            mode.id === 'three-tricks'
              ? shuffle(SPECIAL_DECK_POOL, rng).slice(0, 3)
              : [],
            mode.id === 'mixed-bag'
              ? ['special', 'in-game', 'end-game']
              : undefined,
            mode.id === 'gridlock' ? 15 : 0,
            mode.id === 'scatter'
          ),
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
          newGame(
            difficulty,
            rng,
            target,
            undefined,
            false,
            false,
            [], // keptBonusCards — no hand carry-over in current spec
            mode.deckExtras,
            mode.superchargedDeckCards
          ),
      };
    }
    case 'daily': {
      // A twisted daily is structurally identical to the same-named
      // challenge — same flag plumbing — but seeded so every player
      // worldwide gets the same deal. One free undo regardless of
      // difficulty (locked decision); using it doesn't taint the score.
      const twist = mode.recipe.twist ?? null;
      const difficulty = mode.recipe.difficulty;
      const target = dailyTargetFor(difficulty, mode.recipe.twist);
      return {
        difficulty,
        target,
        maxUndos: 1,
        challenge: twist ? findChallenge(twist) : null,
        start: rng =>
          newGame(
            difficulty,
            rng,
            target,
            twist === 'short-deck' ? 45 : undefined,
            false, // noSwap
            twist === 'no-discards',
            [],
            [],
            [],
            twist === 'short-circuit',
            twist === 'poker-purist' || twist === 'three-tricks',
            // The Three Tricks trio is seeded off the date (its own
            // salt) so it's globally identical without sharing the
            // deck's rng stream.
            twist === 'three-tricks'
              ? shuffle(
                  SPECIAL_DECK_POOL,
                  seededRng(seedForInitialSpecials(mode.dateISO))
                ).slice(0, 3)
              : [],
            twist === 'mixed-bag'
              ? ['special', 'in-game', 'end-game']
              : undefined,
            twist === 'gridlock' ? 15 : 0,
            twist === 'scatter'
          ),
      };
    }
  }
};
