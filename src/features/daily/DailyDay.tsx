import { CSSProperties, useState } from 'react';
import { Link } from 'react-router';
import { recipeFor } from '../../game/daily/recipe';
import { dailyTargetFor } from '../../game/daily/recipe';
import { seedForDate } from '../../game/daily/seed';
import { findChallenge } from '../../game/challenges';
import { difficultyColors } from '../../design/tokens';
import { Button, Sheet } from '../../design/primitives';
import { markTwistSeen, twistSeen } from './twistSeen';
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
  // First-encounter twist explainer: opens over the board right after
  // Play, once per twist per device.
  const [twistInfoOpen, setTwistInfoOpen] = useState(false);

  if (play) return <DailyResultStatic play={play} />;

  const recipe = recipeFor(dateISO);
  const twist = recipe.twist ? findChallenge(recipe.twist) : null;
  const target = dailyTargetFor(recipe.difficulty, recipe.twist);

  // Challenge goal copy embeds the challenge's own score target; swap
  // in today's (difficulty-adjusted) daily target so the numbers agree.
  const twistGoal = twist
    ? twist.goal.replace(/^Score \d+\+ points/, `Score ${target}+ points`)
    : null;

  if (started) {
    return (
      <GameSessionProvider
        mode={{ kind: 'daily', dateISO, recipe }}
        seed={seedForDate(dateISO)}
      >
        <GameScreen onReplay={() => {}} />
        {twist && (
          <Sheet
            open={twistInfoOpen}
            onClose={() => {
              markTwistSeen(twist.id);
              setTwistInfoOpen(false);
            }}
            title={`Today's twist: ${twist.name}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="text-body">{twistGoal}</p>
              <p
                className="text-label"
                style={{ color: 'var(--ink-3)' }}
              >
                Daily twists come from the Challenges list — you can re-read
                any of them there. This explainer shows once per twist.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  markTwistSeen(twist.id);
                  setTwistInfoOpen(false);
                }}
              >
                Got it
              </Button>
            </div>
          </Sheet>
        )}
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
        <div className={styles.buttons}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              if (twist && !twistSeen(twist.id)) setTwistInfoOpen(true);
              setStarted(true);
            }}
          >
            Play
          </Button>
          <Link to="/daily/archive">
            <Button variant="secondary" size="lg">
              Archive
            </Button>
          </Link>
        </div>
      </div>
      <p className={styles.note}>
        One play per day — the same deal for every player worldwide. One
        free undo.
      </p>
    </section>
  );
}
