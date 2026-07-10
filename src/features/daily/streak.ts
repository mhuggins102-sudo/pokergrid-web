import { dayMs, toISO, toUTC } from './dailyDates';
import { PLAYS_STORE_NAME, PLAYS_STORE_VERSION } from './sync/playsStoreKey';

/*
 * The daily streak, per the desktop mockups (Home hero chip + the
 * Daily intro's streak box, design-refs/desktop/{Home,Daily}.dc.html):
 *
 *  - A streak day is a COMPLETED daily (a playsStore entry) — winning
 *    is not required; the mockup's week model only knows played/not.
 *  - The streak is the run of consecutive calendar days ending TODAY
 *    (if already played) or YESTERDAY (today still open): the mockup
 *    shows "6-day streak · Play today to keep it alive" with six
 *    played days and today pending, so an unplayed today does NOT
 *    break the streak until the day is over.
 *  - A missed calendar day anywhere earlier ends the run.
 *  - The week view covers the 7 days ending today, oldest first —
 *    played (accent dot), today-pending (warn ring), missed (hollow).
 *
 * All date math stays in the daily system's own domain: ISO date keys
 * on the shared UTC day (currentDateISO), advanced by whole-day
 * arithmetic — never `new Date('YYYY-MM-DD')` parsing.
 *
 * ENGINE-FREE on purpose: this module never imports playsStore (which
 * pulls the whole engine via bonusCards) — callers hand it any
 * plays-shaped map. The Home screen feeds it readPlayedDatesLite();
 * the daily pages feed it the live store map via useDailyStreak.
 */

/** Anything keyed by played dateISO works — the live DailyPlaysMap or
 *  the lite raw-storage snapshot. */
export type PlayedDates = Record<string, unknown>;

export interface StreakWeekDay {
  dateISO: string;
  /** Weekday initial, mockup style: Su M Tu W Th F Sa. */
  label: string;
  played: boolean;
  isToday: boolean;
}

export interface DailyStreak {
  /** Consecutive played days ending today (or yesterday, see above). */
  current: number;
  playedToday: boolean;
  /** A live streak that today's puzzle hasn't extended yet. */
  atRisk: boolean;
  /** Longest run in the plays map (see bestDailyStreak for persisted). */
  best: number;
  /** The 7 days ending today, oldest → today. */
  week: StreakWeekDay[];
}

const WEEKDAY_LABEL = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

export const dailyStreak = (
  plays: PlayedDates,
  todayISO: string
): DailyStreak => {
  const today = toUTC(todayISO);
  const playedToday = plays[todayISO] !== undefined;

  let current = 0;
  for (
    let t = playedToday ? today : today - dayMs;
    plays[toISO(t)] !== undefined;
    t -= dayMs
  ) {
    current += 1;
  }

  // Longest run anywhere in the map (the map is the full local record,
  // so this is the all-time best as far as this device knows).
  let best = current;
  let run = 0;
  let prev: number | null = null;
  for (const iso of Object.keys(plays).sort()) {
    const t = toUTC(iso);
    run = prev !== null && t - prev === dayMs ? run + 1 : 1;
    prev = t;
    if (run > best) best = run;
  }

  const week: StreakWeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = today - i * dayMs;
    const iso = toISO(t);
    week.push({
      dateISO: iso,
      label: WEEKDAY_LABEL[new Date(t).getUTCDay()],
      played: plays[iso] !== undefined,
      isToday: i === 0,
    });
  }

  return {
    current,
    playedToday,
    atRisk: current > 0 && !playedToday,
    best,
    week,
  };
};

// ---- Persisted best (high-water mark) ----
// The plays map itself is persisted, but it can be reset (Settings →
// Reset progress keeps stats-style bests elsewhere) or trimmed by a
// future sync — the best streak survives as its own tiny record, in
// the same plain-localStorage style as twistSeen/tutorialSeen.

const BEST_KEY = 'pokergrid:daily:best-streak:v1';

const readBest = (): number => {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
};

/** Fold `computed` into the persisted high-water mark and return the
 *  all-time best. */
export const bestDailyStreak = (computed: number): number => {
  const stored = readBest();
  if (computed > stored) {
    try {
      localStorage.setItem(BEST_KEY, String(computed));
    } catch {
      // storage unavailable — the computed value still displays
    }
    return computed;
  }
  return stored;
};

/** Engine-free played-dates snapshot straight from persisted storage
 *  (the dailyWinsLite pattern) — for the Home screen, which stays out
 *  of the engine chunk. */
export const readPlayedDatesLite = (): PlayedDates => {
  try {
    const raw = localStorage.getItem(PLAYS_STORE_NAME);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      state?: { plays?: Record<string, unknown> };
      version?: number;
    };
    // A future schema bump means this reader no longer understands the
    // shape — show no streak rather than a wrong one.
    if ((parsed.version ?? 0) !== PLAYS_STORE_VERSION) return {};
    return parsed.state?.plays ?? {};
  } catch {
    return {};
  }
};
