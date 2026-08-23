import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Card, Rank, Suit } from '../../game/cards';
import { SPIRAL_POSITION } from '../../game/grid';
import { CardFace } from '../game/components/CardFace';
import { HandsIcon, ScoringIcon } from '../game/components/icons';
import { prefersReducedMotion } from '../game/useAnimatedNumber';
import { useSettingsStore } from '../settings/settingsStore';
import styles from './IntroTour.module.css';

/*
 * The intro tour's six pages: title + copy + a small looping demo.
 * Demos that need scripted or random sequencing (the goal sweep, the
 * spiral fill) drive a class flip from a JS timer; the rest are pure
 * CSS keyframe loops. Both respect reduced motion: the tour card's
 * `.still` class freezes the CSS loops, and the JS demos skip their
 * timers and render a legible static frame instead. Copy adapts the
 * Rules page's "How PokerGrid works" steps.
 */

const C = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });
const JOKER: Card = { kind: 'joker' };

// The same reduced-motion condition the tour card uses for `.still` —
// the JS-driven demos read it themselves to skip their timers (the
// test env forces it, keeping component tests timer-free).
const useStill = (): boolean =>
  useSettingsStore(s => s.reduceMotion) || prefersReducedMotion();

// A 5×5 of tiny inert cells, classed per index.
function MiniGrid({ cellClass }: { cellClass: (idx: number) => string }) {
  return (
    <div className={styles.miniGrid} aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <span key={i} className={`${styles.miniCell} ${cellClass(i)}`} />
      ))}
    </div>
  );
}

function GoalDemo() {
  const still = useStill();
  // The lit line: 0-4 = rows, 5-9 = columns. Opens on the center row,
  // then hops to a random DIFFERENT line — rows and columns both
  // score, shown rather than said.
  const [line, setLine] = useState(2);
  useEffect(() => {
    if (still) return;
    let cur = 2;
    const id = window.setInterval(() => {
      let next = cur;
      while (next === cur) next = Math.floor(Math.random() * 10);
      cur = next;
      setLine(next);
    }, 1700);
    return () => window.clearInterval(id);
  }, [still]);
  const inLine = (i: number) =>
    line < 5 ? Math.floor(i / 5) === line : i % 5 === line - 5;
  // Static frame: center row AND column lit — the diagram version.
  const inCross = (i: number) => Math.floor(i / 5) === 2 || i % 5 === 2;
  return (
    <MiniGrid
      cellClass={i =>
        (still ? inCross(i) : inLine(i)) ? styles.lineOn : ''
      }
    />
  );
}

function SpiralDemo() {
  const still = useStill();
  // Cards seat one at a time in spiral order; the full board holds a
  // beat, clears in one clean reset, then the deal loops.
  const [seated, setSeated] = useState(0);
  useEffect(() => {
    if (still) return;
    let n = 0;
    let id = 0;
    const tick = () => {
      n = n >= 25 ? 0 : n + 1;
      setSeated(n);
      const wait = n === 25 ? 1600 : n === 0 ? 600 : 170;
      id = window.setTimeout(tick, wait);
    };
    id = window.setTimeout(tick, 500);
    return () => window.clearTimeout(id);
  }, [still]);
  return (
    <MiniGrid
      cellClass={i => {
        if (still) return styles.seatOn;
        const p = SPIRAL_POSITION[i];
        return `${p <= seated ? styles.seatOn : ''} ${
          p === seated ? styles.seatNew : ''
        }`;
      }}
    />
  );
}

const PERKS: Array<[string, string, string]> = [
  ['♥', 'Swap', '--suit-h'],
  ['♠', 'Slide', '--suit-s'],
  ['♦', 'Destroy', '--suit-d'],
  ['♣', 'Bonus', '--suit-c'],
];

// The perk demo board: nine cards seated in the center 3×3 (the
// spiral's first nine slots), keyed by grid index.
const MINI_BOARD: Record<number, [Rank, Suit]> = {
  6: ['7', 'S'],
  7: ['K', 'H'],
  8: ['2', 'D'],
  11: ['J', 'C'],
  12: ['A', 'S'],
  13: ['9', 'H'],
  16: ['4', 'D'],
  17: ['Q', 'C'],
  18: ['8', 'S'],
};
const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };

// Each perk acts on its own cells in one window of the shared 6s
// cycle, synced to its chip's highlight: ♥ swaps K♥↔2♦, ♠ slides the
// bottom row into the empty cell beside it, ♦ destroys the 9♥,
// ♣ pulses the J♣ gold as a bonus card pops in.
const PERK_CELL: Record<number, string> = {
  7: styles.swapRight,
  8: styles.swapLeft,
  16: styles.slideCell,
  17: styles.slideCell,
  18: styles.slideCell,
  13: styles.destroyCell,
  11: styles.bonusCell,
};

