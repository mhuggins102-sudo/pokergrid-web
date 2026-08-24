import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Card, Rank, Suit } from '../../game/cards';
import { LIVE_CHALLENGES } from '../../game/challenges';
import { freshShuffledDeck, shuffle } from '../../game/deck';
import { SPIRAL_POSITION } from '../../game/grid';
import { HandRank } from '../../game/hands';
import { TARGET_BY_DIFFICULTY } from '../../game/rules';
import { HAND_BASE_VALUE } from '../../game/scoring';
import { Difficulty, difficultyColors } from '../../design/tokens';
import { CardFace } from '../game/components/CardFace';
import { HandsIcon, ScoringIcon } from '../game/components/icons';
import { HAND_LABEL } from '../game/handLabels';
import { prefersReducedMotion } from '../game/useAnimatedNumber';
import { useSettingsStore } from '../settings/settingsStore';
import styles from './IntroTour.module.css';

/*
 * The intro tour's six pages: title + copy + a small looping demo.
 * Demos that need scripted or random sequencing drive a class/content
 * flip from a JS timer; the rest are pure CSS keyframe loops. Both
 * respect reduced motion: the tour card's `.still` class freezes the
 * CSS loops, and the JS demos skip their timers and render a legible
 * static frame instead. Copy adapts the Rules page's "How PokerGrid
 * works" steps.
 */

const C = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });
const JOKER: Card = { kind: 'joker' };

// The same reduced-motion condition the tour card uses for `.still` —
// the JS-driven demos read it themselves to skip their timers (the
// test env forces it, keeping component tests timer-free).
const useStill = (): boolean =>
  useSettingsStore(s => s.reduceMotion) || prefersReducedMotion();

/**
 * Shuffle-bag stepper: yields `items` in random order, every one
 * before any repeats — and never the same item twice in a row, refill
 * boundaries included. The first bag excludes `initial` since it is
 * already showing.
 */
function shuffleBag<T>(items: readonly T[], initial: T): () => T {
  let bag = shuffle(items.filter(i => i !== initial));
  let last = initial;
  return () => {
    if (bag.length === 0) {
      bag = shuffle(items);
      if (bag[bag.length - 1] === last && bag.length > 1) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    last = bag.pop() as T;
    return last;
  };
}

/** Shuffle-bag rotation on a timer (skipped under reduced motion). */
function useShuffleBag<T>(
  items: readonly T[],
  intervalMs: number,
  initial: T
): T {
  const still = useStill();
  const [cur, setCur] = useState(initial);
  useEffect(() => {
    if (still) return;
    const next = shuffleBag(items, initial);
    const id = window.setInterval(() => setCur(next()), intervalMs);
    return () => window.clearInterval(id);
  }, [still, items, intervalMs, initial]);
  return cur;
}

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };

// Mini cards live on `--card-face` (paper-light in EVERY theme), so
// they use the on-face suit inks (`--face-suit-*`, the tokens
// CardFace's four-color path uses) — the UI `--suit-*` set lightens
// spades for dark surfaces and washes out on the cream face.
const mcTone = (suit: Suit): CSSProperties =>
  ({ '--tone': `var(--face-suit-${suit.toLowerCase()})` }) as CSSProperties;

const mcFace = (card: Card): ReactNode =>
  card.kind === 'standard' ? (
    <>
      {card.rank}
      {SUIT_GLYPH[card.suit]}
    </>
  ) : (
    '★'
  );

