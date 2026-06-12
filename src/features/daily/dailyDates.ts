import { currentDateISO } from '../../game/daily/seed';
import { DailyPlay } from './sync/playsStore';

// The first daily ever published (carried over from the original site)
// — the archive runs all the way back to it.
export const DAILY_LAUNCH_ISO = '2026-05-01';

const dayMs = 86_400_000;

const toUTC = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const toISO = (utc: number): string => new Date(utc).toISOString().slice(0, 10);

/** Every published date from `todayISO` back to `earliestISO`, newest first. */
export const datesBack = (todayISO: string, earliestISO: string): string[] => {
  const base = toUTC(todayISO);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const iso = toISO(base - i * dayMs);
    if (iso < earliestISO) break;
    out.push(iso);
  }
  return out;
};

/**
 * The next daily worth playing after finishing `fromISO`: scan
 * backwards from the day before it (archive-grinding order); if
 * everything older is done, fall forward to any unplayed date up to
 * today (so finishing an old archive day still surfaces today's
 * puzzle). Null when every published daily is played.
 */
export const nextIncompleteDaily = (
  fromISO: string,
  plays: Record<string, DailyPlay>
): string | null => {
  const today = currentDateISO();
  const from = toUTC(fromISO);
  for (let t = from - dayMs; toISO(t) >= DAILY_LAUNCH_ISO; t -= dayMs) {
    const iso = toISO(t);
    if (!plays[iso]) return iso;
  }
  for (let t = toUTC(today); t > from; t -= dayMs) {
    const iso = toISO(t);
    if (!plays[iso]) return iso;
  }
  return null;
};
