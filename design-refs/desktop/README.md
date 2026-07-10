# Desktop redesign mockups (Claude Design)

Reference-only — NOT shipped code. Downloaded from the user's Claude
Design project ("PokerGrid v2 desktop", project 127340fb-4f35-45db-aacd-3ea26ac0d2ea)
on 2026-07-10. These pages are the authoritative visual/layout spec for
the desktop (≥1024px) redesign; the game engine and all behavior remain
the repo's `src/game` reducer.

- `*.dc.html` — one page per screen (Claude Design "dc" format: an
  `<x-dc>` template + `data-dc-script` logic class, executed by
  `support.js`, which requires `window.React`/`ReactDOM` pre-injected).
- `pgData.js` / `pgEngine.js` — game data + simplified engine the
  mockups run on (both were ported FROM this repo; the repo stays the
  source of truth).
- `support.js` — the Claude Design runtime (generated; do not edit).

Missing screens (to be designed by pattern): Targets Up, Tutorial.
