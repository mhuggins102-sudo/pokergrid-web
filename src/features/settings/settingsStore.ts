import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../lib/safeStorage';

export type DockLayout = 'hand-stack' | 'center-stage' | 'classic';

export interface Settings {
  // Sound effects (wired up in the polish phase; persisted now so the
  // preference survives).
  sounds: boolean;
  // In-game bottom bar arrangement (see DockLayoutPreview).
  dockLayout: DockLayout;
  // Force-reduce animations regardless of the OS-level setting.
  reduceMotion: boolean;
  // Augment color-coded UI with glyphs for colorblind players.
  colorBlindAssist: boolean;
  // Classic two-color (red/black) card faces vs four-color suits.
  twoColorDeck: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: true,
  dockLayout: 'classic',
  reduceMotion: false,
  colorBlindAssist: false,
  twoColorDeck: true,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      ...DEFAULT_SETTINGS,
      set: patch => set(patch),
    }),
    { name: 'pokergrid:settings:v1', storage: safeJSONStorage() }
  )
);
