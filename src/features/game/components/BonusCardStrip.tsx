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
  /**
   * 'panel' (default): a titled card list for the desktop side column.
   * 'row': a slim three-slot band for mobile — always renders all three
   * hand slots (filled or dashed-empty) so held cards stay on screen
   * and the cap is legible without any scrolling.
   */
  layout?: 'panel' | 'row';
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
  layout = 'panel',
}: BonusCardStripProps) {
  const [detail, setDetail] = useState<BonusCard | null>(null);
  const detailStyle = detail ? styleFor(detail) : null;

  if (layout === 'row') {
    const emptySlots = Math.max(0, 3 - cards.length);
    return (
      <div className={styles.row} aria-label="Bonus cards">
        {cards.map((card, i) => (
          <BonusChip
            key={`${card.id}-${i}`}
            card={card}
            value={values?.[i]}
            onClick={() => setDetail(card)}
          />
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={`empty-${i}`} className={styles.emptySlot}>
            {cards.length === 0 && i === 0 ? '♣ draws fill these' : 'empty'}
          </div>
        ))}
        {bonusDeckSize !== undefined && (
          <span className={styles.deckHint}>♣{bonusDeckSize}</span>
        )}
        <DetailDialog
          detail={detail}
          detailStyle={detailStyle}
          onClose={() => setDetail(null)}
        />
      </div>
    );
  }

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
      <DetailDialog
        detail={detail}
        detailStyle={detailStyle}
        onClose={() => setDetail(null)}
      />
    </section>
  );
}

function DetailDialog({
  detail,
  detailStyle,
  onClose,
}: {
  detail: BonusCard | null;
  detailStyle: ReturnType<typeof styleFor> | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={detail !== null} onClose={onClose} title={detail?.name ?? ''}>
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
  );
}
