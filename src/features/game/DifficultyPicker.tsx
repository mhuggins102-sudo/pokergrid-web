import { CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  BONUS_DECLINE_AT_CAP_BY_DIFFICULTY,
  CAN_PREVIEW_DECK_BY_DIFFICULTY,
  Difficulty,
  JOKERS_BY_DIFFICULTY,
  NO_DISCARDS_BY_DIFFICULTY,
  STARTER_BONUS_BY_DIFFICULTY,
  TARGET_BY_DIFFICULTY,
  UNDOS_BY_DIFFICULTY,
} from '../../game/rules';
import { difficultyColors } from '../../design/tokens';
import styles from './DifficultyPicker.module.css';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/** Free-play entry: pick a difficulty, see its rule set at a glance. */
export function DifficultyPicker() {
  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Free Play</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Pick a difficulty. Each one changes the target, jokers, and which
          safety nets you get.
        </p>
      </header>
      <div className={styles.cards}>
        {DIFFICULTIES.map(d => (
          <Link
            key={d}
            to={`/play?difficulty=${d}`}
            className={styles.card}
            style={{ '--difficulty-tone': difficultyColors[d] } as CSSProperties}
          >
            <span className={styles.name}>{d}</span>
            <span className={`text-value ${styles.target}`}>
              {TARGET_BY_DIFFICULTY[d]} target
            </span>
            <span className={styles.rules}>
              <span>{JOKERS_BY_DIFFICULTY[d]} joker{JOKERS_BY_DIFFICULTY[d] === 1 ? '' : 's'}</span>
              <span>
                {STARTER_BONUS_BY_DIFFICULTY[d]} starter bonus
                {STARTER_BONUS_BY_DIFFICULTY[d] === 1 ? '' : 'es'}
              </span>
              <span>{UNDOS_BY_DIFFICULTY[d]} undo{UNDOS_BY_DIFFICULTY[d] === 1 ? '' : 's'}</span>
              {CAN_PREVIEW_DECK_BY_DIFFICULTY[d] && <span>deck peek</span>}
              {NO_DISCARDS_BY_DIFFICULTY[d] && <span>no discards</span>}
              {!BONUS_DECLINE_AT_CAP_BY_DIFFICULTY[d] && (
                <span>no decline at cap</span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
