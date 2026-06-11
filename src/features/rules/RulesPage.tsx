import { Link } from 'react-router';
import { TARGET_BY_DIFFICULTY } from '../../game/rules';
import { HAND_BASE_VALUE, INCOMPLETE_LINE_PENALTY } from '../../game/scoring';
import { HAND_LABEL } from '../game/handLabels';
import { HandRank } from '../../game/hands';
import styles from './RulesPage.module.css';

const HAND_ORDER: HandRank[] = [
  'FIVE_OF_A_KIND',
  'ROYAL_FLUSH',
  'STRAIGHT_FLUSH',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'FLUSH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'PAIR',
  'HIGH_CARD',
];

export function RulesPage() {
  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">How to Play</h1>
        <p className={`${styles.body} ${styles.muted}`}>
          5×5 poker solitaire. Place every card, score the ten lines, beat
          your target.
        </p>
      </header>

      <div className={styles.section}>
        <h2 className="text-section">Each turn</h2>
        <p className={styles.body}>
          One card is drawn at a time. <strong>Place</strong> it on the next
          spiral slot (the pulsing cell — the spiral grows outward from the
          center), <strong>discard</strong> it, or spend it on its{' '}
          <strong>suit perk</strong>. The game ends when the board fills or
          the deck runs out.
        </p>
        <p className={`${styles.body} ${styles.muted}`}>
          On Easy and Medium you can tap the deck to peek at every card
          still in it. Extreme disables the Discard button entirely —
          every draw must be placed or spent.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">Undo</h2>
        <p className={styles.body}>
          Easy and Medium allow <strong>one undo</strong> per game; Hard and
          Extreme allow none, and Challenges never do. The Daily grants one
          free undo regardless of its difficulty — using it does not affect
          your score or rank.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">Suit perks</h2>
        <div className={styles.perk}>
          <span className={`${styles.perkGlyph} ${styles.red}`}>♥</span>
          <span>
            <strong>Swap</strong> — exchange any two cards that share a row
            or column.
          </span>
        </div>
        <div className={styles.perk}>
          <span className={`${styles.perkGlyph} ${styles.black}`}>♠</span>
          <span>
            <strong>Slide</strong> — slide a card (and the chain of cards
            behind it) into empty space.
          </span>
        </div>
        <div className={styles.perk}>
          <span className={`${styles.perkGlyph} ${styles.red}`}>♦</span>
          <span>
            <strong>Destroy</strong> — remove any one card from the board.
          </span>
        </div>
        <div className={styles.perk}>
          <span className={`${styles.perkGlyph} ${styles.black}`}>♣</span>
          <span>
            <strong>Bonus</strong> — draw two bonus cards, keep one (hold up
            to three; at the cap, keeping means swapping one out).
          </span>
        </div>
        <p className={`${styles.body} ${styles.muted}`}>
          The drawn card is spent when you use its perk. A perk is disabled
          when it has no legal move.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">Bonus cards</h2>
        <p className={styles.body}>
          Bonus cards multiply your score — per hand type, per line, per
          suit, or for whole-board feats at game end. Multipliers on the
          same line stack multiplicatively. Chip color tells you when a
          card pays: <strong>gold</strong> during the run,{' '}
          <strong>purple</strong> at game end, <strong>green</strong> for
          the one-time action cards in the twisted modes.
        </p>
        <p className={styles.body}>
          You hold up to <strong>three</strong>. A ♣ draw shows two cards;
          at the cap, keeping one means swapping a held card out — only
          Easy lets you decline at the cap. Tap any held chip to read its
          card and the live numbers behind its condition.
        </p>
        <p className={styles.body}>
          <Link to="/rules/cards">Browse the full bonus card reference →</Link>
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">The joker</h2>
        <p className={styles.body}>
          Jokers place themselves the moment they're drawn and count as the
          best possible card for each of their lines — independently in the
          row and the column. Easy decks carry two jokers, Medium and Hard
          one, Extreme none.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">Scoring</h2>
        <div className={styles.table}>
          {HAND_ORDER.map(h => (
            <div key={h} className={styles.tableRow}>
              <span>{HAND_LABEL[h]}</span>
              <span />
              <span>{HAND_BASE_VALUE[h]}</span>
            </div>
          ))}
          <div className={styles.tableRow} style={{ color: 'var(--danger)' }}>
            <span>Unfinished line at game end</span>
            <span />
            <span>{INCOMPLETE_LINE_PENALTY}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className="text-section">Modes</h2>
        <p className={styles.body}>
          <strong>Free Play</strong> — four difficulties (targets{' '}
          {TARGET_BY_DIFFICULTY.easy}/{TARGET_BY_DIFFICULTY.medium}/
          {TARGET_BY_DIFFICULTY.hard}/{TARGET_BY_DIFFICULTY.extreme}), each
          tightening jokers, undos, discards, and bonus rules.
        </p>
        <p className={styles.body}>
          <strong>Targets Up</strong> — a ladder that adds 25 to the target
          every level; high-tier wins earn powered-up cards for the next
          level. One loss ends the run.
        </p>
        <p className={styles.body}>
          <strong>Challenges</strong> — seven twisted rule sets on the Hard
          ruleset, from random perks to a board pre-scattered with 15 cards.
          Beat one to unlock the next.
        </p>
        <p className={styles.body}>
          <strong>Daily</strong> — one puzzle per UTC day, the same deal for
          every player worldwide, with a shared leaderboard. Some days roll
          a twist from the challenge list (the target adjusts to match).
          One play per day; missed days stay playable from the archive.
        </p>
      </div>
    </section>
  );
}
