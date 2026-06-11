import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { recipeFor } from '../../game/daily/recipe';
import { dailyTargetFor } from '../../game/daily/recipe';
import { seedForDate } from '../../game/daily/seed';
import { findChallenge } from '../../game/challenges';
import { difficultyColors } from '../../design/tokens';
import { Button } from '../../design/primitives';
import { GameSessionProvider } from '../game/GameSessionProvider';
import { GameScreen } from '../game/GameScreen';
import { usePlaysStore } from './sync/playsStore';
import { DailyResultStatic } from './DailyResultStatic';
import styles from './DailyDay.module.css';

/**
 * One daily date, end to end: already played → the stored result;
 * otherwise an intro card (the day's recipe at a glance) into the
 * seeded game. Every player worldwide gets the same deal for a date.
 */
export function DailyDay({ dateISO }: { dateISO: string }) {
  const play = usePlaysStore(s => s.plays[dateISO]);
  const [started, setStarted] = useState(false);

  if (play) return <DailyResultStatic play={play} />;

  const recipe = recipeFor(dateISO);
  const twist = recipe.twist ? findChallenge(recipe.twist) : null;
  const target = dailyTargetFor(recipe.difficulty, recipe.twist);

  if (started) {
    return (
      <GameSessionProvider
        mode={{ kind: 'daily', dateISO, recipe }}
        seed={seedForDate(dateISO)}
      >
        <GameScreen onReplay={() => {}} />
      </GameSessionProvider>
    );
  }

  return (
    <section className={styles.intro}>
      <div className={styles.card}>
        <h1 className="text-section">Daily puzzle</h1>
        <span className={styles.date}>{dateISO}</span>
        <div className={styles.meta}>
          <span
            className={styles.diffChip}
            style={
              {
                '--difficulty-tone': difficultyColors[recipe.difficulty],
              } as CSSProperties
            }
          >
            {recipe.difficulty}
          </span>
          {twist && <span className={styles.twistChip}>{twist.name}</span>}
        </div>
        <span className={`text-value ${styles.target}`}>target {target}</span>
        {twist && <p className={styles.twistGoal}>{twist.synopsis}</p>}
        <Button variant="primary" size="lg" onClick={() => setStarted(true)}>
          Play
        </Button>
      </div>
      <p className={styles.note}>
        One play per day — the same deal for every player worldwide. One
        free undo.{' '}
        <Link to="/daily/archive">Browse the archive</Link>
      </p>
    </section>
  );
}
