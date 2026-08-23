import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { Card, Rank, Suit } from '../../game/cards';
import { SPIRAL_POSITION } from '../../game/grid';
import { CardFace } from '../game/components/CardFace';
import styles from './IntroTour.module.css';

/*
 * The intro tour's six pages: title + copy + a small looping demo.
 * Demos are pure CSS keyframe loops (module classes on plain divs) —
 * the tour card's `.still` class freezes them at their final frame
 * for reduced motion, and the OS-level preference collapses them
 * globally (reset.css). Copy adapts the Rules page's "How PokerGrid
 * works" steps.
 */

const C = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });

// A 5×5 of tiny inert cells, optionally classed per index.
function MiniGrid({ cellClass }: { cellClass?: (idx: number) => string }) {
  return (
    <div className={styles.miniGrid} aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          className={`${styles.miniCell} ${cellClass?.(i) ?? ''}`}
          style={
            // Spiral demo: phase each cell by its 1-based spiral
            // position (grid.ts SPIRAL_POSITION).
            { '--sp': SPIRAL_POSITION[i] } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function GoalDemo() {
  // The center row, then the center column, sweep-highlight in turn.
  return (
    <MiniGrid
      cellClass={i =>
        [
          Math.floor(i / 5) === 2 ? styles.dRow : null,
          i % 5 === 2 ? styles.dCol : null,
        ]
          .filter(Boolean)
          .join(' ')
      }
    />
  );
}

function SpiralDemo() {
  // Cards ripple in along the spiral, each arriving with a brief
  // accent ring — the pulsing-slot idea in miniature.
  return <MiniGrid cellClass={() => styles.dSeat} />;
}

const PERKS: Array<[string, string, string]> = [
  ['♥', 'Swap', '--suit-h'],
  ['♠', 'Slide', '--suit-s'],
  ['♦', 'Destroy', '--suit-d'],
  ['♣', 'Bonus', '--suit-c'],
];

function PerksDemo() {
  return (
    <div className={styles.perksDemo} aria-hidden="true">
      <div className={styles.perkRow}>
        {PERKS.map(([glyph, label, tone], i) => (
          <span
            key={label}
            className={styles.perkChip}
            style={{ '--tone': `var(${tone})`, '--d': `${i * 1.1}s` } as CSSProperties}
          >
            <span className={styles.perkGlyph}>{glyph}</span>
            {label}
          </span>
        ))}
      </div>
      {/* Two placed cards trading places — the ♥ Swap in miniature. */}
      <div className={styles.swapDemo}>
        <span className={`${styles.swapTile} ${styles.swapA}`} />
        <span className={`${styles.swapTile} ${styles.swapB}`} />
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

const FLUSH: Card[] = [C('9', 'H'), C('J', 'H'), C('3', 'H'), C('Q', 'H'), C('6', 'H')];

function ScoringDemo() {
  return (
    <div className={styles.flushDemo} aria-hidden="true">
      <div className={styles.flushCards}>
        {FLUSH.map(card => (
          <span key={`${card.kind === 'standard' ? card.rank + card.suit : 'j'}`} className={styles.flushCard}>
            <CardFace card={card} />
          </span>
        ))}
      </div>
      <span className={styles.flushScore}>Flush +40</span>
    </div>
  );
}

function ExploreDemo() {
  return (
    <div className={styles.pillsDemo} aria-hidden="true">
      <span className={styles.pillDemo} style={{ '--d': '0s' } as CSSProperties}>
        <span className={styles.pillDot} />
        easy · 0 / 400
      </span>
      <span className={styles.pillDemo} style={{ '--d': '1s' } as CSSProperties}>
        ✦ Twist
      </span>
      <span className={styles.pillDemo} style={{ '--d': '2s' } as CSSProperties}>
        Hands
      </span>
      <span className={styles.pillDemo} style={{ '--d': '3s' } as CSSProperties}>
        Scoring
      </span>
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
    body: 'Better hands score more: a pair earns 5, a straight 30, a flush 40, a royal flush 120. Any row or column left unfinished costs 25 at game end. Clear the target to win — the biggest wins earn silver and gold trophies.',
    demo: <ScoringDemo />,
  },
  {
    id: 'explore',
    title: 'Keep exploring',
    body: "Challenges and Daily Grid twists remix these rules — the ✦ pill explains any active twist. During a game, tap the difficulty pill for the ruleset, the score pill for win tiers, and the Hands and Scoring buttons for hand values and live line math.",
    demo: <ExploreDemo />,
  },
];
