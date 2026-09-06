import { Card, cardLabel } from '../../../game/cards';
import { Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { CardFace } from './CardFace';
import styles from './TradePick.module.css';

/**
 * Trading Post ♣ reveal: the top two deck cards, one of which MUST be
 * seated at the traded slot (the sheet is non-dismissible — seeing the
 * cards commits the perk, so there's no backing out). The passed-over
 * card shuffles back into the deck; the board card being traded away
 * is trashed.
 */
export function TradePick({ drawn }: { drawn: Card[] }) {
  const { dispatch } = useGameSession();
  return (
    <Sheet open onClose={() => {}} dismissible={false} title="♣ Trade">
      <div className={styles.body}>
        <p className="text-body">
          Pick the card to seat at the traded spot. The other shuffles
          back into the deck.
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
    </Sheet>
  );
}
