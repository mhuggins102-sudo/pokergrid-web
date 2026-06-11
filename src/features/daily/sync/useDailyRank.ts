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
    // while our queue still holds it.
    refetchInterval: q =>
      pendingForDate || q.state.data === null ? 15_000 : false,
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