// A 5×5 of tiny cells, classed/styled/filled per index.
function MiniGrid({
  cellClass,
  cellStyle,
  cellContent,
}: {
  cellClass: (idx: number) => string;
  cellStyle?: (idx: number) => CSSProperties | undefined;
  cellContent?: (idx: number) => ReactNode;
}) {
  return (
    <div className={styles.miniGrid} aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          className={`${styles.miniCell} ${cellClass(i)}`}
          style={cellStyle?.(i)}
        >
          {cellContent?.(i)}
        </span>
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

const dealCards = (): Card[] => freshShuffledDeck(Math.random, 0).slice(0, 25);

function SpiralDemo() {
  const still = useStill();
  // Real cards seat one at a time in spiral order; the full board
  // holds a beat, clears in one clean reset, and a FRESH random deal
  // loops. The initial deal doubles as the reduced-motion frame.
  const [seated, setSeated] = useState(still ? 25 : 0);
  const [deal, setDeal] = useState<Card[]>(dealCards);
  useEffect(() => {
    if (still) return;
    let n = 0;
    let id = 0;
    const tick = () => {
      n = n >= 25 ? 0 : n + 1;
      if (n === 0) setDeal(dealCards());
      setSeated(n);
      const wait = n === 25 ? 1600 : n === 0 ? 600 : 170;
      id = window.setTimeout(tick, wait);
    };
    id = window.setTimeout(tick, 500);
    return () => window.clearTimeout(id);
  }, [still]);
  const cardAt = (i: number) => deal[SPIRAL_POSITION[i] - 1];
  return (
    <MiniGrid
      cellClass={i => {
        const p = SPIRAL_POSITION[i];
        if (p > seated) return '';
        return `${styles.mc} ${p === seated && !still ? styles.seatNew : ''}`;
      }}
      cellStyle={i => {
        const card = cardAt(i);
        return SPIRAL_POSITION[i] <= seated && card.kind === 'standard'
          ? mcTone(card.suit)
          : undefined;
      }}
      cellContent={i =>
        SPIRAL_POSITION[i] <= seated ? mcFace(cardAt(i)) : null
      }
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

// Each perk acts on its own cells in one window of the shared 6s
// cycle, synced to its chip's highlight: ♥ swaps K♥↔2♦, ♠ slides the
// bottom row into the empty cell beside it, ♦ destroys the 9♥. The ♣
// window pops a bonus chip beside the grid instead — no board card
// lights up, because the DRAWN club triggers the draw, not a placed
// one.
const PERK_CELL: Record<number, string> = {
  7: styles.swapRight,
  8: styles.swapLeft,
  16: styles.slideCell,
  17: styles.slideCell,
  18: styles.slideCell,
  13: styles.destroyCell,
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
        <MiniGrid
          cellClass={i =>
            MINI_BOARD[i] ? `${styles.mc} ${PERK_CELL[i] ?? ''}` : ''
          }
          cellStyle={i =>
            MINI_BOARD[i] ? mcTone(MINI_BOARD[i][1]) : undefined
          }
          cellContent={i =>
            MINI_BOARD[i] ? (
              <>
                {MINI_BOARD[i][0]}
                {SUIT_GLYPH[MINI_BOARD[i][1]]}
              </>
            ) : null
          }
        />
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

// One example per hand type (labels/values come from the real
// HAND_LABEL / HAND_BASE_VALUE maps); the straight's joker stands in
// as the missing 7, and Five of a Kind needs one by definition.
const HAND_EXAMPLES: Record<HandRank, Card[]> = {
  HIGH_CARD: [C('K', 'S'), C('9', 'D'), C('7', 'H'), C('4', 'C'), C('2', 'S')],
  PAIR: [C('8', 'H'), C('8', 'C'), C('K', 'D'), C('5', 'S'), C('2', 'H')],
  TWO_PAIR: [C('J', 'S'), C('J', 'D'), C('4', 'H'), C('4', 'C'), C('9', 'S')],
  THREE_OF_A_KIND: [
    C('Q', 'H'),
    C('Q', 'S'),
    C('Q', 'D'),
    C('7', 'C'),
    C('3', 'H'),
  ],
  STRAIGHT: [C('5', 'D'), C('6', 'S'), JOKER, C('8', 'H'), C('9', 'C')],
  FLUSH: [C('9', 'H'), C('J', 'H'), C('3', 'H'), C('Q', 'H'), C('6', 'H')],
  FULL_HOUSE: [C('K', 'S'), C('K', 'H'), C('K', 'D'), C('9', 'C'), C('9', 'S')],
  FOUR_OF_A_KIND: [
    C('A', 'C'),
    C('A', 'D'),
    C('A', 'H'),
    C('A', 'S'),
    C('6', 'D'),
  ],
  STRAIGHT_FLUSH: [
    C('5', 'C'),
    C('6', 'C'),
    C('7', 'C'),
    C('8', 'C'),
    C('9', 'C'),
  ],
  ROYAL_FLUSH: [
    C('10', 'S'),
    C('J', 'S'),
    C('Q', 'S'),
    C('K', 'S'),
    C('A', 'S'),
  ],
  FIVE_OF_A_KIND: [C('7', 'D'), C('7', 'C'), C('7', 'H'), C('7', 'S'), JOKER],
};
const ALL_HANDS = Object.keys(HAND_EXAMPLES) as HandRank[];

function ScoringDemo() {
  // Every hand type in shuffle-bag order; the flush is the
  // reduced-motion frame. The five cards show in a random order each
  // time — as in the game, only the hand formed matters, not where
  // its cards sit.
  const rank = useShuffleBag<HandRank>(ALL_HANDS, 3200, 'FLUSH');
  const cards = useMemo(() => shuffle(HAND_EXAMPLES[rank]), [rank]);
  return (
    <div className={styles.handCycle} aria-hidden="true">
      <div key={rank} className={styles.handShow}>
        <div className={styles.flushCards}>
          {cards.map((card, j) => (
            <span key={j} className={styles.flushCard}>
              <CardFace card={card} />
            </span>
          ))}
        </div>
        <span className={styles.flushScore}>
          {HAND_LABEL[rank]} +{HAND_BASE_VALUE[rank]}
        </span>
      </div>
    </div>
  );
}

const DEMO_DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const TWIST_NAMES = LIVE_CHALLENGES.map(c => c.name);

function ExploreDemo() {
  // Miniatures of the real in-game pills. One shared timer swaps BOTH
  // rotating pills in unison: the difficulty pill walks easy → medium
  // → hard with each tier's true tone and target (difficultyColors /
  // TARGET_BY_DIFFICULTY — the navPill's own sources) while the twist
  // pill shuffle-bags through every live variant. The Hands / Scoring
  // buttons sit still.
  const still = useStill();
  const [pills, setPills] = useState({ diff: 0, twist: 'Five Draw' });
  useEffect(() => {
    if (still) return;
    const nextTwist = shuffleBag(TWIST_NAMES, 'Five Draw');
    let d = 0;
    const id = window.setInterval(() => {
      d = (d + 1) % DEMO_DIFFS.length;
      setPills({ diff: d, twist: nextTwist() });
    }, 2600);
    return () => window.clearInterval(id);
  }, [still]);
  const diff = DEMO_DIFFS[pills.diff];
  return (
    <div className={styles.pillsDemo} aria-hidden="true">
      <div className={styles.pillRow}>
        <span
          className={styles.demoNavPill}
          style={{ '--pill-tone': difficultyColors[diff] } as CSSProperties}
        >
          <span key={diff} className={styles.rollSwap}>
            <span className={styles.demoNavDot} />
            <span className={styles.demoNavDiff}>{diff}</span>
            <span className={styles.demoNavScore}>
              0
              <span className={styles.demoNavTarget}>
                / {TARGET_BY_DIFFICULTY[diff]}
              </span>
            </span>
          </span>
        </span>
        <span className={styles.demoTwistPill}>
          <span key={pills.twist} className={styles.rollSwap}>
            <span className={styles.demoTwistStar}>✦</span>
            {pills.twist}
          </span>
        </span>
      </div>
      <div className={styles.pillRow}>
        <span className={styles.demoCtrlBtn}>
          <HandsIcon />
          Hands
        </span>
        <span className={styles.demoCtrlBtn}>
          <ScoringIcon />
          Scoring
        </span>
      </div>
    </div>
  );
}

function XpDemo() {
  // Two alternating scenes on one beat clock: the end-of-game
  // level-up moment (the ResultView "+N XP" / "⬆ Level reached" chip
  // styling, with the bar filling between them), then a full board
  // re-inking as the 2-/4-color deck setting toggles. The still frame
  // is the completed level-up scene.
  const still = useStill();
  const [t, setT] = useState(0);
  const [board] = useState<Card[]>(dealCards);
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setT(x => x + 1), 1400);
    return () => window.clearInterval(id);
  }, [still]);
  const beat = t % 6;
  const cycle = Math.floor(t / 6);
  const levelScene = still || beat < 3;
  const fourColor = beat % 2 === 0;
  return levelScene ? (
    <div key={`lvl-${cycle}`} className={styles.xpScene} aria-hidden="true">
      <span className={styles.xpGain}>+120 XP</span>
      <span className={styles.xpTrack}>
        <span className={styles.xpFill} />
      </span>
      <span className={styles.xpLevelUp}>⬆ Level 4 reached</span>
    </div>
  ) : (
    <div key={`looks-${cycle}`} className={styles.lookScene} aria-hidden="true">
      <MiniGrid
        cellClass={() => styles.mc}
        cellStyle={i => {
          const card = board[i];
          if (card.kind !== 'standard') return undefined;
          if (fourColor) return mcTone(card.suit);
          const red = card.suit === 'H' || card.suit === 'D';
          return {
            '--tone': red ? 'var(--card-red)' : 'var(--card-black)',
          } as CSSProperties;
        }}
        cellContent={i => mcFace(board[i])}
      />
      <span key={String(fourColor)} className={styles.lookLabel}>
        {fourColor ? '4-color deck' : '2-color deck'}
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
    body: "Instead of placing, spend the drawn card on its suit's power: ♥ swaps two placed cards, ♠ slides a row or column, ♦ destroys a placed card, ♣ draws a bonus card. These can leave holes in the grid — the next placed card always fills the earliest open spiral slot.",
    demo: <PerksDemo />,
  },
  {
    id: 'bonus',
    title: 'Bonus cards boost your score',
    body: 'You can hold up to three. Gold cards multiply lines while you play. Purple cards assess the entire grid at game end and multiply your total line score. Green cards are one-time actions that only appear in certain variants.',
    demo: <BonusDemo />,
  },
  {
    id: 'scoring',
    title: 'Every line pays — or costs',
    body: 'Better hands score more: a pair earns 5, a straight 30, a flush 40, a royal flush 120, etc. Jokers are wild and help with creating the higher value hands. Any line left unfinished at game end costs 25.',
    demo: <ScoringDemo />,
  },
  {
    id: 'explore',
    title: 'In-game reminders',
    body: 'Challenges and Daily Grid twists remix the base rules, with the ✦ pill explaining the active twist. Tap the difficulty pill for the ruleset, the score pill for win tiers, Hands for the value of each hand type, or Scoring for the current value of each line.',
    demo: <ExploreDemo />,
  },
  {
    id: 'progress',
    title: 'Level up, unlock decks',
    body: 'Every game earns XP, and leveling up unlocks new deck designs. Visit Settings to equip them and set your look — theme, light or dark mode, 2- or 4-color deck, and more. On phones, the ☰ menu in the top-right corner tweaks these mid-game too.',
    demo: <XpDemo />,
  },
];
