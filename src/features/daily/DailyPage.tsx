import { useState } from 'react';
import { Navigate } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { usePlaysStore } from './sync/playsStore';
import { DailyDay } from './DailyDay';

/**
 * /daily — today's puzzle (UTC day, matching the original site). Once
 * today is played there's nothing left to do here, so the route drops
 * straight into the archive; today's result stays reachable from its
 * archive row.
 */
export function DailyPage() {
  const today = currentDateISO();
  // Entry-time snapshot, NOT a live subscription: finishing the puzzle
  // during this visit records the play, and a reactive check would
  // redirect right over the end-of-game result screen. Navigating away
  // and back remounts the route, so revisits still go to the archive.
  const [playedOnEntry] = useState(
    () => usePlaysStore.getState().plays[today] !== undefined
  );
  if (playedOnEntry) return <Navigate to="/daily/archive" replace />;
  return <DailyDay dateISO={today} />;
}
