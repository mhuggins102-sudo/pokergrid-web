/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
