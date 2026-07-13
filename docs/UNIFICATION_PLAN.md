# Mobile/Tablet Unification Program

## Execution status

The **Task list & status** section at the bottom of this document is
the live record — phases are checked off there, with their commit
SHAs, as they ship.

## Context

The desktop redesign left the app with two parallel generations: ten page routes
each have an old mobile implementation AND a redesigned `*Desk` component, forked
hard at `useIsDesktop` (≥1024px); tablets get the phone experience; three settings
keys diverge by construction. Mike wants one uniform game across phone / tablet /
desktop. Locked decisions (confirmed with Mike):

1. **Phone pages adopt the redesigns** — every route becomes one responsive
   component in the desktop visual language; the in-game screen stays
   phone-optimized on phones.
2. **Tablet tier (768–1023)**: desktop page designs + an adaptive game —
   phone-style column in portrait, two-column "desk-lite" in landscape.
3. **Docks**: one "Dock layout" concept; phone/tablet-portrait offer 3 layouts,
   desktop 2 (existing non-destructive compact mapping kept). No key changes.
4. **Touch**: tap equivalents for hover-exclusive info (menus, deck peek, ⓘ,
   histogram); pure hover polish (dimming/cross-highlight) stays pointer-only.
5. **Color-blind assist ports everywhere**: glyphs added to desk bonus surfaces
   (DesktopRails bonus cards, BonusDrawModal) per the existing
   `bonusCardCategory` contract; the Settings row returns at all tiers.

Presentation-only program: `src/game/**`, usePhaseUI, all persisted schemas
(settings stays `pokergrid:settings:v1`, no version bump), sync/RPCs, routes, and
the board measure pipeline's mechanism are untouched throughout.

## Architecture decisions

- **A. One responsive component per route.** Each `*Desk` becomes responsive to
  390px; the old mobile page is deleted and the Desk file is `git mv`'d to the
  canonical name in the same commit. Port checklist of mobile-only features that
  must survive: Home first-visit tutorial callout (upgrade DesktopHome's "New
  here?" strip: prominent CTA + dismiss on first visit); the daily twist-explainer
  rule becomes "intro shown → skip explainer" at all tiers (keep `twistSeen`
  bookkeeping); played dailies keep `DailyResultStatic` on phone AND tablet
  (view-only three-column stays desktop). Home's quick-link icons drop (unified
  header carries links). Sheets remain the full-content surface at every tier
  (already centered dialogs ≥640); page hover popovers do NOT become sheets.
- **B. Tier system.** New `src/app/useTier.ts`: `'phone' | 'tablet' | 'desktop'`
  (<768 / 768–1023 / ≥1024), jsdom-safe (no matchMedia → 'phone'). `useIsDesktop`
  becomes a shim during migration, deleted when call sites are gone. CSS tiers via
  marker-commented literals (`@media (min-width: 768px) { /* bp-tablet */ }`,
  `1024 /* bp-desktop */`), documented in tokens.css; 640 stays a legacy
  micro-breakpoint. Header: AppLayout swaps to DesktopNav at **768**; DesktopNav
  gains a condensed tablet variant (hide dateline, tighter gaps) and — in Phase 4 —
  a phone variant (wordmark + ◐ + scrolling link row) replacing the classic header.
- **C. Game families keyed on tier + orientation.** Column family (phone,
  tablet-portrait, and tutorial anywhere <1024): existing phone tree, measure
  pipeline kept (iOS Safari history — never CSS-size it) with a new ~600px tablet
  cap. Desk-lite (tablet-landscape): desktop tree minus the left rail
  (`minmax(0,1fr) 300px`), CSS-sized board, edge chips per setting. Surfaces follow
  the FAMILY: column → in-dock ♣ panel, full-screen ResultView, sweep on, measured
  board; desk → BonusDrawModal, DesktopResultDialog + Show result, NO_SWEEP, CSS
  board. GameScreen (1292 lines) splits into shared hooks + `GameColumnLayout` /
  `GameDeskLayout` with the family decision computed once (boardAreaRef's inline
  media checks re-keyed to the same value — lockstep guarantee). Rotation flips
  family live (same class as today's 1024 crossing; `useTargetsResult` already
  guards double commits).
- **D. Settings.** One responsive page (promote SettingsDesk): gains the
  Appearance 3-way row, `DisplayPreview`/`DockLayoutPreview` ports, tier-conditional
  dock options (3/3/2 with the existing mapping), ONE "Line totals" row binding the
  tier's key (phone → `lineRails`; tablet/desktop → `deskLineChips`; in-game the
  column family reads `lineRails`, desk family reads `deskLineChips`), and the
  color-blind row at all tiers. Both line keys kept — no migration, no persist bump.
- **E. Touch primitive.** `TapPopover` (src/design/primitives): on coarse pointer,
  tap toggles the same anchored popover CSS hover/focus shows; outside-pointerdown /
  Escape / route change / game commit dismiss; single-open registry; pointer-fine
  behavior untouched. Applied to: nav pill menus, Game Modes, deck peek, scoring ⓘ,
  leaderboard fly-out. Surfaces with an existing tap action (edge chips → 
  LineDetailSheet, bonus cards → detail sheet) keep it; their hover popovers stay
  pointer-only garnish.

## Phases (each ships independently; regression instrument = screenshot sweep
script at 390×844 / 820×1180 / 1024×768 / 1280×800 over all routes + seeded game,
added in Phase 1)

1. **Tier foundation + cleanup (zero visual change).** useTier + tests +
  `mockTier()` jsdom helper; useIsDesktop shim; delete dead CSS (the 8 vestigial
  1024 max-width blocks in forked *Page.module.css, GameScreen `.linesSlot`,
  ScoreBar's 1024 rule — LEAVE ResultView's 1024 grid, tutorial dependency);
  playwright `tablet-820` project; tier-aware spacing.spec assertions; sweep script.
  Bar: sweep bit-identical everywhere.
