import { defineConfig, devices } from '@playwright/test';

/**
 * E2E: a deterministic seeded free-play run at the reference viewports
 * from the redesign plan (390px phone, 1280px desktop) plus the
 * mobile/tablet unification plan's tablet tier (820px, touch).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // Managed containers ship a system Chromium instead of the
    // playwright-pinned build; point at it via env when present.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        // Chromium-based mobile preset at the plan's 390px reference width.
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      // Tablet tier (768–1023px): iPad-Air-ish portrait with touch.
      // Phase 1 of the unification plan pins that this width still
      // renders the PHONE trees; later phases flip pages/game to the
      // desk designs deliberately (spacing.spec asserts the current
      // state explicitly so the flip shows up as a test edit).
      name: 'tablet-820',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'desktop-1280',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
