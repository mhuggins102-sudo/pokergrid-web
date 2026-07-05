import { useEffect, useSyncExternalStore } from 'react';
import { Appearance, ThemeFamily, useSettingsStore } from './settingsStore';

export type ResolvedTheme =
  | 'card-room'
  | 'card-room-dark'
  | 'paper'
  | 'paper-dark';

// The data-theme value a (family, appearance) pair resolves to.
// 'system' follows the OS color-scheme within the chosen family.
export const resolveTheme = (
  family: ThemeFamily,
  appearance: Appearance,
  prefersDark: boolean
): ResolvedTheme => {
  const dark = appearance === 'dark' || (appearance === 'system' && prefersDark);
  if (family === 'paper') return dark ? 'paper-dark' : 'paper';
  return dark ? 'card-room-dark' : 'card-room';
};

/**
 * Stamps the resolved theme onto <html data-theme> and keeps the
 * browser-chrome theme-color meta in sync with the theme's surface.
 * index.html runs a tiny pre-paint version of the same logic so the
 * first frame doesn't flash the wrong theme; this hook owns every
 * change after boot (setting toggles, OS scheme flips).
 */
export function useApplyTheme(): void {
  const family = useSettingsStore(s => s.themeFamily);
  const appearance = useSettingsStore(s => s.appearance);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(family, appearance, mq?.matches ?? false);
      document.documentElement.dataset.theme = resolved;
      // Browser chrome (address bar / PWA title bar) follows the paper
      // surface. Guard: jsdom returns '' for custom properties.
      const surface = getComputedStyle(document.documentElement)
        .getPropertyValue('--paper')
        .trim();
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && surface) meta.setAttribute('content', surface);
    };
    apply();
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [family, appearance]);
}

/**
 * The currently-resolved theme, live: re-renders on setting changes
 * AND on OS scheme flips while appearance is 'system'. Used by the
 * Settings live preview to re-theme its sample independently.
 */
export function useResolvedTheme(): ResolvedTheme {
  const family = useSettingsStore(s => s.themeFamily);
  const appearance = useSettingsStore(s => s.appearance);
  const prefersDark = useSyncExternalStore(
    onChange => {
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
    () => false
  );
  return resolveTheme(family, appearance, prefersDark);
}
