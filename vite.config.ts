/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const buildId = (() => {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return 'dev';
  }
})();

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': a fresh deploy's worker installs and activates
      // immediately — no waiting-worker purgatory where surfaces can
      // disagree about which build is live. The RELOAD stays ours to
      // schedule: the library hands it to AutoUpdater (onNeedReload),
      // which holds it while a game is mounted and applies it the
      // moment the player is idle or navigates.
      registerType: 'autoUpdate',
      // Registration happens through the virtual module in AutoUpdater,
      // so no injected register script is needed — and 'auto' would
      // force clientsClaim back on (the plugin overrides the workbox
      // flags below for autoUpdate + auto-injection).
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'PokerGrid',
        short_name: 'PokerGrid',
        description:
          '5×5 poker solitaire. Place every card, score the 10 lines, beat your target.',
        theme_color: '#faf7f1',
        background_color: '#faf7f1',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // A new worker activates as soon as it installs (autoUpdate);
        // clientsClaim stays OFF so a freshly-registered worker never
        // seizes a page mid-boot — Safari can fail the page's in-flight
        // module fetches when a worker takes over during load, which is
        // one way the "just updated" card used to resurface right after
        // a recovery reload. An update still re-controls previously
        // controlled pages via skipWaiting alone.
        skipWaiting: true,
        clientsClaim: false,
        // Leaderboard traffic must never be served from cache — the
        // queue-first sync layer owns retry semantics.
        runtimeCaching: [
          {
            urlPattern: /supabase\.co/,
            handler: 'NetworkOnly',
          },
        ],
        // The /share OG endpoints are Pages Functions, not SPA routes.
        navigateFallbackDenylist: [/^\/share/],
      },
    }),
  ],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'game',
          environment: 'node',
          // Pure-logic tests (.ts); component tests (.tsx) run in the
          // jsdom project below.
          include: [
            'src/game/**/*.test.ts',
            'src/lib/**/*.test.ts',
            'src/features/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.tsx'],
        },
      },
    ],
  },
});
