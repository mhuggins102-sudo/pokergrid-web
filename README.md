# PokerGrid (web)

Ground-up web rebuild of [PokerGrid](https://pokergrid.pages.dev) — a 5×5
poker-solitaire daily puzzle — on Vite + React + TypeScript with a clean
editorial ("Morning Paper") design system. The original Expo/react-native-web
site keeps running; both sites share the same Supabase backend, so daily
leaderboards stay unified.

The full assessment and phased plan live in the original repo at
`docs/REDESIGN_PLAN.md`.

## Status

**Phase 1 — scaffold + core** ✓

- Vite 7 + React 19 + TS strict, react-router v7 (library mode), every
  screen deep-linkable from day one
- `src/game/` — the pure game core ported **verbatim** from the original
  repo (reducer-driven state machine, deterministic daily seeding,
  Shapley-value bonus attribution) along with 21 of its test files
- `src/design/` — "Morning Paper" tokens (`tokens.css` + typed `tokens.ts`
  mirror) and primitives: Button, Dialog (native `<dialog>`), Sheet, Tabs,
  Toast — see `/design` for the token gallery
- Vitest (node env for game logic, jsdom + Testing Library for UI), CI

**Phase 2 — playable game** ✓

- Free play at all four difficulties (`/play?difficulty=easy|medium|hard|extreme`,
  optional `&seed=` for a deterministic run)
- `GameSessionProvider` owns the ported reducer; `usePhaseUI` is the single
  place that switches on `state.phase`
- Board components (GridBoard / CardFace / NextCardWell / ScoreBar /
  LinesPanel / BonusCardStrip) + ♥ swap, ♠ slide, ♦ destroy targeting and
  the ♣ bonus draw/replace dialog
- Card travel via motion layout (FLIP) animations; `prefers-reduced-motion`
  respected
- Result view: verdict, full score math (incomplete-line penalty, grid
  multipliers) and per-bonus-card Shapley attribution
- Responsive: single column < 1024px, three-panel editorial spread ≥ 1024px
- Playwright E2E: deterministic seeded game to completion at 390px and
  1280px (`npx playwright test`)

**Phase 4 — progression** ✓ *(Phase 3, daily + leaderboard, deferred by request)*

- zustand-persisted stores using the original app's storage keys and
  save formats (stats with legacy migrations, Targets-Up resume save,
  settings)
- Stats dashboard (per-difficulty roll-ups, tier histogram, recent
  runs), Achievements catalog with earned state, Rules, Settings (with
  full progress reset)
- Challenges: all seven twisted rule sets playable at
  `/challenges/:id` on the Hard ruleset with sequential unlocks —
  including the Three Tricks one-time specials (all twelve targeting
  flows wired through usePhaseUI) and Mixed Bag's categorized slots
- Targets Up ladder at `/targets` — difficulty/target per level, S/SS
  reward picks (supercharge a board card, power up a bonus card),
  carry-over into the next level's decks, loss ends the run
- Result screen records mode-aware: free-play runs (with Shapley
  attribution), challenge completion, Targets-Up high-water mark, and
  achievement evaluation

Next: Phase 3 (daily + leaderboard) → Phase 5 (polish + launch).

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
