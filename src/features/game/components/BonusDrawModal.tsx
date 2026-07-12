import { CSSProperties, useState } from 'react';
import { SPOTLIGHT_ID } from '../../../game/bonusCards';
import {
  categoryIconStyle,
  styleFor,
  toneLabelFor,
} from '../../../lib/bonusCardCategory';
import { useSettingsStore } from '../../settings/settingsStore';
import { useGameSession } from '../GameSessionProvider';
import { BonusDialogUI } from '../usePhaseUI';
import styles from './BonusDrawModal.module.css';

/**
 * The desktop ♣ Bonus draw as the mockup's fixed-overlay modal
 * (design-refs/desktop/Play.dc.html lines 203–226). Same phase-UI
 * contract as the mobile in-dock BonusResolvePanel — pick / replace /
 * decline all dispatch the existing reducer actions; only the shell
 * differs. Desktop-only: mobile keeps BonusResolvePanel untouched.
 */
export function BonusDrawModal({ ui }: { ui: BonusDialogUI }) {
  // Colorblind assist (phase 4 port): glyph beside each option title,
  // same category-style contract as the phone surfaces.
  const assist = useSettingsStore(s => s.colorBlindAssist);
  const { state, dispatch } = useGameSession();
  // Board-peek dim arming: the overlay opens FULLY solid no matter
  // where the pointer sits, and only starts dimming after the pointer
  // has entered the dialog card once and then left. Resets on each
  // open (the modal unmounts between draws). Keyboard focus still
  // forces solid via the CSS :focus-within guard.
  const [hasHovered, setHasHovered] = useState(false);

  const pick = (idx: number) => {
    const card = ui.drawn[idx];
    if (ui.atCap && card.id !== SPOTLIGHT_ID) {
      dispatch({ type: 'BONUS_SELECT_NEW', idx });
    } else {
      dispatch({ type: 'BONUS_KEEP', idx });
    }
  };

  return (
    <div
      className={`${styles.scrim} ${hasHovered ? styles.scrimDimmable : ''}`}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Draw a bonus card"
        onMouseEnter={() => setHasHovered(true)}
      >
        <div className={styles.headRow}>
          <span className={styles.title}>Draw a bonus card</span>
          <span className={styles.spent}>♣ spent</span>
        </div>

        {ui.mode === 'resolving' ? (
          <>
            <p className={styles.sub}>Pick one to add to your hand.</p>
            <div className={styles.options}>
              {ui.drawn.map((card, i) => {
                const cat = styleFor(card);
                return (
                  <button
                    key={`${card.id}-${i}`}
                    type="button"
                    className={styles.option}
                    style={{ '--tone': cat.borderColor } as CSSProperties}
                    onClick={() => pick(i)}
                    aria-label={`Keep: ${card.title}`}
                  >
                    <span className={styles.optionCat}>
                      {toneLabelFor(card)}
                    </span>
                    <span className={styles.optionTitle}>
                      {assist && (
                        <>
                          <span
                            style={{
                              color: cat.iconColor,
                              ...categoryIconStyle(cat),
                            }}
                            aria-hidden="true"
                          >
                            {cat.icon}
                          </span>{' '}
                        </>
                      )}
                      {card.title}
                    </span>
                    <span className={styles.optionMult}>{card.mult}</span>
                    <span className={styles.optionDesc}>
                      {card.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {ui.canDecline && (
              <div className={styles.declineRow}>
                <button
                  type="button"
                  className={styles.decline}
                  onClick={() => dispatch({ type: 'BONUS_DECLINE' })}
                >
                  Decline — discard the ♣{ui.atCap ? ' (hand full)' : ''}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className={styles.replaceHint}>
              Hand full — tap a card below to replace it:
            </p>
            <div className={styles.replaceRow}>
              {state.bonusCards.map((card, i) => {
                const cat = styleFor(card);
                return (
                  <button
                    key={`${card.id}-${i}`}
                    type="button"
                    className={styles.replaceChip}
                    style={{ '--tone': cat.borderColor } as CSSProperties}
                    onClick={() => dispatch({ type: 'BONUS_REPLACE', oldIdx: i })}
                    aria-label={`Swap out: ${card.title}`}
                  >
                    <span className={styles.replaceTitle}>
                      {assist && (
                        <>
                          <span
                            style={{
                              color: cat.iconColor,
                              ...categoryIconStyle(cat),
                            }}
                            aria-hidden="true"
                          >
                            {cat.icon}
                          </span>{' '}
                        </>
                      )}
                      {card.title}
                    </span>
                    <span className={styles.replaceMult}>{card.mult}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
