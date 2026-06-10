# PokerGrid (web)

Ground-up web rebuild of [PokerGrid](https://pokergrid.pages.dev) — a 5×5
poker-solitaire daily puzzle — on Vite + React + TypeScript with a clean
editorial ("Morning Paper") design system. The original Expo/react-native-web
site keeps running; both sites share the same Supabase backend, so daily
leaderboards stay unified.

The full assessment and phased plan live in the original repo at
`docs/REDESIGN_PLAN.md`.

## Status

**Phase 1 — scaffold + core** (this commit):

- Vite 7 + React 19 + TS strict, react-router v7 (library mode), every
  screen deep-linkable from day one
- `src/game/` — the pure game core ported **verbatim** from the original
  repo (reducer-driven state machine, deterministic daily seeding,
  Shapley-value bonus attribution) along with 21 of its test files
- `src/design/` — "Morning Paper" tokens (`tokens.css` + typed `tokens.ts`
  mirror) and primitives: Button, Dialog (native `<dialog>`), Sheet, Tabs,
  Toast
- Vitest (node env for game logic, jsdom + Testing Library for UI), CI

Visit `/design` for the token-gallery reference page.

Next: Phase 2 (playable game) → Phase 3 (daily + leaderboard) →
Phase 4 (progression) → Phase 5 (polish + launch).

## Develop

```sh
npm install
npm run dev        # vite dev server
npm test           # vitest run (game + ui projects)
SIMULATE=1 npm test  # also run the opt-in bot-simulation balance suite
npm run typecheck
npm run lint
npm run build      # tsc -b && vite build
```

## Layout

```
src/
  game/            # pure game core — ported verbatim, no React imports
  lib/             # pure helpers (share encoding, bonus-card categories)
  design/          # tokens.css, tokens.ts, typography, reset, primitives/
    gallery/       # /design token-gallery page
  app/             # router + AppLayout chrome
  features/        # one folder per screen; placeholders until their phase
```

## Deploy

Static SPA for Cloudflare Pages (`public/_redirects` provides the history
fallback). Build command `npm run build`, output `dist/`.
