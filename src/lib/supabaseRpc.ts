// Supabase client + RPC wrappers for the Daily puzzle — ported from the
// original repo's src/ui/daily/supabase.ts. SAME project, schema, and
// RPCs as the original site, so both leaderboards stay unified.
//
// The anon key is intentionally public (Row Level Security is the
// access boundary); env vars override the baked-in defaults per
// environment.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DailyRecipe } from '../game/daily/recipe';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://lxriceppewliiyhunspj.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_9v-q2EDAAmt7e3qfUAmfAg_y5O4uvKe';

let client: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // No Supabase Auth — identity is the anonymous device-id passed
      // as an RPC parameter.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const isBackendConfigured = (): boolean => client !== null;

export class BackendUnavailableError extends Error {
  constructor() {
    super('Daily backend is not configured');
    this.name = 'BackendUnavailableError';
  }
}

const requireClient = (): SupabaseClient => {
  if (!client) throw new BackendUnavailableError();
  return client;
};

// ---------------- RPC payload shapes ----------------

export interface SubmitPlayArgs {
  deviceId: string;
  dateISO: string;
  score: number;
  won: boolean;
  recipe: DailyRecipe;
  usedUndo: boolean;
}

export interface RankSnapshot {
  rank: number; // 1-based
  total: number; // total submissions for the date
  score: number; // the player's score
  topPercent: number; // 1..100, smaller is better
}

export interface TopScoreEntry {
  rank: number;
  displayName: string;
  score: number;
  isOwn: boolean;
}

export interface DailyStatsSnapshot {
  median: number | null;
  total: number;
  winRatePct: number | null;
  topScores: TopScoreEntry[];
}

export interface HistogramBin {
  lo: number;
  hi: number;
  count: number;
}

export interface HistogramSnapshot {
  bins: HistogramBin[];
  median: number | null;
  min: number | null;
  max: number | null;
  total: number;
}

export interface PlayerRow {
  deviceId: string;
  handle: string | null;
  createdAt: string;
}

// ---------------- RPC wrappers ----------------

// Race a promise against a deadline. The timer is always cleared in
// finally — without that, the winning RPC leaves a live setTimeout
// behind for the full deadline. Exported for tests.
export const withTimeout = async <T>(
  p: PromiseLike<T>,
  ms: number,
  makeErr: () => Error
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(makeErr()), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

export class SubmitTimeoutError extends Error {
  constructor() {
    super('Submit RPC did not respond within 20s');
    this.name = 'SubmitTimeoutError';
  }
}

export class AlreadySubmittedError extends Error {
  constructor() {
    super('Daily already submitted for this device + date');
    this.name = 'AlreadySubmittedError';
  }
}

export class RankFetchTimeoutError extends Error {
  constructor() {
    super('Rank RPC did not respond within 10s');
    this.name = 'RankFetchTimeoutError';
  }
}

export const submitDailyPlay = async (args: SubmitPlayArgs): Promise<void> => {
  const c = requireClient();
  // 20s deadline so a hanging request surfaces as a retryable error
  // instead of leaving the rank panel stuck on "Submitting…".
  const rpcCall = c.rpc('submit_daily_play', {
    p_device_id: args.deviceId,
    p_date: args.dateISO,
    p_score: args.score,
    p_won: args.won,
    p_recipe: args.recipe,
    p_used_undo: args.usedUndo,
  });
  const { error } = await withTimeout(
    rpcCall,
    20_000,
    () => new SubmitTimeoutError()
  );
  if (error) {
    // Postgres unique_violation: the (device_id, date) constraint
    // makes retries idempotent — surface as a soft "already there".
    if (error.code === '23505') throw new AlreadySubmittedError();
    throw error;
  }
};

export const fetchRank = async (
  deviceId: string,
  dateISO: string
): Promise<RankSnapshot | null> => {
  const c = requireClient();
  const { data, error } = await withTimeout(
    c.rpc('daily_rank', { p_device_id: deviceId, p_date: dateISO }),
    10_000,
    () => new RankFetchTimeoutError()
  );
  if (error) throw error;
  // Empty array = no play submitted yet for this (device, date).
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  return {
    rank: row.rank,
    total: row.total,
    score: row.score,
    topPercent: row.top_percent,
  };
};

export const fetchHistogram = async (
  dateISO: string,
  bins: number = 15
): Promise<HistogramSnapshot> => {
  const c = requireClient();
  const { data, error } = await c.rpc('daily_histogram', {
    p_date: dateISO,
    p_bins: bins,
  });
  if (error) throw error;
  const h = (data ?? {}) as Partial<HistogramSnapshot>;
  return {
    bins: h.bins ?? [],
    median: h.median ?? null,
    min: h.min ?? null,
    max: h.max ?? null,
    total: h.total ?? 0,
  };
};

export const fetchDailyStats = async (
  deviceId: string,
  dateISO: string,
  limit: number = 10
): Promise<DailyStatsSnapshot> => {
  const c = requireClient();
  const { data, error } = await c.rpc('daily_top_scores', {
    p_device_id: deviceId,
    p_date: dateISO,
    p_limit: limit,
  });
  if (error) throw error;
  const raw = (data ?? {}) as {
    median?: number | null;
    total?: number;
    win_rate_pct?: number | null;
    top_scores?: Array<{
      rank: number;
      display_name: string;
      score: number;
      is_own: boolean;
    }>;
  };
  return {
    median: raw.median ?? null,
    total: raw.total ?? 0,
    winRatePct: raw.win_rate_pct ?? null,
    topScores: (raw.top_scores ?? []).map(r => ({
      rank: r.rank,
      displayName: r.display_name,
      score: r.score,
      isOwn: r.is_own,
    })),
  };
};

export class HandleTakenError extends Error {
  constructor() {
    super('Handle is already taken');
    this.name = 'HandleTakenError';
  }
}

export class HandleInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandleInvalidError';
  }
}

export const setHandleRemote = async (
  deviceId: string,
  handle: string | null
): Promise<void> => {
  const c = requireClient();
  const { error } = await c.rpc('set_player_handle', {
    p_device_id: deviceId,
    p_handle: handle ?? '',
  });
  if (error) {
    if (error.code === '23505') throw new HandleTakenError();
    // Custom 22023 codes are the RPC's validation errors.
    if (error.code === '22023') throw new HandleInvalidError(error.message);
    throw error;
  }
};

export const getPlayer = async (deviceId: string): Promise<PlayerRow | null> => {
  const c = requireClient();
  const { data, error } = await c.rpc('get_player', { p_device_id: deviceId });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  return {
    deviceId: row.device_id,
    handle: row.handle ?? null,
    createdAt: row.created_at,
  };
};
