import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hydrateBonusCards } from '../../../game/bonusCards';
import { safeJSONStorage } from '../../../lib/safeStorage';
import type { GameState } from '../../../game/state';
import type { DailyRecipe } from '../../../game/daily/recipe';

// One completed daily run per date. The full game state is stashed so
// the result can be re-rendered on revisit (board, line math, bonus
// attribution) without a separate read-only snapshot format.
export interface DailyPlay {
  dateISO: string;
  score: number;
  won: boolean;
  recipe: DailyRecipe;
  completedAt: number;
  state: GameState;
}

export type DailyPlaysMap = Record<string, DailyPlay>;

// The result view only needs the FINAL state. `past` is the undo
// snapshot stack — each entry a full GameState — which once ballooned
// stored plays until localStorage's quota blew up mid-save. Strip it
// (and the history log) both when saving and when hydrating legacy
// entries.
const slimState = (state: GameState): GameState => ({
  ...state,
  past: [],
  history: [],
});

// JSON.stringify drops BonusCard function fields (lineEffect /
// gridEffect); rebind them on load so a revisited daily still shows
// per-card contributions.
const hydratePlay = (play: DailyPlay): DailyPlay => ({
  ...play,
  state: {
    ...slimState(play.state),
    bonusCards: hydrateBonusCards(play.state.bonusCards),
    bonusDeck: hydrateBonusCards(play.state.bonusDeck),
  },
});

interface PlaysStore {
  plays: DailyPlaysMap;
  savePlay: (play: DailyPlay) => void;
  reset: () => void;
}

export const usePlaysStore = create<PlaysStore>()(
  persist(
    set => ({
      plays: {},
      savePlay: play =>
        set(s => ({
          plays: {
            ...s.plays,
            [play.dateISO]: { ...play, state: slimState(play.state) },
          },
        })),
      reset: () => set({ plays: {} }),
    }),
    {
      name: 'pokergrid:daily:plays:v1',
      storage: safeJSONStorage(),
      merge: (persisted, current) => {
        const raw =
          (persisted as { plays?: DailyPlaysMap } | undefined)?.plays ?? {};
        const plays: DailyPlaysMap = {};
        for (const [k, v] of Object.entries(raw)) {
          try {
            plays[k] = hydratePlay(v);
          } catch {
            // Corrupt entry — drop it rather than poisoning the map.
          }
        }
        return { ...current, plays };
      },
    }
  )
);
