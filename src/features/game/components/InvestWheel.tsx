import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Button, Sheet } from '../../../design/primitives';
import { HandRank } from '../../../game/hands';
import { INVEST_HANDS } from '../../../game/invest';
import { HAND_LABEL } from '../handLabels';
import { useGameSession } from '../GameSessionProvider';
import styles from './InvestWheel.module.css';

const ITEM_H = 44; // px per reel row
const VISIBLE = 5; // rows visible in the window
const SPIN_S = 2.4; // spin duration

/**
 * Bull Market ♣ invest reveal: a slot-machine reel spins through the
 * hand types and lands on the one the reducer already picked, then shows
 * the boost and a Continue button (which applies it + draws the next
 * card). Dismissible only via Continue.
 */
export function InvestWheel({
  hand,
  amount,
}: {
  hand: HandRank;
  amount: number;
}) {
  const { dispatch } = useGameSession();

  // A long reel that cycles the ten hands several times, ending on the
  // chosen hand so the spin decelerates onto it.
  const reel = useMemo(() => {
    const out: HandRank[] = [];
    for (let i = 0; i < 6; i++) out.push(...INVEST_HANDS);
    out.push(hand);
    return out;
  }, [hand]);

  const targetIndex = reel.length - 1;
  // Land the target row under the centered highlight band.
  const finalY = -(targetIndex - (VISIBLE - 1) / 2) * ITEM_H;

  return (
    <Sheet open onClose={() => {}} dismissible={false} title="♣ Invest">
      <div className={styles.body}>
        <p className="text-body">The wheel picks a hand to boost…</p>
        <div className={styles.window} style={{ height: VISIBLE * ITEM_H }}>
          <div className={styles.highlight} style={{ height: ITEM_H }} />
          <motion.div
            className={styles.reel}
            initial={{ y: 0 }}
            animate={{ y: finalY }}
            transition={{ duration: SPIN_S, ease: [0.1, 0.7, 0.1, 1] }}
          >
            {reel.map((h, i) => (
              <div key={i} className={styles.reelItem} style={{ height: ITEM_H }}>
                {HAND_LABEL[h]}
              </div>
            ))}
          </motion.div>
        </div>
        <motion.p
          className={styles.result}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: SPIN_S }}
        >
          <strong>{HAND_LABEL[hand]}</strong> base value +{amount}!
        </motion.p>
        <Button
          variant="primary"
          onClick={() => dispatch({ type: 'RESOLVE_CLUB_INVEST' })}
        >
          Continue
        </Button>
      </div>
    </Sheet>
  );
}
