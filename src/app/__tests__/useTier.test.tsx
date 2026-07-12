import { describe, expect, it, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BP_DESKTOP, BP_TABLET, useTier } from '../useTier';
import { mockTier } from '../../test/tier';

describe('useTier', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('exports the plan breakpoints', () => {
    expect(BP_TABLET).toBe(768);
    expect(BP_DESKTOP).toBe(1024);
  });

  it('is phone under the default jsdom shim (no width queries match)', () => {
    // No mockTier here: the global setup.ts matchMedia answers false to
    // width queries — the longstanding "unit tests see the phone tree"
    // contract that useTier must preserve.
    const { result } = renderHook(() => useTier());
    expect(result.current).toBe('phone');
  });

  it('is phone when matchMedia is missing entirely (SSR-like)', () => {
    const previous = window.matchMedia;
    restore = () => {
      window.matchMedia = previous;
    };
    // @ts-expect-error simulating an environment without matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => useTier());
    expect(result.current).toBe('phone');
  });

  it.each([
    ['phone', 'phone'],
    ['tablet', 'tablet'],
    ['desktop', 'desktop'],
  ] as const)('reports %s at the mocked %s viewport', (tier, expected) => {
    const mock = mockTier(tier);
    restore = mock.restore;
    const { result } = renderHook(() => useTier());
    expect(result.current).toBe(expected);
  });

  it('follows live tier changes via matchMedia change events', () => {
    const mock = mockTier('phone');
    restore = mock.restore;
    const { result } = renderHook(() => useTier());
    expect(result.current).toBe('phone');

    act(() => mock.set('tablet'));
    expect(result.current).toBe('tablet');

    act(() => mock.set('desktop'));
    expect(result.current).toBe('desktop');

    act(() => mock.set('phone'));
    expect(result.current).toBe('phone');
  });

  it('stops listening after unmount', () => {
    const mock = mockTier('phone');
    restore = mock.restore;
    const { result, unmount } = renderHook(() => useTier());
    expect(result.current).toBe('phone');
    unmount();
    // Firing a change after unmount must not throw (listeners removed).
    expect(() => mock.set('desktop')).not.toThrow();
  });
});
