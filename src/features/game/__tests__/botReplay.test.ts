import { describe, expect, it } from 'vitest';
import { runBotGame } from '../../../game/bot';
import { buildReplayFrames, frameScore } from '../botReplay';

// One real (small-sample) bot run shared across the cases — the frames
// must reconstruct exactly this game.
const DIFFICULTY = 'hard' as const;
const SEED = 11;
const run = runBotGame(DIFFICULTY, SEED, { samples: 2 });
const frames = buildReplayFrames(DIFFICULTY, SEED, run.actions);

describe('bot replay frames', () => {
  it('opens on the deal and ends on the bot final board', () => {
    expect(frames[0].caption).toBe('Opening deal');
    expect(frames[0].state.phase.kind).not.toBe('game-over');
    const lastFrame = frames[frames.length - 1];
    expect(lastFrame.state.phase.kind).toBe('game-over');
    expect(lastFrame.state.grid).toEqual(run.state.grid);
    // Final frame scores with the full end rules — the bot's reported
    // score exactly.
    expect(frameScore(lastFrame.state)).toBe(run.report.total);
  });

  it('every frame is a visible step with a caption', () => {
    // Silent bookkeeping actions (BEGIN, slide-source picks) fold away,
    // so there are strictly fewer frames than actions…
    expect(frames.length).toBeLessThan(run.actions.length + 1);
    // …but every placement survives: at least 25 board-changing frames.
    expect(frames.length).toBeGreaterThan(25);
    for (const f of frames) {
      expect(f.caption.length).toBeGreaterThan(0);
      for (const slot of f.changed) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(25);
      }
    }
    // The trace narrates real moves — placements name their card.
    expect(frames.some(f => /^Places /.test(f.caption))).toBe(true);
  });

  it('changed slots track the acted-on cells', () => {
    // Each frame's changed list matches the actual grid diff against
    // its predecessor.
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1].state.grid;
      const after = frames[i].state.grid;
      const diff: number[] = [];
      for (let s = 0; s < 25; s++) {
        if (before[s] !== after[s]) diff.push(s);
      }
      expect(frames[i].changed).toEqual(diff);
    }
  });

  it('is deterministic — rebuilding yields identical frames', () => {
    const again = buildReplayFrames(DIFFICULTY, SEED, run.actions);
    expect(again.length).toBe(frames.length);
    expect(again[again.length - 1].state.grid).toEqual(
      frames[frames.length - 1].state.grid
    );
    expect(again.map(f => f.caption)).toEqual(frames.map(f => f.caption));
  });
});
