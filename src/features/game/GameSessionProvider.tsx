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
import { Difficulty, UNDOS_BY_DIFFICULTY } from '../../game/rules';
import { Action, GameState, newGame, step } from '../../game/state';

export interface GameSession {
  state: GameState;
  dispatch: (action: Action) => void;
  /** Per-mode undo cap. Free play reads UNDOS_BY_DIFFICULTY. */
  maxUndos: number;
  /** True when UNDO is currently allowed (snapshots exist + under cap). */
  canUndo: boolean;
}

const GameSessionContext = createContext<GameSession | null>(null);

export interface GameSessionProviderProps {
  difficulty: Difficulty;
  /**
   * Deterministic seed for the run. Free play normally passes undefined
   * (Math.random); E2E tests and the future daily mode pass a number so
   * the whole run is reproducible.
   */
  seed?: number;
  children: ReactNode;
}

/**
 * Owns the ported game reducer for one run. The pure `step` reducer needs
 * an rng for a few actions (shuffle/rewind specials, Short Circuit), so we
 * keep one rng for the session's lifetime and thread it through dispatch.
 *
 * Remount (via key) to start a fresh run.
 */
export function GameSessionProvider({
  difficulty,
  seed,
  children,
}: GameSessionProviderProps) {
  const rngRef = useRef<() => number>(null as unknown as () => number);
  if (rngRef.current === null) {
    rngRef.current = seed !== undefined ? seededRng(seed) : Math.random;
  }

  const [state, rawDispatch] = useReducer(
    (s: GameState, a: Action) => step(s, a, rngRef.current),
    undefined,
    () => newGame(difficulty, rngRef.current)
  );

  const dispatch = useCallback((action: Action) => rawDispatch(action), []);

  const maxUndos = UNDOS_BY_DIFFICULTY[difficulty];
  const canUndo = state.past.length > 0 && state.undoCount < maxUndos;

  const session = useMemo<GameSession>(
    () => ({ state, dispatch, maxUndos, canUndo }),
    [state, dispatch, maxUndos, canUndo]
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