2. **Tablet adopts desktop pages + nav.** Header swap + `--desk-container` at 768;
  condensed nav variant + interim coarse-pointer tap-toggle on Game Modes; ten page
  forks flip to `useTier() !== 'phone'`; per-page `/* bp-tablet */` CSS passes
  (Home hero, Archive 340→300px or stack, Stats filters 4→2 col). Game/tutorial/
  played-daily untouched. Bar: 390 + 1280 byte-identical; 820 changes on pages only.
3. **Phone convergence, cluster A.** Rules, Challenges, Targets, Achievements,
  Free Play picker, Daily intro: responsive to 390, delete mobile versions, promote
  names, port checklist items, update unit tests per page. Bar: 390 changes only on
  the six routes; 820/1280 identical.
4. **Phone convergence, cluster B + header + Settings.** Home, Daily archive,
  Stats; unified phone header (delete classic AppLayout header); Settings per
  decision D incl. color-blind glyph port to DesktopRails + BonusDrawModal; delete
  useIsDesktop. Bar: 390 changes on those routes + header everywhere; 820/1280
  unchanged except settings rows + glyphs (screenshot assist on/off).
5. **Tablet game layout.** GameScreen family refactor; column tablet cap +
  refinements; desk-lite variant; surface rules; rails-key binding; rotation e2e
  (incl. Targets-Up no-double-commit); spacing.spec tablet assertions both
  orientations. Bar: seeded game at 390 + 1280 byte-identical; 820 changes.
6. **Touch tap-equivalents.** TapPopover primitive + tests; apply per table;
  replace Phase-2 shim; dismissal wired to game commits. Bar: zero layout diffs
  anywhere; touch e2e at 820 + touch-1280 (iPad-landscape is desktop tier!).

## Risks
jsdom pinned to phone tree (per-tier smoke renders + e2e projects); iOS board
sizing (pipeline mechanism untouched, lockstep family checks, `?layoutdebug=1`
kept, device pass after phases 2/5); production continuity (route-scoped phases,
delete-with-replacement, sweep as merge gate); silent feature loss (port checklist
in each PR); touch traps at desktop widths (Phase-2 shim now, primitive later);
rotation mid-game (remount keys per family, rotation e2e).

## Verification (every phase)
`npx tsc -b`, `npx eslint src e2e`, `npx vitest run`, `npm run build`, full
Playwright incl. tablet-820, screenshot sweep diffed against the phase's declared
"allowed to change" route list. Commit per phase on
`claude/display-settings-ui-layout-q1rccf` with the standard trailers; push after
review. Execution begins with Phase 1 upon approval.

---

## Task list & status (snapshot at commit time)

Program phases (this plan):

- [x] **Phase 1** — Tier foundation + dead-code cleanup (`useTier`, shim,
      `mockTier`, tablet-820 e2e project, sweep script). Shipped `477f499`.
- [x] **Phase 2** — Tablet adopts the desktop pages + condensed nav
      (classic-chrome flag keeps the in-game screen byte-identical; ten fork
      flips; Game Modes tap-toggle; per-page tablet CSS verified unnecessary).
      Shipped `b740a93` (checkpoint) + `04f6174` (complete).
- [x] **Phase 3** — Phone convergence, cluster A (Rules, Challenges, Targets,
      Achievements, Free Play picker, Daily intro are one responsive component
      each; old mobile pages deleted; *Desk files promoted to the canonical
      names; daily twist explainer replaced by "intro shown → skip explainer"
      with twistSeen bookkeeping kept). Shipped `9ed892c`.
- [x] **Phase 4** — Phone convergence, cluster B (Home, Daily Archive, Stats)
      + unified phone header (classic header now tablet-band classic-chrome
      only, dies in phase 5) + one responsive Settings page per decision D +
      color-blind glyphs on the desk game surfaces + `useIsDesktop` deleted.
      Shipped `6b1e988`.
- [x] **Phase 5** — Tablet game layout: column / desk-lite families keyed on
      tier + orientation (`useGameFamily`; desk-lite = desk tree minus the
      left rail; column tablet cap 600/630; classic header + classic-chrome
      flag deleted; rotation e2e proves single-commit across the family
      flip). Shipped `18e2769`.
- [x] **Phase 6** — Touch tap-equivalents: `TapPopover` primitive
      (behavior-only; single-open registry; outside-tap / Escape / route /
      game-commit dismissal) across Game Modes, the nav pill menus, deck
      peek, scoring ⓘ, and the leaderboard fly-out. Plus two user-directed
      revisions: desk-lite is the FULL three-column game grid with
      compressed rails (216/1fr/236), and the phone header adopts the desk
      center-nav (Game Modes dropdown + links) as its second row. Shipped
      `PENDING`.

**All six phases complete — the program is done.** Every page route and
the in-game screen render one responsive tree per surface; the tier
system (`useTier`) + game families (`useGameFamily`) are the only forks;
the classic header, `useIsDesktop`, and the classic-chrome flag are gone.

Related deferred items (outside this program):

- [ ] **Tutorial rework (desktop AND mobile)** — user-deferred; do not start
      without a direct go-ahead (see the coach panel from the
      desktop-redesign phase 6).
- [ ] **Settings menu audit at all three widths** — confirm the Settings page
      reads as desired at phone / tablet / desktop (accordion + ⓘ-sheet
      density at phone, the two-column band ≥1200, etc.).

Preceding shipped work (context — the desktop redesign and earlier feedback
rounds that this program builds on) is complete and on the same branch.
