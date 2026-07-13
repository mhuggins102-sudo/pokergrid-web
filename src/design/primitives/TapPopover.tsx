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
  /** Stamp "an open popover was just dismissed by an OUTSIDE pointerdown"
   *  (the tap that closed it also lands as a normal tap on whatever sits
   *  behind — e.g. the game board). Consumers can consult wasRecentDismiss
   *  to suppress the behavior that tap would otherwise trigger. */
  recordOutsideDismiss(): void;
  /** True when an outside-pointerdown dismissal happened within `withinMs`
   *  (default 400ms) of now. */
  wasRecentDismiss(withinMs?: number): boolean;
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
  // Timestamp of the last outside-pointerdown dismissal — a plain ref, so
  // stamping it never re-renders the shell.
  const outsideDismissAt = useRef(0);
  // Swallow-the-next-click arming, owned by the PROVIDER (not the per-
  // popover open effect). When an outside pointerdown dismisses a popover
  // it arms this; a persistent capture-phase click listener below then
  // eats the click that same tap produces, so NOTHING behind the popover
  // (board cell, dock button, nav link) acts on the dismissing tap.
  //   Why here and not in useTapPopover's open effect: close() flips `open`
  //   false, and that effect's cleanup runs (in a microtask) BEFORE the
  //   click fires — so a listener armed inside it is gone by click time.
  //   Only the board was ever protected, by its own wasRecentDismiss guard;
  //   the dock / nav had none, so their click landed. A provider-scoped
  //   listener outlives the popover's lifecycle and covers every surface.
  const swallowArmed = useRef(false);
  const swallowTimer = useRef<number | undefined>(undefined);
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
      recordOutsideDismiss() {
        outsideDismissAt.current = Date.now();
        // Arm the click swallow. A drag / no-click tap shouldn't leave it
        // armed for the next real click, so disarm after 700ms.
        swallowArmed.current = true;
        window.clearTimeout(swallowTimer.current);
        swallowTimer.current = window.setTimeout(() => {
          swallowArmed.current = false;
        }, 700);
      },
      wasRecentDismiss(withinMs = 400) {
        return Date.now() - outsideDismissAt.current < withinMs;
      },
    }),
    []
  );

  // The persistent swallow: one capture-phase click listener for the whole
  // app. When armed by an outside dismissal, it eats exactly the next click
  // — in the CAPTURE phase, on document, so it stops before reaching any
  // target handler (React attaches at the root container, below document).
  useEffect(() => {
    const swallow = (e: MouseEvent) => {
      if (!swallowArmed.current) return;
      swallowArmed.current = false;
      window.clearTimeout(swallowTimer.current);
      e.stopPropagation();
      e.preventDefault();
    };
    document.addEventListener('click', swallow, true);
    return () => {
      document.removeEventListener('click', swallow, true);
      window.clearTimeout(swallowTimer.current);
    };
  }, []);

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
  // set true there. The outside tap must ONLY dismiss — recordOutsideDismiss
  // arms the provider's persistent click swallow (see TapPopoverProvider),
  // which eats the click this same tap produces so nothing behind the
  // popover acts on it. Arming happens here (on the pointerdown), but the
  // swallow itself lives in the provider so it survives this effect's
  // cleanup when close() flips `open` false.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapEl.current?.contains(e.target as Node)) {
        registry?.recordOutsideDismiss();
        close();
      }
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
  }, [open, close, registry]);

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

  // Stable handle identity: recompute ONLY when a value actually changes
  // (open flips, or the toggle callback rebinds — which it does with
  // `open`). Without this the hook returned a fresh object every render, so
  // any memo that closes over the handle (the in-game nav pill, the
  // streamlined game-details row) churned identity every render — and since
  // GameScreen re-homes that row through a context it also consumes, that
  // churn drove an unbounded render loop (row → setGameRow → provider value
  // → GameScreen re-render → new row → …). A stable handle breaks it: the
  // re-render triggered by setGameRow now yields the SAME row node, so the
  // re-home effect doesn't re-fire.
  const toggleProps = useMemo(
    () => (coarse ? { onClick: toggle } : {}),
    [coarse, toggle]
  );
  return useMemo(
    () => ({ open, coarse, wrapRef, toggleProps }),
    [open, coarse, wrapRef, toggleProps]
  );
}

/**
 * Read-only access to the registry's outside-dismiss stamp. A tap that
 * closes an open popover by landing outside it (outside pointerdown) also
 * reaches whatever sits behind the popover; a handler back there can call
 * `wasRecentDismiss()` to tell "this tap was really a popover dismissal"
 * and skip its own effect. Fine pointers never open a tap-popover, so the
 * stamp is never set there — behavior stays untouched.
 */
export function useTapPopoverDismissGuard(): {
  wasRecentDismiss: (withinMs?: number) => boolean;
} {
  const registry = useContext(TapPopoverContext);
  return useMemo(
    () => ({
      wasRecentDismiss: (withinMs?: number) =>
        registry?.wasRecentDismiss(withinMs) ?? false,
    }),
    [registry]
  );
}

export function useTapPopoverCloseAll(): () => void {
  const registry = useContext(TapPopoverContext);
  return registry?.closeAll ?? NOOP;
}
