import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../../design/primitives';
import type { Suit } from '../../../game/cards';
import type { Difficulty } from '../../../game/rules';
import type { Action } from '../../../game/state';
import { useSettingsStore } from '../../settings/settingsStore';
import { buildReplayFrames, frameScore } from '../botReplay';
import type { CaptionPart } from '../botReplay';
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
/** ms per move at ×1. */
const BASE_INTERVAL = 1900;
/** The game's bonus-hand cap — three chip slots stay reserved so the
 *  panel never resizes as the bot collects cards. */
const CHIP_SLOTS = 3;

/**
 * "Watch the bot's game" — a step-through player over the bot's action
 * trace. Opens paused on the deal; play or step through move by move.
 * The board highlights the acted-on cells; below it, the bot's bonus
 * hand stacks on the left while the up-next card, deck count, and the
 * move caption (card tokens tinted by suit) sit on the right. Stacked
 * above the BotScoreSheet as its own top-layer dialog.
 */
export function BotReplayDialog({
  open,
  onClose,
  difficulty,
  seed,
  actions,
}: BotReplayDialogProps) {
  // Frames are cheap to build (~80 pure reducer steps) and stable for
  // the life of this run, so build once — not per open, which would
  // let a stale frame paint before an on-open reset effect ran.
  const frames = useMemo(
    () => buildReplayFrames(difficulty, seed, actions),
    [difficulty, seed, actions]
  );
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  // 2-color decks tint ♦ like ♥ and ♠ like ♣ — the caption follows.
  const twoColorDeck = useSettingsStore(s => s.twoColorDeck);

  // Reset while CLOSED so every reopen paints move 0 on its first
  // frame — resetting on open flashed the previous position for one
  // paint before the effect ran.
  useEffect(() => {
    if (!open) {
      setIdx(0);
      setPlaying(false);
    }
  }, [open]);

  const last = frames.length - 1;
  const atEnd = idx >= last;

  useEffect(() => {
    if (!open || !playing) return;
    if (idx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(
      () => setIdx(i => Math.min(i + 1, frames.length - 1)),
      BASE_INTERVAL / speed
    );
    return () => window.clearTimeout(t);
  }, [open, playing, idx, speed, frames]);

  const frame = frames[idx] ?? null;
  const score = useMemo(
    () => (frame ? frameScore(frame.state) : 0),
    [frame]
  );

  const suitClass = (suit: Suit): string =>
    twoColorDeck
      ? suit === 'H' || suit === 'D'
        ? styles.suitH
        : styles.suitS
      : {
          H: styles.suitH,
          S: styles.suitS,
          C: styles.suitC,
          D: styles.suitD,
        }[suit];

  const partSpan = (p: CaptionPart, i: number) => (
    <span
      key={i}
      className={
        p.suit ? suitClass(p.suit) : p.joker ? styles.suitJoker : undefined
      }
    >
      {p.text}
    </span>
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
          <div className={styles.infoRow}>
            <div className={styles.chipCol} aria-label="Bot's bonus cards">
              {Array.from({ length: CHIP_SLOTS }, (_, i) => {
                const c = frame.state.bonusCards[i];
                return c ? (
                  <span
                    key={c.id}
                    className={`${styles.chip} ${
                      frame.newChip === i ? styles.chipNew : ''
                    }`}
                    title={c.name}
                  >
                    {c.title} {c.mult.replace(/\s*\(each\)/, '')}
                  </span>
                ) : (
                  <span key={`empty-${i}`} className={styles.chipEmpty}>
                    empty
                  </span>
                );
              })}
            </div>
            <div className={styles.rightCol}>
              <div className={styles.nextRow}>
                <span className={styles.nextCard} aria-label="Up next">
                  {frame.state.drawn &&
                  frame.state.phase.kind !== 'game-over' ? (
                    <CardFace card={frame.state.drawn} />
                  ) : (
                    <span className={styles.nextNone} aria-hidden="true">
                      —
                    </span>
                  )}
                </span>
                <span className={styles.deckCount}>
                  Deck {frame.state.deck.length}
                </span>
              </div>
              <p className={styles.caption} role="status">
                {frame.parts.map(partSpan)}
              </p>
            </div>
          </div>
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
