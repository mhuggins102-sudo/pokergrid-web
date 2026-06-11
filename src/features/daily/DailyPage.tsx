import { currentDateISO } from '../../game/daily/seed';
import { DailyDay } from './DailyDay';

/** /daily — today's puzzle (UTC day, matching the original site). */
export function DailyPage() {
  return <DailyDay dateISO={currentDateISO()} />;
}
