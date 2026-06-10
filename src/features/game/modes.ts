import { BonusCard, SPECIAL_DECK_POOL } from '../../game/bonusCards';
import { Card } from '../../game/cards';
import { shuffle } from '../../game/deck';
import {
  Challenge,
  ChallengeId,
  difficultyForLevel,
  findChallenge,
  targetForLevel,
} from '../../game/challenges';
import { Difficulty, UNDOS_BY_DIFFICULTY } from '../../game/rules';
import { GameState, newGame } from '../../game/state';

export type GameMode =
  | { kind: 'free'; difficulty: Difficulty }
  | { kind: 'challenge'; id: ChallengeId }
  | {
      kind: 'targets';
      level: number;
      deckExtras: BonusCard[];
      superchargedDeckCards: Card[];
    };

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
            mode.id === 'gridlock' ? 15 : 0
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
  }
};
