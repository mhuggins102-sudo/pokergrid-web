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
  const playedToday = usePlaysStore(s => s.plays[today] !== undefined);
  if (playedToday) return <Navigate to="/daily/archive" replace />;
  return <DailyDay dateISO={today} />;
}
