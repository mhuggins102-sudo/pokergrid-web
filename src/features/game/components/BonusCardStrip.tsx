import { CSSProperties, useState } from 'react';
import { BonusCard } from '../../../game/bonusCards';
import { styleFor } from '../../../lib/bonusCardCategory';
import { Dialog } from '../../../design/primitives';
import styles from './BonusCardStrip.module.css';

export function BonusChip({
  card,
  onClick,
  value,
}: {
  card: BonusCard;
  onClick?: () => void;
  /** Optional resolved contribution (Shapley points, result view). */
  value?: number;
}) {
  const cat = styleFor(card);
  return (
    <button
      type="button"
      className={styles.chip}
      style={{ '--chip-tone': cat.borderColor } as CSSProperties}
      onClick={onClick}
      aria-label={`Bonus card: ${card.name}`}
    >
      <span className={styles.chipTitle}>{card.title}</span>
      <span className={styles.chipMult}>{card.mult}</span>
      {value !== undefined && (
        <span className={styles.chipValue}>
          {value >= 0 ? '+' : ''}
          {value} pts
        </span>
      )}
    </button>
  );
}

export interface BonusCardStripProps {
  cards: BonusCard[];
  bonusDeckSize?: number;
  /** Shapley contributions aligned with `cards` (result view). */
  values?: number[];
  title?: string;
}

/**
 * Held bonus cards as tappable chips; tapping opens the detail dialog
 * with the card's full description and category.
 */
export function BonusCardStrip({
  cards,
  bonusDeckSize,
  values,
  title = 'Bonus cards',
}: BonusCardStripProps) {
  const [detail, setDetail] = useState<BonusCard | null>(null);
  const detailStyle = detail ? styleFor(detail) : null;

  return (
    <section className={styles.strip} aria-label="Bonus cards">
      <div className={styles.heading}>
        <h2 className="text-section">{title}</h2>
        {bonusDeckSize !== undefined && (
          <span className={styles.deckCount}>{bonusDeckSize} in deck</span>
        )}
      </div>
      <div className={styles.chips}>
        {cards.length === 0 && (
          <span className={styles.emptyNote}>
            None held — a ♣ draw adds one.
          </span>
        )}
        {cards.map((card, i) => (
          <BonusChip
            key={`${card.id}-${i}`}
            card={card}
            value={values?.[i]}
            onClick={() => setDetail(card)}
          />
        ))}
      </div>
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
      >
        {detail && detailStyle && (
          <div
            className={styles.detailBody}
            style={{ '--chip-tone': detailStyle.borderColor } as CSSProperties}
          >
            <span className={styles.detailCategory}>
              {detailStyle.icon} {detailStyle.label}
            </span>
            <p className="text-body">{detail.description}</p>
          </div>
        )}
      </Dialog>
    </section>
  );
}
