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
import { useRegisterActiveGame } from '../../app/gameActiveStore';
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
  /** The run's deterministic seed, when it has one — free play mints
   *  one per run so the share link can re-issue the exact deal. */
  seed?: number;
  /** True when this session re-hydrates a STORED finished run for
   *  viewing (desktop archive "View full result"). Result surfaces
   *  must not re-record stats/achievements or re-save the play. */
  viewOnly: boolean;
}

const GameSessionContext = createContext<GameSession | null>(null);

export interface GameSessionProviderProps {
  mode: GameMode;
  /**
   * Deterministic seed for the run. Normally undefined (Math.random);
   * E2E tests and daily mode pass a number so the whole run — deal and
   * every in-play random outcome — is reproducible.
   */
  seed?: number;
  /**
   * Re-hydrated stored state to open with (instead of a fresh deal) —
   * the desktop archive's "view a finished run" path. Marks the whole
   * session view-only so result recording stays with the live finish.
   */
  initialState?: GameState;
  children: ReactNode;
}

// Module-level so the reducer identity is stable across renders. `step`
// is pure — every random call draws from state.rngState — so React is
// free to invoke it more than once per action (eager state computation,
// replayed renders, StrictMode) without desyncing seeded (daily) runs.
const reduce = (s: GameState, a: Action): GameState => step(s, a);

/**
 * Owns the ported game reducer for one run. Randomness lives inside
 * GameState (state.rngState), so the reducer is pure; the only impure
 * moment is the initializer, which builds a fresh rng per invocation —
 * a seeded run therefore initializes identically even if React runs
 * the initializer twice.
 *
 * Remount (via key) to start a fresh run.
 */
export function GameSessionProvider({
  mode,
  seed,
  initialState,
  children,
}: GameSessionProviderProps) {
  const setupRef = useRef<ModeSetup | null>(null);
  if (setupRef.current === null) {
    setupRef.current = setupForMode(mode);
  }
  const setup = setupRef.current;

  const [state, rawDispatch] = useReducer(
    reduce,
    undefined,
    () =>
      initialState ??
      setup.start(seed !== undefined ? seededRng(seed) : Math.random)
  );

  const dispatch = useCallback((action: Action) => rawDispatch(action), []);

  const maxUndos = setup.maxUndos;
  const canUndo = state.past.length > 0 && state.undoCount < maxUndos;
  const viewOnly = initialState !== undefined;

  // Hold any pending auto-update while a live game is mounted — a reload
  // would drop this in-memory board. View-only (rehydrated) sessions
  // carry no unsaved progress, so they don't register.
  useRegisterActiveGame(!viewOnly);

  const session = useMemo<GameSession>(
    () => ({ state, dispatch, mode, setup, maxUndos, canUndo, seed, viewOnly }),
    [state, dispatch, mode, setup, maxUndos, canUndo, seed, viewOnly]
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

export interface ActionGate {
  /** Whether this dispatch may go through right now. */
  allow: (action: Action, state: GameState) => boolean;
  /** Called after an allowed action is dispatched. */
  onAction?: (action: Action) => void;
  /** Called when a dispatch is blocked (nudge UX). */
  onBlocked?: (action: Action) => void;
}

/**
 * Re-provides the session with a filtered dispatch. Every interaction
 * in GameScreen and its children funnels through session.dispatch, so
 * this single wrapper is enough for the tutorial to constrain play to
 * the scripted move — no per-component awareness needed.
 */
export function GameSessionGate({
  gate,
  children,
}: {
  gate: ActionGate;
  children: ReactNode;
}) {
  const session = useGameSession();
  const gated = useMemo<GameSession>(
    () => ({
      ...session,
      dispatch: (action: Action) => {
        if (!gate.allow(action, session.state)) {
          gate.onBlocked?.(action);
          return;
        }
        session.dispatch(action);
        gate.onAction?.(action);
      },
    }),
    [session, gate]
  );
  return (
    <GameSessionContext.Provider value={gated}>
      {children}
    </GameSessionContext.Provider>
  );
}
