import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../lib/safeStorage';
import { BonusCard } from '../../game/bonusCards';
import { Card } from '../../game/cards';
import {
  TUSave,
  hydrateTUSave,
  serializeBonusCard,
} from '../../lib/targetsUpSave';

interface TargetsStore {
  save: TUSave | null;
  saveProgress: (
    level: number,
    wins: number,
    deckExtras?: BonusCard[],
    superchargedDeckCards?: Card[],
    lastKeptBaseId?: string | null
  ) => void;
  clearProgress: () => void;
}

/** Targets-Up resume save — same key/format as the original app. */
export const useTargetsStore = create<TargetsStore>()(
  persist(
    set => ({
      save: null,
      saveProgress: (
        level,
        wins,
        deckExtras,
        superchargedDeckCards,
        lastKeptBaseId
      ) =>
        set({
          save: {
            level,
            wins,
            ts: Date.now(),
            // keptCard intentionally always null — no hand carry-over
            // in the current spec; field kept for save migration.
            keptCard: null,
            deckExtras: (deckExtras ?? []).map(serializeBonusCard),
            superchargedDeckCards: superchargedDeckCards ?? [],
            lastKeptBaseId: lastKeptBaseId ?? null,
          },
        }),
      clearProgress: () => set({ save: null }),
    }),
    {
      name: 'pokergrid:tu-save:v1',
      storage: safeJSONStorage(),
      merge: (persisted, current) => ({
        ...current,
        save: hydrateTUSave(
          (persisted as { save?: Partial<TUSave> | null } | undefined)?.save ??
            null
        ),
      }),
    }
  )
);
