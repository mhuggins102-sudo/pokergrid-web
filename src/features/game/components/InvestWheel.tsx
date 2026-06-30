import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Button, Sheet } from '../../../design/primitives';
import { HandRank } from '../../../game/hands';
import { INVEST_HANDS } from '../../../game/invest';
import { sfxWheelSpin } from '../../../lib/sfx';
import { HAND_LABEL } from '../handLabels';
import { useGameSession } from '../GameSessionProvider';
import { useSettingsStore } from '../../settings/settingsStore';
import styles from './InvestWheel.module.css';

const ITEM_H = 48; // px per reel row
const VISIBLE = 5; // rows visible in the window
const CENTER = (VISIBLE - 1) / 2;
const SPIN_S = 2.6; // spin duration

/**
 * Bull Market ♣ invest reveal: a slot-machine reel spins the hand types
 * past a pointer and decelerates onto the one the reducer picked, with a
 * matching click track. When it stops it names the landed hand and the
 * boost; Continue applies it and draws the next card.
 */
export function InvestWheel({
  hand,
  amount,
}: {
  hand: HandRank;
  amount: number;
}) {
  const { dispatch } = useGameSession();
  const sounds = useSettingsStore(s => s.sounds);
  const [landed, setLanded] = useState(false);
  const startedRef = useRef(false);

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
  const finalY = -(targetIndex - CENTER) * ITEM_H;
  const rowsScrolled = targetIndex - CENTER;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (sounds) sfxWheelSpin(SPIN_S, rowsScrolled);
    const t = window.setTimeout(() => setLanded(true), SPIN_S * 1000);
    return () => window.clearTimeout(t);
  }, [sounds, rowsScrolled]);

  return (
    <Sheet open onClose={() => {}} dismissible={false} title="♣ Invest">
      <div className={styles.body}>
        <p className="text-body">Spinning for a hand to boost…</p>
        <div className={styles.window} style={{ height: VISIBLE * ITEM_H }}>
          <span className={styles.pointer} aria-hidden="true">
            ▶
          </span>
          <div className={styles.highlight} style={{ height: ITEM_H }} />
          <motion.div
            className={styles.reel}
            initial={{ y: 0 }}
            animate={{ y: finalY }}
            transition={{ duration: SPIN_S, ease: [0.1, 0.7, 0.1, 1] }}
          >
            {reel.map((h, i) => (
              <div
                key={i}
                className={`${styles.reelItem} ${
                  landed && i === targetIndex ? styles.reelItemWon : ''
                }`}
                style={{ height: ITEM_H }}
              >
                {HAND_LABEL[h]}
              </div>
            ))}
          </motion.div>
        </div>

        <div className={styles.result}>
          {landed ? (
            <motion.div
              className={styles.resultInner}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >
              <span className={styles.resultHand}>{HAND_LABEL[hand]}</span>
              <span className={styles.resultAmount}>base value +{amount}</span>
            </motion.div>
          ) : (
            <span className={styles.spinning}>Spinning…</span>
          )}
        </div>

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
