import { Card, Suit, isJoker } from '../../../game/cards';
import { findSkin } from '../../../design/deckSkins';
import { useSettingsStore } from '../../settings/settingsStore';
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
  const dual = card.dual
    ? `, flips to ${card.dual.rank} of ${SUIT_NAME[card.dual.suit]}`
    : '';
  return `${card.rank} of ${SUIT_NAME[card.suit]}${charge}${dual}`;
};

/**
 * Stable identity for layout (FLIP) animations: the same card travelling
 * from the draw well to a grid cell — or between cells — shares this id.
 * A normal deck holds at most one copy of each rank+suit; Double Duty can
 * put the same identity on two physical cards, so its cards fold in the
 * per-card uid to stay unique (also used as React keys in GridBoard).
 * Jokers never travel (the engine auto-places them), so they don't need
 * a unique id.
 */
export const cardLayoutId = (card: Card): string | undefined =>
  isJoker(card)
    ? undefined
    : `card-${card.rank}${card.suit}${card.uid !== undefined ? `-u${card.uid}` : ''}`;

// Four-color suit palette for the two-color-deck=off setting.
// --face-suit-*: the on-card-face variants — dark themes keep the faces
// paper-light, so face inks stay dark while UI suit glyphs brighten.
const SUIT_COLOR: Record<Suit, string> = {
  H: 'var(--face-suit-h)',
  D: 'var(--face-suit-d)',
  C: 'var(--face-suit-c)',
  S: 'var(--face-suit-s)',
};

// Per-half color for the Double Duty two-way face: the root tone class
// can't cover two suits at once, so each half is colored inline.
const suitColor = (suit: Suit, twoColorDeck: boolean): string =>
  twoColorDeck
    ? suit === 'H' || suit === 'D'
      ? 'var(--card-red)'
      : 'var(--card-black)'
    : SUIT_COLOR[suit];

export function CardFace({ card }: { card: Card }) {
  const twoColorDeck = useSettingsStore(s => s.twoColorDeck);
  // Deck skin override (see design/deckSkins.ts). When active it repaints
  // the card face; its optional ink keeps the rank/pips legible. Real art
  // will replace `face` with a full-face image (rank/pips baked in), at
  // which point this becomes a background-image swap.
  const skinsOn = useSettingsStore(s => s.deckSkinsEnabled);
  const skinId = useSettingsStore(s => s.deckSkin);
  const skin = skinsOn ? findSkin(skinId) : null;
  const skinBg = skin ? { background: skin.face } : null;

  if (isJoker(card)) {
    return (
      <div className={`${styles.card} ${styles.joker}`} style={skinBg ?? undefined}>
        <span className={styles.jokerStar} aria-hidden="true">
          ★
        </span>
        <span className={styles.jokerLabel}>JOKER</span>
      </div>
    );
  }
  if (card.dual) {
    // Double Duty two-way face (draw well only — placed/discarded cards
    // are stripped to their active half). Active identity top-left,
    // the flip identity bottom-right printed upside-down, so a 180°
    // rotation of the card reads correctly.
    return (
      <div className={styles.card} style={skinBg ?? undefined}>
        <span
          className={`${styles.dualHalf} ${styles.dualTop}`}
          style={{ color: skin?.ink ?? suitColor(card.suit, twoColorDeck) }}
          aria-hidden="true"
        >
          <span className={styles.dualRank}>{card.rank}</span>
          <span className={styles.dualPip}>{SUIT_GLYPH[card.suit]}</span>
        </span>
        <span className={styles.dualDivider} aria-hidden="true" />
        <span
          className={`${styles.dualHalf} ${styles.dualBottom}`}
          style={{ color: skin?.ink ?? suitColor(card.dual.suit, twoColorDeck) }}
          aria-hidden="true"
        >
          <span className={styles.dualRank}>{card.dual.rank}</span>
          <span className={styles.dualPip}>{SUIT_GLYPH[card.dual.suit]}</span>
        </span>
      </div>
    );
  }
  const tone = card.suit === 'H' || card.suit === 'D' ? styles.red : styles.black;
  const faceColor = skin?.ink ?? (twoColorDeck ? undefined : SUIT_COLOR[card.suit]);
  return (
    <div
      className={`${styles.card} ${tone}`}
      style={{ ...skinBg, ...(faceColor ? { color: faceColor } : null) }}
    >
      {/* Low-opacity center pip: glanceable suit reading at small
          sizes without competing with the rank. Inherits the face's
          suit color. */}
      <span className={styles.watermark} aria-hidden="true">
        {SUIT_GLYPH[card.suit]}
      </span>
      <span className={styles.rank} aria-hidden="true">
        {card.rank}
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
