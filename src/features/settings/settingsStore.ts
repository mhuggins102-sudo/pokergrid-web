import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../../lib/safeStorage';

export type DockLayout =
  | 'hand-stack'
  | 'center-stage'
  | 'classic'
  // Phone-only experiment: the desktop two-rail arrangement fitted to the
  // phone column — held bonus cards in a left column, the deck + actions in
  // a right column (the desk center-stage dock). Ignored by the desk/desk-
  // lite forks, which pick their own arrangement from the same key.
  | 'desktop';

// Visual theme, two axes: the look (Card Room refresh vs the original
// Morning Paper) and the appearance (light/dark/system). Both looks
// have both appearances; useApplyTheme resolves the pair to one of the
// four data-theme token blocks.
export type ThemeFamily = 'card-room' | 'paper';
export type Appearance = 'light' | 'dark' | 'system';

export interface Settings {
  // Visual theme (see ThemeFamily/Appearance / useApplyTheme).
  themeFamily: ThemeFamily;
  appearance: Appearance;
  // Card and scoring sound effects (see useGameSfx).
  sounds: boolean;
  // In-game bottom bar arrangement (see DockLayoutPreview).
  dockLayout: DockLayout;
  // Live line rails: each row/column's running total rides the board
  // edge during play. Off restores the plain board (line totals stay
  // available via the Lines sheet and the tap-spotlight popup).
  lineRails: boolean;
  // Desktop (≥1024px) edge chips: the potential-per-line pills right of
  // and below the board. A SEPARATE key from lineRails because the two
  // surfaces default differently — the desktop mockup ships chips on
  // (pg-rails default '1'), phones ship rails off — mirroring the
  // per-breakpoint dock-layout divergence.
  deskLineChips: boolean;
  // Force-reduce animations regardless of the OS-level setting.
  reduceMotion: boolean;
  // Augment color-coded UI with glyphs for colorblind players.
  colorBlindAssist: boolean;
  // Classic two-color (red/black) card faces vs four-color suits.
  twoColorDeck: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  // New players start on the original editorial look, dark.
  themeFamily: 'paper',
  appearance: 'dark',
  sounds: true,
  dockLayout: 'hand-stack',
  // Rails start off — the plain board reads cleaner for new players;
  // line totals stay reachable via the Lines sheet and tap-spotlight.
  lineRails: false,
  // Desktop chips default ON — the mockup's default. Migration-safe:
  // persist merges stored keys over these defaults, so profiles saved
  // before this key existed simply pick up `true`.
  deskLineChips: true,
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

// v0 stored a single `theme` choice; v1 splits it into family +
// appearance. Exported for tests.
export const migrateSettings = (
  persisted: unknown,
  version: number
): unknown => {
  if (version >= 1 || persisted === null || typeof persisted !== 'object') {
    return persisted;
  }
  const legacy = persisted as { theme?: string } & Record<string, unknown>;
  const { theme, ...rest } = legacy;
  const mapped: { themeFamily: ThemeFamily; appearance: Appearance } =
    theme === 'paper'
      ? { themeFamily: 'paper', appearance: 'light' }
      : theme === 'card-room'
        ? { themeFamily: 'card-room', appearance: 'light' }
        : theme === 'card-room-dark'
          ? { themeFamily: 'card-room', appearance: 'dark' }
          : { themeFamily: 'card-room', appearance: 'system' };
  return { ...rest, ...mapped };
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      ...DEFAULT_SETTINGS,
      set: patch => set(patch),
    }),
    {
      name: 'pokergrid:settings:v1',
      storage: safeJSONStorage(),
      version: 1,
      migrate: migrateSettings,
    }
  )
);
