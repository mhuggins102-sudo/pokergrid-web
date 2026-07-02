import { useEffect, useRef } from 'react';
import { GameState } from '../../game/state';
import { SFX, sfxChime, sfxForHistoryEntry, sfxLose, sfxWin } from '../../lib/sfx';
import { useSettingsStore } from '../settings/settingsStore';
import {
  DUAL_OPENING_STAGE_MS,
  OPENING_RAPID_MS,
  STAGE_MS,
} from './useAutoPlaceFlights';

/**
 * State-transition sounds, derived from the reducer's history log —
 * every committed action (placement, all four suit perks, every green
 * one-time action card) writes a stable entry, so each gets its exact
 * voice. The ♣ draw OPENING chimes off the phase change (it isn't
 * logged until resolved), and game over plays win/lose. Gated on the
 * sounds setting; the reducer itself stays silent.
 */
export const useGameSfx = (state: GameState, finalScore: number): void => {
  const sounds = useSettingsStore(s => s.sounds);
  const prev = useRef<{ historyLen: number; phase: string } | null>(null);
  // Timers for the opening deal's placement ticks, cleared on unmount so
  // a long Gridlock deal doesn't keep firing after you leave.
  const openingTimers = useRef<number[]>([]);

  useEffect(() => {
    const cur = { historyLen: state.history.length, phase: state.phase.kind };
    const last = prev.current;
    prev.current = cur;
    if (!sounds) return;
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
    }

    if (
      cur.phase === 'bonus-card-resolving' &&
      last.phase !== 'bonus-card-resolving'
    ) {
      sfxChime();
    }
    if (cur.phase === 'game-over' && last.phase !== 'game-over') {
      if (finalScore >= state.target) sfxWin();
      else sfxLose();
    }
  }, [state, sounds, finalScore]);

  // Cancel any pending opening-deal ticks on unmount (e.g. leaving mid
  // Gridlock deal) so they don't fire after the screen is gone.
  useEffect(() => {
    const timers = openingTimers.current;
    return () => timers.forEach(id => window.clearTimeout(id));
  }, []);
};
