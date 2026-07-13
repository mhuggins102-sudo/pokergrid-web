import { useState } from 'react';
import { recipeFor } from '../../game/daily/recipe';
import { dailyTargetFor } from '../../game/daily/recipe';
import { seedForDate } from '../../game/daily/seed';
import { findChallenge } from '../../game/challenges';
import { markTwistSeen, twistSeen } from './twistSeen';
import { GameSessionProvider } from '../game/GameSessionProvider';
import { GameScreen } from '../game/GameScreen';
import { usePlaysStore } from './sync/playsStore';
import { DailyIntro } from './DailyIntro';

/**
 * One daily date, end to end: already played → the stored result;
 * otherwise the masthead intro (the day's recipe at a glance) into the
 * seeded game. Every player worldwide gets the same deal for a date.
 */
export function DailyDay({ dateISO }: { dateISO: string }) {
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

  if (playedOnEntry && play) {
    // Re-hydrate the stored final state into a view-only session at
    // EVERY tier so "view result" opens the SAME finished-game
    // presentation a live finish leaves behind: desktop lands on the
    // three-column view, phone / tablet-portrait on the streamlined
    // column (finished board explorable, dock offers Show result, the
    // DesktopResultDialog one click away). viewOnly suppresses every
    // recording side effect.
    return (
      <GameSessionProvider
        mode={{ kind: 'daily', dateISO, recipe: play.recipe }}
        initialState={play.state}
      >
        <GameScreen onReplay={() => {}} />
      </GameSessionProvider>
    );
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
      </GameSessionProvider>
    );
  }

  const startPlay = () => {
    // The masthead intro just presented the twist in full, so the
    // one-time explainer sheet is gone at every tier (phase 3 — "intro
    // shown → skip explainer"). The twistSeen bookkeeping stays live:
    // Play records the twist as seen, same as dismissing the old sheet.
    if (twist && !twistSeen(twist.id)) markTwistSeen(twist.id);
    setStarted(true);
  };

  return (
    <DailyIntro
      dateISO={dateISO}
      recipe={recipe}
      twist={twist}
      twistGoal={twistGoal}
      target={target}
      onPlay={startPlay}
    />
  );
}
