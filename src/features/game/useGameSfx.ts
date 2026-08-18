import { useEffect, useRef } from 'react';
import { GameState } from '../../game/state';
import {
  SFX,
  sfxChime,
  sfxDeal,
  sfxForHistoryEntry,
  sfxLose,
  sfxWin,
} from '../../lib/sfx';
import { useSettingsStore } from '../settings/settingsStore';
import {
  DUAL_OPENING_STAGE_MS,
  OPENING_RAPID_MS,
  STAGE_MS,
} from './useAutoPlaceFlights';
import { KEEP_REVEAL_DELAY, REVEAL_STAGGER } from './components/HandWell';

/**
 * State-transition sounds, derived from the reducer's history log —
 * every committed action (placement, all four suit perks, every green
 * one-time action card) writes a stable entry, so each gets its exact
 * voice. The ♣ draw OPENING chimes off the phase change (it isn't
 * logged until resolved), and game over plays win/lose. Gated on the
 * sounds setting; the reducer itself stays silent.
 */
export const useGameSfx = (
  state: GameState,
  finalScore: number,
  /** View-only rehydrated sessions (revisiting a completed daily) must
   *  be silent — the ~25 rehydrated placements would otherwise replay
   *  their ticks, and the win/lose sting + joker chime with them. */
  muted = false
): void => {
  const sounds = useSettingsStore(s => s.sounds);
  const prev = useRef<{
    historyLen: number;
    phase: string;
    /** Five Draw draw-place: staged card count; -1 in any other phase. */
    staged: number;
  } | null>(null);
  // Timers for staggered ticks (the opening deal's placements, Five
  // Draw's per-card dealing flicks), cleared on unmount so a long
  // Gridlock deal or a mid-reveal exit doesn't keep firing after you
  // leave.
  const openingTimers = useRef<number[]>([]);

  useEffect(() => {
    const cur = {
      historyLen: state.history.length,
      phase: state.phase.kind,
      staged:
        state.phase.kind === 'draw-place'
          ? state.phase.placed.filter(p => p !== null).length
          : -1,
    };
    const last = prev.current;
    prev.current = cur;
    if (!sounds || muted) return;

    // Five Draw: one papery flick per card revealed into the dock,
    // timed to the HandWell's stagger (+60ms so each lands mid-flip).
    // Reduced motion shows all cards at once — a single flick stands
    // in for the batch.
    const dealTicks = (count: number, offsetMs = 0) => {
      if (count <= 0) return;
      const reduced =
        useSettingsStore.getState().reduceMotion ||
        (typeof window !== 'undefined' &&
          !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (reduced) {
        sfxDeal(0);
        return;
      }
      for (let k = 0; k < count; k++) {
        openingTimers.current.push(
          window.setTimeout(
            () => sfxDeal(k),
            offsetMs + k * REVEAL_STAGGER * 1000 + 60
          )
        );
      }
    };

    if (last === null) {
      // Session mount: the engine seated the opening card(s) before the
      // first paint. Give that deal its placement tick(s), timed to the
      // staged flight cadence in useAutoPlaceFlights.
      if (state.past.length === 0 && state.grid.some(c => c !== null)) {
        const seats = state.grid.filter(c => c !== null).length;
        const reduced =
          typeof window !== 'undefined' &&
          !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (seats > 3 && !reduced) {
          // Gridlock: cards fly in one at a time (OPENING_RAPID_MS apart),
          // so tick a placement for each as it lands.
          for (let j = 1; j <= seats; j++) {
            openingTimers.current.push(
              window.setTimeout(() => SFX.place(), j * OPENING_RAPID_MS)
            );
          }
        } else {
          // Normal opening: a single card seats from the well. Double
          // Duty's two-way opener (openingCard set) poses longer, so its
          // tick waits for the extended stage to release.
          const stageMs =
            state.openingCard !== null ? DUAL_OPENING_STAGE_MS : STAGE_MS;
          openingTimers.current.push(
            window.setTimeout(() => SFX.place(), stageMs)
          );
        }
      }
      // Five Draw session mount: the first hand is already dealt and
      // the HandWell stagger-reveals it — give each card its flick.
      if (
        state.drawPoker &&
        (state.phase.kind === 'draw-select' ||
          state.phase.kind === 'draw-place')
      ) {
        dealTicks(state.phase.hand.length);
      }
      return;
    }

    // One voice per commit: play the sound of the most recent new
    // history entry (an UNDO shrinks the log — skip those). A joker
    // auto-place rides along with whatever move triggered the draw, so
    // its flourish LAYERS on the move's own sound instead of replacing
    // it (the flourish is internally delayed to land with the joker's
    // pop-in animation).
    if (cur.historyLen > last.historyLen && cur.phase !== 'game-over') {
      const fresh = state.history.slice(last.historyLen);
      if (fresh.some(e => e.startsWith('Joker auto-placed'))) {
        SFX.joker();
      }
      for (let i = fresh.length - 1; i >= 0; i--) {
        if (fresh[i].startsWith('Joker auto-placed')) continue;
        const name = sfxForHistoryEntry(fresh[i]);
        if (name) {
          SFX[name]();
          break;
        }
      }

      // Five Draw's dealing flicks are the mode's voice: a redraw
      // ('Draw N') reveals N replacements, and a locked row ('Place
      // hand', deliberately voiceless itself) deals the next hand —
      // however many cards the deck still had (a dry deck deals the
      // hand straight into draw-place, so both kinds count). The
      // final row lands on game-over, which neither branch matches.
      if (state.drawPoker) {
        const drawEntry = fresh.find(e => /^Draw \d/.test(e));
        if (drawEntry) dealTicks(parseInt(drawEntry.slice(5), 10));
        // A deal follows the row commit ('Place hand', when no bonus
        // offer intervenes) or the offer's resolution ('Bonus kept' /
        // 'Bonus passed') — the phase guard separates both from the
        // offer step and from game over. A KEPT offer chimes, so its
        // deal flicks wait a beat (the HandWell delays the visual
        // reveal by the same amount).
        if (
          fresh.some(
            e =>
              e.startsWith('Place hand') ||
              e.startsWith('Bonus kept') ||
              e.startsWith('Bonus passed')
          ) &&
          (state.phase.kind === 'draw-select' ||
            state.phase.kind === 'draw-place')
        ) {
          dealTicks(
            state.phase.hand.length,
            fresh.some(e => e.startsWith('Bonus kept'))
              ? KEEP_REVEAL_DELAY * 1000
              : 0
          );
        }
      }
    }

    // Five Draw staging is phase-only (STAGE/UNSTAGE write no history
    // entry): voice it off the staged-count delta. Seating a card on
    // the grid ticks the standard place, exactly like placing a card
    // in any other mode; taking one back plays the Rewind riffle. A
    // row switch carries the count unchanged — silent — and entering
    // or leaving draw-place skips the compare (one side is -1). The
    // history guard keeps commits out: a dry-deck 'Place hand' can
    // land draw-place → draw-place with a fresh 0-staged hand, which
    // is a deal, not an unstage.
    if (
      cur.historyLen === last.historyLen &&
      last.staged >= 0 &&
      cur.staged >= 0
    ) {
      if (cur.staged > last.staged) SFX.place();
      else if (cur.staged < last.staged) SFX.riffle();
    }
    // Back (draw-place → the hold state) with cards staged: they all
    // return to the dock at once — one riffle for the batch. History
    // unchanged separates this from a committed row (which logs).
    if (
      cur.historyLen === last.historyLen &&
      last.phase === 'draw-place' &&
      cur.phase === 'draw-select' &&
      last.staged > 0
    ) {
      SFX.riffle();
    }

    if (
      cur.phase === 'bonus-card-resolving' &&
      last.phase !== 'bonus-card-resolving'
    ) {
      sfxChime();
    }
    // Five Draw's between-hands offer arriving — same chime as a ♣
    // draw opening.
    if (cur.phase === 'draw-bonus' && last.phase !== 'draw-bonus') {
      sfxChime();
    }
    if (cur.phase === 'game-over' && last.phase !== 'game-over') {
      if (finalScore >= state.target) sfxWin();
      else sfxLose();
    }
  }, [state, sounds, finalScore, muted]);

  // Cancel any pending opening-deal ticks on unmount (e.g. leaving mid
  // Gridlock deal) so they don't fire after the screen is gone.
  useEffect(() => {
    const timers = openingTimers.current;
    return () => timers.forEach(id => window.clearTimeout(id));
  }, []);
};
