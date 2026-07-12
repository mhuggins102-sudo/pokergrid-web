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
import { DailyIntroDesk } from './DailyIntroDesk';
import { useTier } from '../../app/useTier';
import { formatDailyDate } from './dailyDates';
import styles from './DailyDay.module.css';

/**
 * One daily date, end to end: already played → the stored result;
 * otherwise an intro card (the day's recipe at a glance) into the
 * seeded game. Every player worldwide gets the same deal for a date.
 */
export function DailyDay({ dateISO }: { dateISO: string }) {
  // Non-phone tiers (≥768px) render the newspaper-masthead intro from
  // the desktop redesign instead of the phone intro card. The already-
  // played view-only rehydrate stays DESKTOP-only (tablet keeps the
  // static result until phase 5's tablet game layout), so it reads the
  // narrower `isDesktop`; the intro fork + explainer-skip use the tier.
  const tier = useTier();
  const isDesktop = tier === 'desktop';
  const play = usePlaysStore(s => s.plays[dateISO]);
  // Entry-time snapshot, NOT a live check: finishing the puzzle during
  // this visit saves the play, and swapping to the static view then
  // would unmount the live result screen mid-look — including the 🏆
  // callout for any achievement the finish just earned. Only a date
  // that was already played when we arrived shows the static replay;
  // callers remount per date (key), so revisits still get it.
  const [playedOnEntry] = useState(
    () => usePlaysStore.getState().plays[dateISO] !== undefined
  );
  const [started, setStarted] = useState(false);
  // First-encounter twist explainer: opens over the board right after
  // Play, once per twist per device.
  const [twistInfoOpen, setTwistInfoOpen] = useState(false);

  if (playedOnEntry && play) {
    // Desktop: re-hydrate the stored final state into a view-only
    // session so the archive's "View full result" opens the SAME
    // three-column finished-game presentation a live finish leaves
    // behind (board explorable, dock offers Show result, the result
    // dialog one click away). viewOnly suppresses every recording
    // side effect. Mobile keeps the static result page.
    if (isDesktop) {
      return (
        <GameSessionProvider
          mode={{ kind: 'daily', dateISO, recipe: play.recipe }}
          initialState={play.state}
        >
          <GameScreen onReplay={() => {}} />
        </GameSessionProvider>
      );
    }
    return <DailyResultStatic play={play} />;
  }

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

  const startPlay = () => {
    // Non-phone tiers skip the first-encounter explainer: the masthead
    // intro they just clicked through already presented the twist in
    // full. It does NOT mark the twist seen — a later phone visit
    // (whose flow lacks the intro panel) still gets its one-time
    // explainer.
    if (tier === 'phone' && twist && !twistSeen(twist.id))
      setTwistInfoOpen(true);
    setStarted(true);
  };

  if (tier !== 'phone') {
    return (
      <DailyIntroDesk
        dateISO={dateISO}
        recipe={recipe}
        twist={twist}
        twistGoal={twistGoal}
        target={target}
        onPlay={startPlay}
      />
    );
  }

  return (
    <section className={styles.intro}>
      <div className={styles.card}>
        <h1 className="text-section">Daily puzzle</h1>
        <span className={styles.date}>{formatDailyDate(dateISO)}</span>
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
            onClick={startPlay}
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
