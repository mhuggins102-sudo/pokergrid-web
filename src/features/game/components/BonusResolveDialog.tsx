import { CSSProperties } from 'react';
import { BonusCard, SPOTLIGHT_ID } from '../../../game/bonusCards';
import { styleFor } from '../../../lib/bonusCardCategory';
import { Button } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { BonusDialogUI } from '../usePhaseUI';
import styles from './BonusResolveDialog.module.css';

function CardOption({
  card,
  action,
  onPick,
}: {
  card: BonusCard;
  action: string;
  onPick: () => void;
}) {
  const cat = styleFor(card);
  return (
    <button
      type="button"
      className={styles.option}
      style={{ '--chip-tone': cat.borderColor } as CSSProperties}
      onClick={onPick}
    >
      <span className={styles.optionTop}>
        <span className={styles.optionTitle}>
          {cat.icon} {card.title}
        </span>
        <span className={styles.optionMult}>{card.mult}</span>
      </span>
      <span className={styles.optionDesc}>{card.description}</span>
      <span className={styles.optionAction}>{action}</span>
    </button>
  );
}

/**
 * The ♣ Bonus draw flow, rendered IN the dock — not a modal — so the
 * board stays fully visible while choosing, and each option carries
 * its complete description so the choice never requires memorized
 * card knowledge. At the cap, picking a non-Spotlight card moves to
 * the replace step; Spotlight skips it (it evicts the hand by rule).
 */
export function BonusResolvePanel({ ui }: { ui: BonusDialogUI }) {
  const { state, dispatch } = useGameSession();

  if (ui.mode === 'replacing') {
    const incoming = ui.drawn[ui.pickedNew ?? 0];
    return (
      <div className={styles.panel}>
        <p className={styles.hint}>
          Keeping “{incoming?.title}” — tap the held card to swap out.
        </p>
        <div className={styles.choices}>
          {state.bonusCards.map((card, i) => (
            <CardOption
              key={`${card.id}-${i}`}
              card={card}
              action="Tap to swap out"
              onPick={() => dispatch({ type: 'BONUS_REPLACE', oldIdx: i })}
            />
          ))}
        </div>
        <div className={styles.footer}>
          <Button variant="ghost" onClick={() => dispatch({ type: 'CANCEL_ACTION' })}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const pick = (idx: number) => {
    const card = ui.drawn[idx];
    if (ui.atCap && card.id !== SPOTLIGHT_ID) {
      dispatch({ type: 'BONUS_SELECT_NEW', idx });
    } else {
      dispatch({ type: 'BONUS_KEEP', idx });
    }
  };

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>
        ♣ Bonus draw —{' '}
        {ui.atCap
          ? 'your hand is full; keeping a card means swapping one out'
          : ui.drawn.length > 1
            ? 'keep one of the two'
            : 'keep this card?'}
      </p>
      <div className={styles.choices}>
        {ui.drawn.map((card, i) => (
          <CardOption
            key={`${card.id}-${i}`}
            card={card}
            action={ui.atCap && card.id !== SPOTLIGHT_ID ? 'Tap to keep (then pick the swap)' : 'Tap to keep'}
            onPick={() => pick(i)}
          />
        ))}
      </div>
      {ui.canDecline && (
        <div className={styles.footer}>
          <Button variant="ghost" onClick={() => dispatch({ type: 'BONUS_DECLINE' })}>
            Decline both
          </Button>
        </div>
      )}
    </div>
  );
}
