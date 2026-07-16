import { Card, Suit, isJoker } from '../../../game/cards';
import { SKIN_IDS, SuitKey } from '../../../design/deckSkins';
import { useTier } from '../../../app/useTier';
import { useSettingsStore } from '../../settings/settingsStore';
import { skinFace } from './skinFace';
import styles from './CardFace.module.css';

// Suit key mapping for the skin renderer (it takes lowercase 'h'|'d'|'c'|'s').
const SUIT_KEY: Record<Suit, SuitKey> = { H: 'h', D: 'd', C: 'c', S: 's' };

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
  // Phone tier gets a skin's mobile layout (bigger rank/suit) where one
  // exists; tablet/desktop (≥768) keep the desktop layout unchanged.
  const mobile = useTier() === 'phone';
  // Deck skin override (Claude Design's token-based faces, design/
  // deckSkins.ts). Active only for standard single-suit cards — jokers and
  // Double Duty two-way faces keep their dedicated rendering.
  const skinsOn = useSettingsStore(s => s.deckSkinsEnabled);
  const skinId = useSettingsStore(s => s.deckSkin);
  const activeSkin =
    skinsOn && skinId && SKIN_IDS.includes(skinId) ? skinId : null;

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
  if (card.dual) {
    // Double Duty two-way face (draw well only — placed/discarded cards
    // are stripped to their active half). Active identity top-left,
    // the flip identity bottom-right printed upside-down, so a 180°
    // rotation of the card reads correctly.
    return (
      <div className={styles.card}>
        <span
          className={`${styles.dualHalf} ${styles.dualTop}`}
          style={{ color: suitColor(card.suit, twoColorDeck) }}
          aria-hidden="true"
        >
          <span className={styles.dualRank}>{card.rank}</span>
          <span className={styles.dualPip}>{SUIT_GLYPH[card.suit]}</span>
        </span>
        <span className={styles.dualDivider} aria-hidden="true" />
        <span
          className={`${styles.dualHalf} ${styles.dualBottom}`}
          style={{ color: suitColor(card.dual.suit, twoColorDeck) }}
          aria-hidden="true"
        >
          <span className={styles.dualRank}>{card.dual.rank}</span>
          <span className={styles.dualPip}>{SUIT_GLYPH[card.dual.suit]}</span>
        </span>
      </div>
    );
  }

  // Active skin: render Claude Design's wrap + layers. The wrap carries the
  // face background, border, radius and container-type; each layer is an
  // absolutely-positioned span (some with nested corner-index spans). The
  // wrap fills the (parent-sized) cell — height:100% overrides its square
  // aspect-ratio so it tracks the grid cell exactly.
  if (activeSkin) {
    const face = skinFace(
      activeSkin,
      card.rank,
      SUIT_KEY[card.suit],
      !twoColorDeck,
      mobile
    );
    return (
      <div
        style={{ ...face.wrap, height: '100%', userSelect: 'none' }}
        data-skin={activeSkin}
      >
        {face.layers.map((l, i) => (
          <span key={i} style={l.style}>
            {l.glyph}
            {l.kids.map((k, j) => (
              <span key={j} style={k.style}>
                {k.glyph}
              </span>
            ))}
          </span>
        ))}
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

  const tone = card.suit === 'H' || card.suit === 'D' ? styles.red : styles.black;
  return (
    <div
      className={`${styles.card} ${tone}`}
      style={twoColorDeck ? undefined : { color: SUIT_COLOR[card.suit] }}
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
