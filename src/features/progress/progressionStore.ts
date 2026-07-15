import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../lib/safeStorage';

// The highest player level the user has already been SHOWN a "Level X
// reached" banner for. XP/level itself is derived from stats (see
// lib/xp.ts) — this stores only the acknowledgement watermark, so:
//   • a brand-new install seeds it to the current derived level (a
//     veteran with a big record doesn't get spammed with old level-ups),
//   • and each game that crosses a threshold shows the banner exactly
//     once, then bumps the watermark.
interface ProgressionStore {
  // null = not yet seeded (see useSeedProgression).
  levelAckd: number | null;
  ackLevel: (level: number) => void;
  reset: () => void;
}

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    set => ({
      levelAckd: null,
      ackLevel: level =>
        set(s =>
          s.levelAckd !== null && s.levelAckd >= level
            ? s
            : { levelAckd: level }
        ),
      reset: () => set({ levelAckd: null }),
    }),
    {
      name: 'pokergrid:progression:v1',
      storage: safeJSONStorage(),
    }
  )
);
