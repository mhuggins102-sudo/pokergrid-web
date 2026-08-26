import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../game/cards';
import { SPIRAL_POSITION } from '../../../game/grid';
import type { GameState } from '../../../game/state';
import { SFX } from '../../../lib/sfx';
import { DEFAULT_SETTINGS, useSettingsStore } from '../../settings/settingsStore';
import { useGameSfx } from '../useGameSfx';

vi.mock('../../../lib/sfx', () => ({
  SFX: { place: vi.fn(), joker: vi.fn(), riffle: vi.fn() },
  sfxChime: vi.fn(),
  sfxDeal: vi.fn(),
  sfxForHistoryEntry: vi.fn(() => null),
  sfxLose: vi.fn(),
  sfxWin: vi.fn(),
}));

// The opening deal seats in spiral order — same ordering the flights
// (and now the sounds) use.
const spiralOrder = [...Array(25).keys()].sort(
  (a, b) => SPIRAL_POSITION[a] - SPIRAL_POSITION[b]
);

/** Minimal mounted-session state: the opening card seated at the spiral
 *  center, optionally followed by an engine-placed joker. Only the
 *  fields useGameSfx's mount branch reads. */
const openingState = (withJoker: boolean): GameState => {
  const grid: (Card | null)[] = Array(25).fill(null);
  grid[spiralOrder[0]] = { kind: 'standard', rank: 'A', suit: 'S' };
  const history = ['Game start'];
  if (withJoker) {
    grid[spiralOrder[1]] = { kind: 'joker' };
    history.push('Joker auto-placed');
  }
  return {
    grid,
    history,
    past: [],
    phase: { kind: 'placing' },
    openingCard: null,
    drawPoker: false,
  } as unknown as GameState;
};

const noMotionPrefs = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

describe('useGameSfx opening deal', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, sounds: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });

  it('voices an engine-placed opening joker with its flourish', () => {
    // The staged (non-reduced) path: each seat is its own flight.
    window.matchMedia = noMotionPrefs as typeof window.matchMedia;
    renderHook(() => useGameSfx(openingState(true), 0));
    // Nothing sounds before the first flight lands.
    act(() => vi.advanceTimersByTime(300));
    expect(SFX.place).not.toHaveBeenCalled();
    expect(SFX.joker).not.toHaveBeenCalled();
    act(() => vi.runAllTimers());
    // One place tick for the opening card, one flourish for the joker —
    // NOT two plain ticks, and not a single tick for the pair.
    expect(SFX.place).toHaveBeenCalledTimes(1);
    expect(SFX.joker).toHaveBeenCalledTimes(1);
  });

  it('keeps the single-card opening to one plain tick', () => {
    window.matchMedia = noMotionPrefs as typeof window.matchMedia;
    renderHook(() => useGameSfx(openingState(false), 0));
    act(() => vi.runAllTimers());
    expect(SFX.place).toHaveBeenCalledTimes(1);
    expect(SFX.joker).not.toHaveBeenCalled();
  });

  it('defers the opening voice while the intro tour holds it', () => {
    window.matchMedia = noMotionPrefs as typeof window.matchMedia;
    const { rerender } = renderHook(
      ({ hold }) => useGameSfx(openingState(true), 0, false, hold),
      { initialProps: { hold: true } }
    );
    // Held: total silence, and no baseline recorded.
    act(() => vi.runAllTimers());
    expect(SFX.place).not.toHaveBeenCalled();
    expect(SFX.joker).not.toHaveBeenCalled();
    // Tour closed: the mount branch runs as if freshly mounted.
    rerender({ hold: false });
    act(() => vi.runAllTimers());
    expect(SFX.place).toHaveBeenCalledTimes(1);
    expect(SFX.joker).toHaveBeenCalledTimes(1);
  });

  it('layers the flourish on the single tick under reduced motion', () => {
    // Default test setup declares prefers-reduced-motion: everything
    // seats at once, so one tick stands in for the deal with the joker
    // flourish layered on top.
    renderHook(() => useGameSfx(openingState(true), 0));
    act(() => vi.runAllTimers());
    expect(SFX.place).toHaveBeenCalledTimes(1);
    expect(SFX.joker).toHaveBeenCalledTimes(1);
  });
});
