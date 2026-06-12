import { CSSProperties } from 'react';
import { Button } from '../primitives';
import { CardFace } from '../../features/game/components/CardFace';
import { Card } from '../../game/cards';
import styles from './DockGalleryPage.module.css';

const DRAWN: Card = { kind: 'standard', rank: 'Q', suit: 'H' };

const card = (size: number) => (
  <div className={styles.cardBox} style={{ '--card': `${size}px` } as CSSProperties}>
    <CardFace card={DRAWN} />
  </div>
);

/**
 * /design/dock — throwaway prototypes for the in-game bottom bar.
 * Three from-scratch arrangements of the same five elements (drawn
 * card, deck count, Peek, Place, suit perk, Discard), inert and
 * phone-framed for side-by-side judging. Delete once one wins.
 */
export function DockGalleryPage() {
  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Dock prototypes</h1>
        <p className={styles.note}>
          Static mockups at phone width — nothing here is wired up.
        </p>
      </header>

      <article className={styles.concept}>
        <h2 className="text-section">A · Hand stack</h2>
        <p className={styles.note}>
          The card is the hero — nearly twice today&apos;s size — with the
          actions stacked by importance beside it: commit on top, the two
          spends below. Tallest of the three (≈112px), costing the board a
          little height on short phones. The targeting banner would replace
          the action stack.
        </p>
        <div className={styles.phone}>
          <div className={`${styles.dock} ${styles.aGrid}`}>
            <div className={styles.aCardCol}>
              {card(92)}
              <span className={styles.meta}>
                52 left · <span className={styles.peek}>Peek</span>
              </span>
            </div>
            <div className={styles.aActions}>
              <Button variant="primary" className={styles.aPlace}>
                Place
              </Button>
              <div className={styles.aRow}>
                <Button variant="secondary" className={styles.aHalf}>
                  ♥ Swap
                </Button>
                <Button variant="secondary" className={styles.aHalf}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className={styles.concept}>
        <h2 className="text-section">B · Slim strip</h2>
        <p className={styles.note}>
          Everything on one ≈60px line — the shortest dock possible, so the
          board gets the most room of any option. Place keeps primary color
          but is no longer the biggest target; the deck meta goes vertical
          beside the card.
        </p>
        <div className={styles.phone}>
          <div className={`${styles.dock} ${styles.bRow}`}>
            {card(48)}
            <span className={styles.bMeta}>
              <span>52 left</span>
              <span className={styles.peek}>Peek</span>
            </span>
            <span className={styles.bSpacer} />
            <Button variant="secondary" size="sm">
              ♥ Swap
            </Button>
            <Button variant="secondary" size="sm">
              Discard
            </Button>
            <Button variant="primary" className={styles.bPlace}>
              Place
            </Button>
          </div>
        </div>
      </article>

      <article className={styles.concept}>
        <h2 className="text-section">C · Center stage</h2>
        <p className={styles.note}>
          Symmetric: the card front and center with its two &quot;spend&quot;
          fates flanking it — swap left, discard right — and the full-width
          Place beneath as the default. Reads like holding a card over the
          table; deck meta becomes a caption. ≈124px tall.
        </p>
        <div className={styles.phone}>
          <div className={`${styles.dock} ${styles.cStage}`}>
            <div className={styles.cRow}>
              <Button variant="secondary" className={styles.cSide}>
                ♥ Swap
              </Button>
              <div className={styles.cCardCol}>
                {card(76)}
                <span className={styles.meta}>
                  52 left · <span className={styles.peek}>Peek</span>
                </span>
              </div>
              <Button variant="secondary" className={styles.cSide}>
                Discard
              </Button>
            </div>
            <Button variant="primary" className={styles.cPlace}>
              Place
            </Button>
          </div>
        </div>
      </article>
    </section>
  );
}
