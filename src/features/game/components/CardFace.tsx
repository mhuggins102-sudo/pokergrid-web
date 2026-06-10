import { Card, Suit, isJoker } from '../../../game/cards';
import styles from './CardFace.module.css';

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };
const SUIT_NAME: Record<Suit, string> = {
  H: 'hearts',
  S: 'spades',
  D: 'diamonds',
  C: 'clubs',
};

export const cardAriaLabel = (card: Card): string => {
  if (isJoker(card)) return 'Joker';
  const charge =
    card.supercharge === 'wild'
      ? ', wild'
      : card.supercharge === 'double'
        ? ', doubled'
        : '';
  return `${card.rank} of ${SUIT_NAME[card.suit]}${charge}`;
};

/**
 * Stable identity for layout (FLIP) animations: a deck holds at most one
 * copy of each rank+suit, so the same card travelling from the draw well
 * to a grid cell — or between cells — shares this id. Jokers never travel
 * (the engine auto-places them), so they don't need a unique id.
 */
export const cardLayoutId = (card: Card): string | undefined =>
  isJoker(card) ? undefined : `card-${card.rank}${card.suit}`;

export function CardFace({ card }: { card: Card }) {
  if (isJoker(card)) {
    return (
      <div className={`${styles.card} ${styles.joker}`}>
        <span className={styles.jokerStar} aria-hidden="true">
          ★
        </span>
        <span className={styles.jokerLabel}>JOKER</span>
      </div>
    );
  }
  const tone = card.suit === 'H' || card.suit === 'D' ? styles.red : styles.black;
  return (
    <div className={`${styles.card} ${tone}`}>
      <span className={styles.corner} aria-hidden="true">
        {card.rank}
        <span className={styles.cornerSuit}>{SUIT_GLYPH[card.suit]}</span>
      </span>
      <span className={styles.pip} aria-hidden="true">
        {SUIT_GLYPH[card.suit]}
      </span>
      {card.supercharge && (
        <span
          className={`${styles.charge} ${
            card.supercharge === 'wild' ? styles.chargeWild : styles.chargeDouble
          }`}
        >
          {card.supercharge === 'wild' ? 'W' : '×2'}
        </span>
      )}
    </div>
  );
}
