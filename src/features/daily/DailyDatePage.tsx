import { Navigate, useParams } from 'react-router';
import { currentDateISO, parseDateISO } from '../../game/daily/seed';
import { DailyDay } from './DailyDay';

/**
 * /daily/:date — a specific date: the stored result if played, the
 * playable puzzle otherwise. Future dates bounce to today.
 */
export function DailyDatePage() {
  const { date } = useParams<'date'>();
  const today = currentDateISO();
  if (!date || parseDateISO(date) === null || date > today) {
    return <Navigate to="/daily" replace />;
  }
  return <DailyDay dateISO={date} />;
}
