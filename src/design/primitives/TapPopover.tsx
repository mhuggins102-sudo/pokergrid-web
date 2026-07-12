import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router';

/**
 * TapPopover — BEHAVIOR-ONLY touch equivalence for the hover / :focus-within
 * popovers scattered across the game (nav Game Modes, in-game nav pills,
 * deck peek, scoring ⓘ, leaderboard fly-out). Decision E of the unification
 * plan; retires the phase-2 Game-Modes shim.
 *
 * WHY behavior-only. Every surface already ships correct anchored-popover
 * CSS — its own hover rules, :focus-within rules, invisible hover bridges,
 * and z-index / suppression tie-breaks. Re-homing that geometry into one
 * primitive would risk regressing five bespoke layouts, so the primitive
 * owns only the touch STATE machine; each surface keeps its stylesheet and
 * gains exactly ONE "forced open" class this hook drives.
 *
 * WHY fine pointers stay untouched. On a mouse the hover / :focus-within CSS
 * already does the right thing, and the reviewer's screenshot sweep must
 * stay byte-identical at ≥768. So on a fine pointer this hook attaches no
 * listeners, wires no onClick (toggleProps is empty), and never adds the
 * open class — `coarse` gates the whole machine.
 *
 * The coarse gotcha. A tap FOCUSES the trigger, and the surfaces'
 * :focus-within open rules are NOT hover-gated — so a tapped popover would
 * pin open until focus left. close() therefore blurs any focus sitting
 * inside the wrap (the modesClosed blur dance in DesktopNav is the
 * precedent). Dismissal fires on: outside pointerdown, Escape, route change
 * (the provider watches useLocation), and every committed game action
 * (GameScreen subscribes closeAll to the session state). A single-open
 * registry closes any other popover the moment one opens.
 */

interface TapPopoverRegistry {
  /** Enrol a popover's close(); returns an unregister for cleanup. */
  register(id: string, close: () => void): () => void;
  /** Single-open: close every popover except `id`. */
  notifyOpen(id: string): void;
  /** Close every registered popover (route change / game commit). */
  closeAll(): void;
}

const TapPopoverContext = createContext<TapPopoverRegistry | null>(null);

const NOOP = () => {};

// The DesktopNav.tsx coarse idiom, factored out — `?.` guards the SSR /
// jsdom-without-matchMedia case (answers false → fine-pointer behavior).
const isCoarse = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(pointer: coarse)').matches;

export function TapPopoverProvider({ children }: { children: ReactNode }) {
  // A plain Map of id → close callback, kept in a ref (not state): the
  // registry mutates on every popover mount/open and must never re-render
  // the shell it wraps.
  const registry = useRef(new Map<string, () => void>());
  const { pathname } = useLocation();

  const value = useMemo<TapPopoverRegistry>(
    () => ({
      register(id, close) {
        registry.current.set(id, close);
        return () => {
          // Only drop our own entry — a fast id reuse mustn't delete the
          // successor's close.
          if (registry.current.get(id) === close) registry.current.delete(id);
        };
      },
      notifyOpen(id) {
        for (const [otherId, close] of registry.current) {
          if (otherId !== id) close();
        }
      },
      closeAll() {
        for (const close of registry.current.values()) close();
      },
    }),
    []
  );

  // Route change closes every open popover — menu-item taps navigate, and
  // so does any programmatic route change.
  useEffect(() => {
    value.closeAll();
  }, [pathname, value]);

  return (
    <TapPopoverContext.Provider value={value}>
      {children}
    </TapPopoverContext.Provider>
  );
}

export interface TapPopoverHandle {
  /** True while the popover is forced open (always false on fine pointers). */
  open: boolean;
  /** True on coarse pointers — for any tap-only chrome the surface adds. */
  coarse: boolean;
  /** Callback ref for the popover WRAP (the anchor its CSS hangs off). It
   *  takes HTMLElement so it attaches to a span / div / section / button
   *  wrap alike. */
  wrapRef: (el: HTMLElement | null) => void;
  /** Spread onto the TRIGGER: carries the tap onClick on coarse, empty on
   *  fine (so a mouse trigger gains nothing). */
  toggleProps: { onClick?: () => void };
}

export function useTapPopover(id: string): TapPopoverHandle {
  const registry = useContext(TapPopoverContext);
  // Coarse is a device trait, resolved once at mount — stable toggleProps.
  const [coarse] = useState(isCoarse);
  const [open, setOpen] = useState(false);
  const wrapEl = useRef<HTMLElement | null>(null);
  const wrapRef = useCallback((el: HTMLElement | null) => {
    wrapEl.current = el;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Drop focus parked inside the wrap so the surface's (non-hover-gated)
    // :focus-within open rule can't re-pin the popover after this JS close.
    const active = document.activeElement as HTMLElement | null;
    if (active && wrapEl.current?.contains(active)) active.blur?.();
  }, []);

  // Enrol with the provider for single-open + closeAll — coarse only, so
  // fine-pointer popovers never enter the registry.
  useEffect(() => {
    if (!coarse || !registry) return;
    return registry.register(id, close);
  }, [coarse, registry, id, close]);

  // While open: outside pointerdown and Escape dismiss (lifted from the
  // DesktopNav phase-2 shim). Only ever attached on coarse — open is only
  // set true there.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapEl.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // `open` read from the render closure — the onClick binds fresh every
  // render, so it always sees the current value (and avoids side effects
  // inside a setState updater, which StrictMode would double-run).
  const toggle = useCallback(() => {
    if (open) {
      close();
    } else {
      registry?.notifyOpen(id);
      setOpen(true);
    }
  }, [open, close, registry, id]);

  return {
    open,
    coarse,
    wrapRef,
    toggleProps: coarse ? { onClick: toggle } : {},
  };
}

export function useTapPopoverCloseAll(): () => void {
  const registry = useContext(TapPopoverContext);
  return registry?.closeAll ?? NOOP;
}
