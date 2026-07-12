import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useGameActive,
  useGameActiveStore,
  useRegisterActiveGame,
} from '../gameActiveStore';

afterEach(() => {
  useGameActiveStore.setState({ count: 0 });
});

describe('gameActiveStore', () => {
  it('is inactive by default', () => {
    const { result } = renderHook(() => useGameActive());
    expect(result.current).toBe(false);
  });

  it('is active while a registered game is mounted, clears on unmount', () => {
    const active = renderHook(() => useGameActive());
    const game = renderHook(() => useRegisterActiveGame(true));
    expect(active.result.current).toBe(true);
    game.unmount();
    expect(active.result.current).toBe(false);
  });

  it('a view-only (inactive) registration never marks the game active', () => {
    const active = renderHook(() => useGameActive());
    renderHook(() => useRegisterActiveGame(false));
    expect(active.result.current).toBe(false);
  });

  it('ref-counts overlapping games (stays active until the last leaves)', () => {
    const active = renderHook(() => useGameActive());
    const a = renderHook(() => useRegisterActiveGame(true));
    const b = renderHook(() => useRegisterActiveGame(true));
    expect(active.result.current).toBe(true);
    a.unmount();
    expect(active.result.current).toBe(true); // b still mounted
    b.unmount();
    expect(active.result.current).toBe(false);
  });
});
