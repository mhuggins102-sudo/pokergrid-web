import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../../design/primitives';
import type { Difficulty } from '../../../game/rules';
import type { Action } from '../../../game/state';
import { buildReplayFrames, frameScore } from '../botReplay';
import { CardFace } from './CardFace';
import styles from './BotReplayDialog.module.css';

export interface BotReplayDialogProps {
  open: boolean;
  onClose: () => void;
  difficulty: Difficulty;
  seed: number;
  /** The bot worker's action trace for this exact deal. */
  actions: ReadonlyArray<Action>;
}

const SPEEDS = [1, 2, 4] as const;

/**
 * "Watch the bot's game" — a step-through player over the bot's action
 * trace. Auto-plays from the opening deal; the board updates move by
 * move with the acted-on cells highlighted, the move caption underneath,
 * and transport controls (restart / step / play-pause / speed).
 * Stacked above the BotScoreSheet as its own top-layer dialog.
 */
export function BotReplayDialog({
  open,
  onClose,
  difficulty,
  seed,
  actions,
}: BotReplayDialogProps) {
  // Frames are cheap to rebuild (~80 pure reducer steps) and only
  // needed while open.
  const frames = useMemo(
    () => (open ? buildReplayFrames(difficulty, seed, actions) : null),
    [open, difficulty, seed, actions]
  );
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  // Every open starts from the deal, rolling.
  useEffect(() => {
    if (open) {
      setIdx(0);
      setPlaying(true);
    }
  }, [open]);

  const last = frames ? frames.length - 1 : 0;
  const atEnd = idx >= last;

  useEffect(() => {
    if (!open || !playing || frames === null) return;
    if (idx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(
      () => setIdx(i => Math.min(i + 1, frames.length - 1)),
      950 / speed
    );
    return () => window.clearTimeout(t);
  }, [open, playing, idx, speed, frames]);

  const frame = frames?.[idx] ?? null;
  const score = useMemo(
    () => (frame ? frameScore(frame.state) : 0),
    [frame]
  );

  const togglePlay = () => {
    if (atEnd) {
      setIdx(0);
      setPlaying(true);
    } else {
      setPlaying(p => !p);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="🤖 Bot replay"
      className={styles.dialog}
    >
      {frame && (
        <div className={styles.wrap}>
          <div className={styles.readout}>
            <span className={styles.move}>
              Move {idx} / {last}
            </span>
            <span className={styles.score}>
              {score}
              <span className={styles.target}> / {frame.state.target}</span>
            </span>
          </div>
          <div
            className={styles.board}
            role="img"
            aria-label={`Bot's board after move ${idx}`}
          >
            {frame.state.grid.map((card, i) => (
              <div
                key={i}
                className={`${styles.cell} ${
                  frame.changed.includes(i) ? styles.cellChanged : ''
                }`}
              >
                {card && <CardFace card={card} />}
              </div>
            ))}
          </div>
          <div className={styles.underRow}>
            <p className={styles.caption} role="status">
              {frame.caption}
            </p>
            {frame.state.drawn && frame.state.phase.kind !== 'game-over' && (
              <span className={styles.next}>
                <span className={styles.nextLabel}>Up next</span>
                <span className={styles.nextCard}>
                  <CardFace card={frame.state.drawn} />
                </span>
              </span>
            )}
          </div>
          {frame.state.bonusCards.length > 0 && (
            <div className={styles.chips}>
              {frame.state.bonusCards.map(c => (
                <span key={c.id} className={styles.chip}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => {
                setPlaying(false);
                setIdx(0);
              }}
              aria-label="Restart replay"
            >
              ⏮
            </button>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => {
                setPlaying(false);
                setIdx(i => Math.max(0, i - 1));
              }}
              disabled={idx === 0}
              aria-label="Step back"
            >
              ◀
            </button>
            <button
              type="button"
              className={`${styles.ctrlBtn} ${styles.playBtn}`}
              onClick={togglePlay}
              aria-label={
                atEnd ? 'Replay from start' : playing ? 'Pause' : 'Play'
              }
            >
              {atEnd ? '↻' : playing ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={() => {
                setPlaying(false);
                setIdx(i => Math.min(last, i + 1));
              }}
              disabled={atEnd}
              aria-label="Step forward"
            >
              ▶
            </button>
            <button
              type="button"
              className={`${styles.ctrlBtn} ${styles.speedBtn}`}
              onClick={() =>
                setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])
              }
              aria-label={`Playback speed ${speed}x — change`}
            >
              ×{speed}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