function PerksDemo() {
  return (
    <div className={styles.perksDemo} aria-hidden="true">
      <div className={styles.perkRow}>
        {PERKS.map(([glyph, label, tone], i) => (
          <span
            key={label}
            className={styles.perkChip}
            style={
              { '--tone': `var(${tone})`, '--d': `${i * 1.5}s` } as CSSProperties
            }
          >
            <span className={styles.perkGlyph}>{glyph}</span>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.perkBoard}>
        <div className={styles.miniGrid}>
          {Array.from({ length: 25 }, (_, i) => {
            const card = MINI_BOARD[i];
            if (!card) return <span key={i} className={styles.miniCell} />;
            const [rank, suit] = card;
            return (
              <span
                key={i}
                className={`${styles.miniCell} ${styles.mc} ${
                  PERK_CELL[i] ?? ''
                }`}
                style={
                  {
                    '--tone': `var(--suit-${suit.toLowerCase()})`,
                  } as CSSProperties
                }
              >
                {rank}
                {SUIT_GLYPH[suit]}
              </span>
            );
          })}
        </div>
        <span className={styles.bonusPop}>+ bonus</span>
      </div>
    </div>
  );
}

const BONUS_CHIPS: Array<[string, string, string]> = [
  ['Gold', 'In-game ×', '--warn'],
  ['Purple', 'End-game ×', '--joker'],
  ['Green', 'One-time', '--success'],
];

function BonusDemo() {
  return (
    <div className={styles.bonusDemo} aria-hidden="true">
      {BONUS_CHIPS.map(([name, note, tone], i) => (
        <span
          key={name}
          className={styles.bonusChip}
          style={{ '--tone': `var(${tone})`, '--d': `${i * 0.9}s` } as CSSProperties}
        >
          <b>{name}</b>
          <span>{note}</span>
        </span>
      ))}
    </div>
  );
}

// Rotating example hands (values from HAND_BASE_VALUE); the straight
// shows a joker standing in as the missing 7.
const HAND_LOOP: Array<{ label: string; cards: Card[] }> = [
  {
    label: 'Flush +40',
    cards: [C('9', 'H'), C('J', 'H'), C('3', 'H'), C('Q', 'H'), C('6', 'H')],
  },
  {
    label: 'Straight +30',
    cards: [C('5', 'D'), C('6', 'S'), JOKER, C('8', 'H'), C('9', 'C')],
  },
  {
    label: 'Full house +50',
    cards: [C('K', 'S'), C('K', 'H'), C('K', 'D'), C('9', 'C'), C('9', 'S')],
  },
];

function ScoringDemo() {
  // Three stacked layers crossfade on offsets of one shared cycle;
  // the reduced-motion frame is the lead layer (base opacity).
  return (
    <div className={styles.handCycle} aria-hidden="true">
      {HAND_LOOP.map(({ label, cards }, i) => (
        <div
          key={label}
          className={`${styles.handLayer} ${i === 0 ? styles.handLead : ''}`}
          style={{ '--d': `${i * 3.5}s` } as CSSProperties}
        >
          <div className={styles.flushCards}>
            {cards.map((card, j) => (
              <span key={j} className={styles.flushCard}>
                <CardFace card={card} />
              </span>
            ))}
          </div>
          <span className={styles.flushScore}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function ExploreDemo() {
  // Miniatures of the real in-game pills (GameScreen's navPill,
  // twistPill, and the Hands/Scoring row buttons with their icons) —
  // same casing, tones, and chrome, so the tour teaches exactly what
  // the player will see.
  return (
    <div className={styles.pillsDemo} aria-hidden="true">
      <div className={styles.pillRow}>
        <span
          className={styles.demoNavPill}
          style={{ '--d': '0s' } as CSSProperties}
        >
          <span className={styles.demoNavDot} />
          <span className={styles.demoNavDiff}>easy</span>
          <span className={styles.demoNavScore}>
            0<span className={styles.demoNavTarget}>/ 400</span>
          </span>
        </span>
        <span
          className={styles.demoTwistPill}
          style={{ '--d': '1s' } as CSSProperties}
        >
          <span className={styles.demoTwistStar}>✦</span>
          Five Draw
        </span>
      </div>
      <div className={styles.pillRow}>
        <span
          className={styles.demoCtrlBtn}
          style={{ '--d': '2s' } as CSSProperties}
        >
          <HandsIcon />
          Hands
        </span>
        <span
          className={styles.demoCtrlBtn}
          style={{ '--d': '3s' } as CSSProperties}
        >
          <ScoringIcon />
          Scoring
        </span>
      </div>
    </div>
  );
}

export interface TourPage {
  id: string;
  title: string;
  body: string;
  demo: ReactNode;
}

export const TOUR_PAGES: TourPage[] = [
  {
    id: 'goal',
    title: 'Build 10 poker hands at once',
    body: 'Fill the 5×5 grid with 25 cards. Every row and every column scores as its own 5-card poker hand — ten hands, one board. Beat the target score to win.',
    demo: <GoalDemo />,
  },
  {
    id: 'place',
    title: 'Place cards along the spiral',
    body: "Cards are drawn one at a time and land on the pulsing slot, spiraling out from the center. Don't like the draw? Discard it — but the deck only has so many spares for 25 slots.",
    demo: <SpiralDemo />,
  },
  {
    id: 'perks',
    title: 'Or spend a card on its suit perk',
    body: "Instead of placing, spend the drawn card on its suit's power: ♥ swaps two placed cards, ♠ slides a row or column, ♦ destroys a placed card, ♣ draws a bonus card.",
    demo: <PerksDemo />,
  },
  {
    id: 'bonus',
    title: 'Bonus cards boost your score',
    body: 'You can hold up to three. Gold cards multiply lines while you play; purple cards judge the whole grid at game end. (Green one-time action cards appear in some variants.)',
    demo: <BonusDemo />,
  },
  {
    id: 'scoring',
    title: 'Every line pays — or costs',
    body: 'Better hands score more: a pair earns 5, a straight 30, a flush 40, a royal flush 120 — and jokers are wild. Any row or column left unfinished costs 25 at game end. Clear the target to win.',
    demo: <ScoringDemo />,
  },
  {
    id: 'explore',
    title: 'Keep exploring',
    body: "Challenges and Daily Grid twists remix these rules — the ✦ pill explains any active twist. Tap the difficulty pill for the ruleset, the score pill for win tiers, and Hands or Scoring for hand values and line math.",
    demo: <ExploreDemo />,
  },
];
