import {
  AlreadySubmittedError,
  BackendUnavailableError,
  SubmitTimeoutError,
  withTimeout,
} from '../../../lib/supabaseRpc';
import {
  DrainDeps,
  PendingSubmit,
  drainGuarded,
  drainPendingSubmitsOnce,
  resetDrainGuardForTests,
  useQueueStore,
} from '../sync/queue';

const entry = (dateISO: string): PendingSubmit => ({
  deviceId: 'dev-1',
  dateISO,
  score: 123,
  won: false,
  recipe: { difficulty: 'easy' },
  usedUndo: false,
  enqueuedAt: Date.now(),
});

// In-memory deps over a plain array — mirrors the store contract.
const memDeps = (initial: PendingSubmit[], submit: DrainDeps['submit']) => {
  let pending = [...initial];
  return {
    deps: {
      getPendingSubmits: () => pending,
      removePendingSubmit: (deviceId: string, dateISO: string) => {
        pending = pending.filter(
          e => !(e.deviceId === deviceId && e.dateISO === dateISO)
        );
      },
      submit,
    } satisfies DrainDeps,
    pendingNow: () => pending,
  };
};

beforeEach(() => {
  resetDrainGuardForTests();
  useQueueStore.setState({ pending: [] });
});

describe('queue store', () => {
  it('enqueue is idempotent per (device, date)', () => {
    const s = useQueueStore.getState();
    s.enqueue(entry('2026-06-11'));
    s.enqueue(entry('2026-06-11'));
    s.enqueue(entry('2026-06-10'));
    expect(useQueueStore.getState().pending).toHaveLength(2);
  });
});

describe('drainPendingSubmitsOnce', () => {
  it('offline → online: a failed submit stays queued, the next drain lands it', async () => {
    let online = false;
    const { deps, pendingNow } = memDeps([entry('2026-06-11')], async () => {
      if (!online) throw new Error('network down');
    });

    const first = await drainPendingSubmitsOnce(deps);
    expect(first.anySubmitted).toBe(false);
    expect(first.lastError?.dateISO).toBe('2026-06-11');
    expect(pendingNow()).toHaveLength(1); // still durable

    online = true;
    const second = await drainPendingSubmitsOnce(deps);
    expect(second.anySubmitted).toBe(true);
    expect(second.lastError).toBeNull();
    expect(pendingNow()).toHaveLength(0);
  });

  it('AlreadySubmittedError drops the entry and counts as submitted', async () => {
    const { deps, pendingNow } = memDeps([entry('2026-06-11')], async () => {
      throw new AlreadySubmittedError();
    });
    const res = await drainPendingSubmitsOnce(deps);
    expect(res.anySubmitted).toBe(true);
    expect(pendingNow()).toHaveLength(0);
  });

  it('a timeout is transient: entry survives for the next drain', async () => {
    const { deps, pendingNow } = memDeps([entry('2026-06-11')], async () => {
      throw new SubmitTimeoutError();
    });
    const res = await drainPendingSubmitsOnce(deps);
    expect(res.anySubmitted).toBe(false);
    expect(res.lastError?.error).toBeInstanceOf(SubmitTimeoutError);
    expect(pendingNow()).toHaveLength(1);
  });

  it('BackendUnavailableError stops the pass without dropping entries', async () => {
    const { deps, pendingNow } = memDeps(
      [entry('2026-06-10'), entry('2026-06-11')],
      async () => {
        throw new BackendUnavailableError();
      }
    );
    const res = await drainPendingSubmitsOnce(deps);
    expect(res.anySubmitted).toBe(false);
    expect(pendingNow()).toHaveLength(2);
  });
});

describe('drainGuarded', () => {
  it('concurrent callers share one in-flight drain and a rerun is coalesced', async () => {
    let submits = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>(r => {
      release = r;
    });
    const { deps } = memDeps([entry('2026-06-11')], async () => {
      submits++;
      await gate;
    });

    const p1 = drainGuarded(deps);
    const p2 = drainGuarded(deps); // lands mid-drain → sets rerun
    expect(p2).toBe(p1);
    release();
    const res = await p1;
    expect(res.anySubmitted).toBe(true);
    // First pass (1 submit) + the coalesced rerun over the now-empty
    // queue (0 submits).
    expect(submits).toBe(1);
  });
});

describe('withTimeout', () => {
  it('rejects after the deadline and clears its timer on the fast path', async () => {
    vi.useFakeTimers();
    try {
      const slow = new Promise(() => {});
      const racing = withTimeout(slow, 1000, () => new SubmitTimeoutError());
      const assertion = expect(racing).rejects.toBeInstanceOf(SubmitTimeoutError);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;

      // Fast path: the timer must not linger after the promise wins.
      const fast = withTimeout(Promise.resolve('ok'), 1000, () => new Error());
      await expect(fast).resolves.toBe('ok');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
