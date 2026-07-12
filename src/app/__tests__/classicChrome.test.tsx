import { useCallback, useMemo, useRef, useState } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ClassicChromeContext,
  useClassicChrome,
} from '../useClassicChrome';

function Register() {
  useClassicChrome();
  return null;
}

describe('useClassicChrome', () => {
  it('registers on mount and deregisters on unmount', () => {
    const cleanup = vi.fn();
    const register = vi.fn(() => cleanup);
    const { unmount } = render(
      <ClassicChromeContext.Provider value={{ register }}>
        <Register />
      </ClassicChromeContext.Provider>
    );
    expect(register).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('no-ops without a provider (phone / unwrapped tree)', () => {
    // Must not throw when the context is absent.
    expect(() => render(<Register />)).not.toThrow();
  });

  it('ref-counts nested registrations (AppLayout contract)', () => {
    // Faithful reproduction of AppLayout's register: the flag is on iff
    // at least one surface is registered.
    const seen: boolean[] = [];
    function Harness({ a, b }: { a: boolean; b: boolean }) {
      const countRef = useRef(0);
      const [on, setOn] = useState(false);
      const register = useCallback(() => {
        countRef.current += 1;
        setOn(countRef.current > 0);
        return () => {
          countRef.current -= 1;
          setOn(countRef.current > 0);
        };
      }, []);
      const value = useMemo(() => ({ register }), [register]);
      seen.push(on);
      return (
        <ClassicChromeContext.Provider value={value}>
          {a && <Register />}
          {b && <Register />}
        </ClassicChromeContext.Provider>
      );
    }
    const { rerender } = render(<Harness a b />);
    // Both registered → flag on.
    expect(seen.at(-1)).toBe(true);
    rerender(<Harness a b={false} />); // one still registered → stays on
    expect(seen.at(-1)).toBe(true);
    rerender(<Harness a={false} b={false} />); // none → off
    expect(seen.at(-1)).toBe(false);
  });
});
