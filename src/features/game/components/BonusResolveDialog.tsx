import { SPOTLIGHT_ID } from '../../../game/bonusCards';
import { Button, Sheet } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { BonusDialogUI } from '../usePhaseUI';
import { BonusChip } from './BonusCardStrip';
import styles from './BonusResolveDialog.module.css';

/**
 * The ♣ Bonus draw flow — a bottom sheet on phones, centered dialog on
 * larger screens. Resolving: pick one of the drawn cards (or decline).
 * At the cap, picking a non-Spotlight card moves to the replacing step:
 * tap one of the held three to swap out. Spotlight skips the swap — it
 * evicts the whole hand by rule. When declining isn't allowed the sheet
 * can't be dismissed: the player must choose.
 */
export function BonusResolveDialog({ ui }: { ui: BonusDialogUI }) {
  const { state, dispatch } = useGameSession();

  // Dismissing the sheet (Esc / backdrop / ✕) maps to the flow's "back
  // out" action where one exists.
  const onClose = () => {
    if (ui.mode === 'replacing') dispatch({ type: 'CANCEL_ACTION' });
    else if (ui.canDecline) dispatch({ type: 'BONUS_DECLINE' });
  };

  if (ui.mode === 'replacing') {
    const incoming = ui.drawn[ui.pickedNew ?? 0];
    return (
      <Sheet open onClose={onClose} title="♣ Bonus — replace">
        <div className={styles.body}>
          <p className={styles.hint}>
            Tap the held card to swap out for “{incoming?.name}”.
          </p>
          <div className={styles.choices}>
            {state.bonusCards.map((card, i) => (
              <BonusChip
                key={`${card.id}-${i}`}
                card={card}
                onClick={() => dispatch({ type: 'BONUS_REPLACE', oldIdx: i })}
              />
            ))}
          </div>
          <div className={styles.footer}>
            <Button variant="ghost" onClick={() => dispatch({ type: 'CANCEL_ACTION' })}>
              Back
            </Button>
          </div>
        </div>
      </Sheet>
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
    <Sheet
      open
      onClose={onClose}
      title="♣ Bonus draw"
      dismissible={ui.canDecline}
    >
      <div className={styles.body}>
        <p className={styles.hint}>
          {ui.atCap
            ? 'Your hand is full — keeping a card means swapping one out.'
            : ui.drawn.length > 1
              ? 'Keep one of the two.'
              : 'Keep this card?'}
        </p>
        <div className={styles.choices}>
          {ui.drawn.map((card, i) => (
            <div key={`${card.id}-${i}`} className={styles.choice}>
              <BonusChip card={card} onClick={() => pick(i)} />
            </div>
          ))}
        </div>
        {ui.canDecline && (
          <div className={styles.footer}>
            <Button variant="ghost" onClick={() => dispatch({ type: 'BONUS_DECLINE' })}>
              Decline
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
