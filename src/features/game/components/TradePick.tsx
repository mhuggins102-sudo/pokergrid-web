import { useState } from 'react';
import { Card, cardLabel } from '../../../game/cards';
import { useGameSession } from '../GameSessionProvider';
import { CardFace } from './CardFace';
import styles from './TradePick.module.css';

/**
 * Trading Post ♣ reveal: the top two deck cards, one of which MUST be
 * seated at the traded slot — there is no dismissal (seeing the cards
 * commits the perk), but the board stays viewable: the same board-peek
 * dim as the ♣ Bonus draw modal. Desktop arms a hover dim once the
 * pointer has visited the card; coarse pointers tap the scrim to fade
 * the overlay down and tap anywhere to restore. The passed-over card
 * is trashed along with the board card being traded away.
 */
export function TradePick({ drawn }: { drawn: Card[] }) {
  const { dispatch } = useGameSession();
  // Board-peek arming — see BonusDrawModal for the full rationale: the
  // overlay opens solid no matter where the pointer sits, and only
  // starts hover-dimming after the pointer has entered the card once.
  const [hasHovered, setHasHovered] = useState(false);
  const [coarse] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(pointer: coarse)').matches
  );
  const [peek, setPeek] = useState(false);
  const onScrimClick = coarse
    ? (e: React.MouseEvent) => {
        // While peeking the card is pointer-events:none, so every tap
        // lands here — restore, and only restore.
        if (peek) {
          setPeek(false);
          return;
        }
        if (e.target === e.currentTarget) setPeek(true);
      }
    : undefined;

  return (
    <div
      className={`${styles.scrim} ${hasHovered ? styles.scrimDimmable : ''} ${
        peek ? styles.scrimPeek : ''
      }`}
      onClick={onScrimClick}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Trade — pick a card"
        onMouseEnter={() => setHasHovered(true)}
      >
        <div className={styles.headRow}>
          <span className={styles.title}>♣ Trade</span>
          <span className={styles.spent}>♣ spent</span>
        </div>
        <p className={styles.sub}>
          Pick the card to seat at the traded spot. The other is trashed
          along with the card you traded away.
        </p>
        <div className={styles.cards}>
          {drawn.map((card, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.cardBtn}
              onClick={() => dispatch({ type: 'RESOLVE_TRADE', idx })}
              aria-label={`Take ${cardLabel(card)}`}
            >
              <span className={styles.face}>
                <CardFace card={card} />
              </span>
              <span className={styles.take}>Take</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
