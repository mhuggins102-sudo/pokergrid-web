import { useEffect } from 'react';
import { ThemeChoice, useSettingsStore } from './settingsStore';

// The data-theme value each choice resolves to. 'system' follows the
// OS color-scheme between the two Card Room variants; 'paper' is the
// original Morning Paper tokens (also the :root fallback, so a missing
// attribute degrades to it).
export const resolveTheme = (
  choice: ThemeChoice,
  prefersDark: boolean
): 'card-room' | 'card-room-dark' | 'paper' =>
  choice === 'system' ? (prefersDark ? 'card-room-dark' : 'card-room') : choice;

/**
 * Stamps the resolved theme onto <html data-theme> and keeps the
 * browser-chrome theme-color meta in sync with the theme's surface.
 * index.html runs a tiny pre-paint version of the same logic so the
 * first frame doesn't flash the wrong theme; this hook owns every
 * change after boot (setting toggles, OS scheme flips).
 */
export function useApplyTheme(): void {
  const choice = useSettingsStore(s => s.theme);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(choice, mq?.matches ?? false);
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
  }, [choice]);
}
