import { renderHook, act } from '@testing-library/react';
import { newGame, step, GameState } from '../../../game/state';
import { seededRng } from '../../../game/deck';
import { useTargetsStore } from '../../targets/targetsStore';
import { useTargetsResult } from '../useTargetsResult';
import type { GameSession } from '../GameSessionProvider';

// The hook reads the session via useGameSession — feed it a controlled
// one so the ladder lifecycle can be exercised without driving a full
// run to a specific score.
let session: GameSession;
vi.mock('../GameSessionProvider', () => ({
  useGameSession: () => session,
}));

const finishedState = (): GameState => {
  let s = newGame('easy', seededRng(7));
  let guard = 0;
  while (s.phase.kind !== 'game-over' && guard++ < 60) {
    s = step(s, { type: 'PLACE' });
  }
  if (s.phase.kind !== 'game-over') throw new Error('run did not finish');
  return s;
};

const targetsSession = (
  state: GameState,
  { level = 3, viewOnly = false } = {}
): GameSession =>
  ({
    state,
    dispatch: () => {},
    mode: {
      kind: 'targets',
      level,
      deckExtras: [],
      superchargedDeckCards: [],
    },
    setup: null as never,
    maxUndos: 0,
    canUndo: false,
    seed: undefined,
    viewOnly,
  }) as GameSession;

beforeEach(() => {
  localStorage.clear();
  useTargetsStore.setState({ save: null });
});

describe('useTargetsResult — the shared Targets-Up ladder lifecycle', () => {
  it('A-tier win auto-advances the save (no rewards to pick)', () => {
    session = targetsSession(finishedState());
    const { result } = renderHook(() => useTargetsResult(true, 'A'));
    expect(result.current.rewardsPending).toBe(false);
    expect(result.current.rewardCount).toBe(0);
    const save = useTargetsStore.getState().save;
    expect(save?.level).toBe(4);
    expect(save?.wins).toBe(3);
  });

  it('S-tier win holds the advance behind the reward pick', () => {
    session = targetsSession(finishedState());
    const { result } = renderHook(() => useTargetsResult(true, 'S'));
    expect(result.current.rewardsPending).toBe(true);
    expect(result.current.rewardCount).toBe(1);
    // Not committed yet — the pick gates the save.
    expect(useTargetsStore.getState().save).toBeNull();
    // Desktop's "Choose Reward" button opens the sheet on demand.
    expect(result.current.rewardsSheet).toBeNull();
    act(() => result.current.openRewards());
    expect(result.current.rewardsSheet).not.toBeNull();
  });

  it('SS-tier grants two picks (plural button label)', () => {
    session = targetsSession(finishedState());
    const { result } = renderHook(() => useTargetsResult(true, 'SS'));
    expect(result.current.rewardCount).toBe(2);
  });

  it('a loss clears the save so the next run restarts at level 1', () => {
    useTargetsStore.getState().saveProgress(3, 2);
    session = targetsSession(finishedState());
    renderHook(() => useTargetsResult(false, 'C'));
    expect(useTargetsStore.getState().save).toBeNull();
  });

  it('the commit is single-owner across surfaces (same final state)', () => {
    const state = finishedState();
    session = targetsSession(state);
    // Mobile ResultView and the desktop dialog can both mount across a
    // viewport resize — the second hook instance must not advance the
    // save again.
    renderHook(() => useTargetsResult(true, 'A'));
    renderHook(() => useTargetsResult(true, 'A'));
    const save = useTargetsStore.getState().save;
    expect(save?.level).toBe(4);
    expect(save?.wins).toBe(3);
  });

  it('viewOnly sessions never touch the save', () => {
    useTargetsStore.getState().saveProgress(5, 4);
    session = targetsSession(finishedState(), { viewOnly: true });
    const { result } = renderHook(() => useTargetsResult(true, 'SS'));
    expect(result.current.rewardsPending).toBe(false);
    expect(useTargetsStore.getState().save?.level).toBe(5);
  });
});
