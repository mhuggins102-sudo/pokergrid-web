import { useEffect, useRef, useState } from 'react';
import { Card, isJoker } from '../../game/cards';
import { Grid, SPIRAL_POSITION } from '../../game/grid';
import { GameState } from '../../game/state';
import { cardLayoutId } from './components/CardFace';

export interface AutoFlight {
  slot: number;
  card: Card;
  /** Shared motion layoutId: the well renders it, then the grid cell
   *  takes it over — the same FLIP handoff a manual Place uses. */
  layoutId: string;
}

export interface AutoPlaceFlights {
  /** Card currently staged face-up in the well, about to fly. */
  flight: AutoFlight | null;
  /** Grid slots to render empty while their card is queued/in the well. */
  hiddenSlots: ReadonlySet<number>;
  /** Pre-scattered boards (Gridlock) skip the flight relay; these slots
   *  get the quick CSS deal-in cascade instead. */
  cssDeal: ReadonlySet<number>;
}

const flightLayoutId = (card: Card, slot: number): string =>
  cardLayoutId(card) ?? `joker-slot-${slot}`;

const jokerCount = (g: Grid): number =>
  g.reduce((n, c) => n + (c && isJoker(c) ? 1 : 0), 0);

/** How long a card poses in the well before flying to its cell. */
const STAGE_MS = 350;

const EMPTY: ReadonlySet<number> = new Set();

/**
 * Presentation staging for cards the ENGINE places (the opening deal
 * at session start, and jokers auto-placed while drawing): instead of
 * materializing on the grid, each is held back, shown as the face-up
 * card in the well for a beat, then released — and the shared-layoutId
 * FLIP animates the exact well→cell travel a manual Place gets.
 *
 * Pure presentation: the reducer state is never touched, so rapid
 * play (or UNDO) during a flight is safe — stale slots are pruned
 * against the real grid every render.
 */
export function useAutoPlaceFlights(state: GameState): AutoPlaceFlights {
  const queueRef = useRef<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);

  // Session mount: stage the engine's opening seats in spiral order.
  // A pre-scattered board (Gridlock: 16 cards) would make a tedious
  // relay — those keep the CSS cascade.
  const cssDealRef = useRef<Set<number> | null>(null);
  if (cssDealRef.current === null) {
    const seats = state.grid.flatMap((c, i) => (c ? [i] : []));
    if (seats.length <= 3) {
      queueRef.current = seats.sort(
        (a, b) => SPIRAL_POSITION[a] - SPIRAL_POSITION[b]
      );
      cssDealRef.current = new Set();
    } else {
      cssDealRef.current = new Set(seats);
    }
  }
  const cssDeal = cssDealRef.current;
  useEffect(() => {
    if (cssDeal.size === 0) return;
    const t = window.setTimeout(() => cssDeal.clear(), 2500);
    return () => window.clearTimeout(t);
  }, [cssDeal]);

  // Mid-game joker auto-places: the joker count went up — stage every
  // newly jokered slot in the same render, so it never flashes on the
  // grid before its flight.
  const prevGridRef = useRef<Grid | null>(null);
  const prevGrid = prevGridRef.current;
  useEffect(() => {
    prevGridRef.current = state.grid;
  });
  if (prevGrid !== null && jokerCount(state.grid) > jokerCount(prevGrid)) {
    state.grid.forEach((c, i) => {
      const was = prevGrid[i];
      if (
        c &&
        isJoker(c) &&
        !(was && isJoker(was)) &&
        !queueRef.current.includes(i)
      ) {
        queueRef.current.push(i);
      }
    });
  }

  // Prune anything no longer on the real grid (UNDO, destroys).
  queueRef.current = queueRef.current.filter(i => state.grid[i] !== null);
  const cur =
    current !== null && queueRef.current.includes(current) ? current : null;

  // Advance: stage the next queued card in the well. Re-runs on mount,
  // after each release (cur → null), and on every commit (state) —
  // which covers every moment the queue can gain a head.
  useEffect(() => {
    if (cur !== null || queueRef.current.length === 0) return;
    setCurrent(queueRef.current[0]);
  }, [cur, state]);

  // …and release it after a beat — clearing it from the queue lands
  // the card on the grid, which is what triggers the FLIP travel.
  useEffect(() => {
    if (cur === null) return;
    const t = window.setTimeout(() => {
      queueRef.current = queueRef.current.filter(s => s !== cur);
      setCurrent(null);
    }, STAGE_MS);
    return () => window.clearTimeout(t);
  }, [cur]);

  const card = cur !== null ? state.grid[cur] : null;
  return {
    flight:
      cur !== null && card
        ? { slot: cur, card, layoutId: flightLayoutId(card, cur) }
        : null,
    hiddenSlots:
      queueRef.current.length > 0 ? new Set(queueRef.current) : EMPTY,
    cssDeal,
  };
}
