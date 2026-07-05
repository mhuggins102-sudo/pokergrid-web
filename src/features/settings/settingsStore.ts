import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../lib/safeStorage';

export type DockLayout = 'hand-stack' | 'center-stage' | 'classic';

export interface Settings {
  // Card and scoring sound effects (see useGameSfx).
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
  // Four-color suits by default — suit identity carries scoring meaning
  // (flushes, per-suit perks/density), and color is the fastest read.
  // Purists can switch back to classic red/black in Settings; players
  // with a stored preference keep it (persist merges storage over this).
  twoColorDeck: false,
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
