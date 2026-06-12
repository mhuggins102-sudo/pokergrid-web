import { useEffect, useRef } from 'react';
import { GameState } from '../../game/state';
import { SFX, sfxChime, sfxForHistoryEntry, sfxLose, sfxWin } from '../../lib/sfx';
import { useSettingsStore } from '../settings/settingsStore';

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

  useEffect(() => {
    const cur = { historyLen: state.history.length, phase: state.phase.kind };
    const last = prev.current;
    prev.current = cur;
    if (!sounds) return;
    if (last === null) {
      // Session mount: the engine seated the opening card(s) before the
      // first paint. Give that deal its placement tick, timed to the
      // board's deal-in animation.
      if (state.past.length === 0 && state.grid.some(c => c !== null)) {
        window.setTimeout(() => SFX.place(), 150);
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
};
