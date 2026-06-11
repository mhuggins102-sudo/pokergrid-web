import { useEffect, useRef } from 'react';
import { GameState } from '../../game/state';
import { sfxChime, sfxLose, sfxPlace, sfxWin } from '../../lib/sfx';
import { useSettingsStore } from '../settings/settingsStore';

const filledCount = (s: GameState): number =>
  s.grid.reduce((n, c) => n + (c !== null ? 1 : 0), 0);

/**
 * State-transition sounds: tick when cards land on the board, a chime
 * when the ♣ draw opens, win/lose at game over. Gated on the sounds
 * setting; derived purely from state diffs so the reducer stays silent.
 */
export const useGameSfx = (state: GameState, finalScore: number): void => {
  const sounds = useSettingsStore(s => s.sounds);
  const prev = useRef<{ filled: number; phase: string } | null>(null);

  useEffect(() => {
    const cur = { filled: filledCount(state), phase: state.phase.kind };
    const last = prev.current;
    prev.current = cur;
    if (!sounds || last === null) return;

    if (cur.filled > last.filled && cur.phase !== 'game-over') sfxPlace();
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
