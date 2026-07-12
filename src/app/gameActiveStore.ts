import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Tracks whether an interactive game session is mounted, so the
 * auto-updater (AutoUpdater) can hold a pending version swap until the
 * player is out of a game. A reload mid-game would drop the in-memory
 * board — only finished results are persisted — so the update waits.
 * Ref-counted, so nested / overlapping sessions are safe.
 */
interface GameActiveState {
  count: number;
  enter: () => void;
  leave: () => void;
}

export const useGameActiveStore = create<GameActiveState>(set => ({
  count: 0,
  enter: () => set(s => ({ count: s.count + 1 })),
  leave: () => set(s => ({ count: Math.max(0, s.count - 1) })),
}));

/** True while at least one interactive game session is mounted. */
export const useGameActive = (): boolean => useGameActiveStore(s => s.count > 0);

/** Register an interactive game for the caller's lifetime. A no-op when
 *  `active` is false (e.g. a view-only rehydrated archive result, which
 *  the auto-updater is free to reload past). */
export function useRegisterActiveGame(active: boolean): void {
  const enter = useGameActiveStore(s => s.enter);
  const leave = useGameActiveStore(s => s.leave);
  useEffect(() => {
    if (!active) return;
    enter();
    return leave;
  }, [active, enter, leave]);
}
