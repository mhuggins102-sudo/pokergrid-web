import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { seededRng } from '../../game/deck';
import { Action, GameState, step } from '../../game/state';
import { GameMode, ModeSetup, setupForMode } from './modes';

export interface GameSession {
  state: GameState;
  dispatch: (action: Action) => void;
  mode: GameMode;
  setup: ModeSetup;
  /** Per-mode undo cap (challenges 0, otherwise per difficulty). */
  maxUndos: number;
  /** True when UNDO is currently allowed (snapshots exist + under cap). */
  canUndo: boolean;
}

const GameSessionContext = createContext<GameSession | null>(null);

export interface GameSessionProviderProps {
  mode: GameMode;
  /**
   * Deterministic seed for the run. Normally undefined (Math.random);
   * E2E tests and the future daily mode pass a number so the whole run
   * is reproducible.
   */
  seed?: number;
  children: ReactNode;
}

/**
 * Owns the ported game reducer for one run. The pure `step` reducer
 * needs an rng for a few actions (shuffle/rewind specials, Short
 * Circuit's random perks), so we keep one rng for the session's
 * lifetime and thread it through dispatch.
 *
 * Remount (via key) to start a fresh run.
 */
export function GameSessionProvider({
  mode,
  seed,
  children,
}: GameSessionProviderProps) {
  const rngRef = useRef<(() => number) | null>(null);
  if (rngRef.current === null) {
    rngRef.current = seed !== undefined ? seededRng(seed) : Math.random;
  }
  const rng = rngRef.current;

  const setupRef = useRef<ModeSetup | null>(null);
  if (setupRef.current === null) {
    setupRef.current = setupForMode(mode);
  }
  const setup = setupRef.current;

  const [state, rawDispatch] = useReducer(
    (s: GameState, a: Action) => step(s, a, rng),
    undefined,
    () => setup.start(rng)
  );

  const dispatch = useCallback((action: Action) => rawDispatch(action), []);

  const maxUndos = setup.maxUndos;
  const canUndo = state.past.length > 0 && state.undoCount < maxUndos;

  const session = useMemo<GameSession>(
    () => ({ state, dispatch, mode, setup, maxUndos, canUndo }),
    [state, dispatch, mode, setup, maxUndos, canUndo]
  );

  return (
    <GameSessionContext.Provider value={session}>
      {children}
    </GameSessionContext.Provider>
  );
}

export function useGameSession(): GameSession {
  const ctx = useContext(GameSessionContext);
  if (!ctx) {
    throw new Error('useGameSession must be used inside <GameSessionProvider>');
  }
  return ctx;
}
