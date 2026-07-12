import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameFamily } from '../useGameFamily';
import { mockTier } from '../../../test/tier';

/**
 * A landscape-aware wrapper over mockTier's matchMedia: the tier width
 * queries answer per the mocked tier (delegated), while
 * `(orientation: landscape)` is forced true — the least invasive way to
 * see the desk-lite family (mockTier alone answers every non-width
 * query false, which lands on portrait / column).
 */
function withLandscape(): void {
  const base = window.matchMedia;
  window.matchMedia = ((query: string) => {
    if (query.includes('orientation: landscape')) {
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    }
    return base(query);
  }) as typeof window.matchMedia;
}

describe('useGameFamily', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("is 'column' under the default jsdom shim (phone tree contract)", () => {
    // No mockTier: setup.ts answers false to every width + orientation
    // query → phone tier, portrait → column, the unit-test contract.
    const { result } = renderHook(() => useGameFamily());
    expect(result.current).toBe('column');
  });

  it("is 'desk' at the desktop tier", () => {
    const mock = mockTier('desktop');
    restore = mock.restore;
    const { result } = renderHook(() => useGameFamily());
    expect(result.current).toBe('desk');
  });

  it("is 'column' at the tablet tier in portrait (jsdom orientation)", () => {
    const mock = mockTier('tablet');
    restore = mock.restore;
    const { result } = renderHook(() => useGameFamily());
    expect(result.current).toBe('column');
  });

  it("is 'desk-lite' at the tablet tier in landscape", () => {
    const mock = mockTier('tablet');
    restore = mock.restore; // restores the pre-mock matchMedia
    withLandscape();
    const { result } = renderHook(() => useGameFamily());
    expect(result.current).toBe('desk-lite');
  });
});
