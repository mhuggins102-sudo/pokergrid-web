import { useQuery } from '@tanstack/react-query';
import {
  fetchDailyStats,
  fetchHistogram,
  fetchRank,
  isBackendConfigured,
} from '../../../lib/supabaseRpc';
import { getOrCreateDeviceId } from './deviceId';
import { useQueueStore } from './queue';

/**
 * The player's rank for a date. While this device's submission is
 * still queued (offline, backend hiccup) the query polls so the rank
 * appears as soon as a drain lands it.
 */
export const useDailyRank = (dateISO: string) => {
  const pendingForDate = useQueueStore(s =>
    s.pending.some(p => p.dateISO === dateISO)
  );
  const deviceId = getOrCreateDeviceId();
  return useQuery({
    queryKey: ['daily-rank', dateISO, deviceId],
    queryFn: () => fetchRank(deviceId, dateISO),
    enabled: isBackendConfigured(),
    // null data = server doesn't have the play yet; keep checking
    // while our queue still holds it. The submit RPC and this first
    // rank fetch fire concurrently, so the initial fetch almost always
    // races ahead of the write and returns null. The post-submit
    // queryClient.invalidateQueries() is then coalesced into that
    // already-in-flight fetch and doesn't trigger a fresh one — so the
    // rank only appeared on the next poll. A short poll bounds that gap
    // (was 15s, which is the "up to 15 seconds" delay) to ~2s; once the
    // real rank lands, data is non-null and polling stops.
    refetchInterval: q =>
      pendingForDate || q.state.data === null ? 2_000 : false,
  });
};

/**
 * Rank for an archive row. Shares the cache key with useDailyRank (so a
 * fresh result-screen fetch feeds the archive for free) but never polls:
 * old local-only plays return null forever, and a page of rows polling
 * every 2s would hammer the backend. Long staleTime — final ranks for
 * past dates barely move.
 */
export const useArchiveRank = (dateISO: string) => {
  const deviceId = getOrCreateDeviceId();
  return useQuery({
    queryKey: ['daily-rank', dateISO, deviceId],
    queryFn: () => fetchRank(deviceId, dateISO),
    enabled: isBackendConfigured(),
    staleTime: 5 * 60_000,
  });
};

export const useDailyStats = (dateISO: string, open: boolean) => {
  const deviceId = getOrCreateDeviceId();
  return useQuery({
    queryKey: ['daily-stats', dateISO, deviceId],
    queryFn: () => fetchDailyStats(deviceId, dateISO),
    enabled: open && isBackendConfigured(),
  });
};

export const useDailyHistogram = (dateISO: string, open: boolean) =>
  useQuery({
    queryKey: ['daily-histogram', dateISO],
    queryFn: () => fetchHistogram(dateISO),
    enabled: open && isBackendConfigured(),
  });
