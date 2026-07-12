import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider } from '../../../design/primitives';
import { HandleTakenError, setHandleRemote } from '../../../lib/supabaseRpc';
import { KEY_HANDLE } from '../sync/deviceId';
import { setLocalHandle, useHandle } from '../sync/handleStore';
import { queryClient } from '../sync/sync';
import { HandleEditor } from '../RankPanel';

vi.mock('../../../lib/supabaseRpc', async importOriginal => ({
  ...(await importOriginal<object>()),
  isBackendConfigured: () => true,
  setHandleRemote: vi.fn(),
}));

/** A stand-in for every synthesized "own row" name read. */
const HandleProbe = () => (
  <span data-testid="probe">{useHandle() ?? '(anon)'}</span>
);

const renderEditor = () =>
  render(
    <ToastProvider>
      <HandleEditor />
      <HandleProbe />
    </ToastProvider>
  );

const saveAs = (name: string) => {
  fireEvent.change(screen.getByLabelText('Screen name'), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(setHandleRemote).mockReset();
});

describe('first-time handle save (leaderboard freshness)', () => {
  it('persists locally, re-renders useHandle consumers, and refetches name-bearing queries', async () => {
    vi.mocked(setHandleRemote).mockResolvedValue(undefined);
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    renderEditor();
    expect(screen.getByTestId('probe').textContent).toBe('(anon)');
    saveAs('gridshark');

    await waitFor(() =>
      expect(localStorage.getItem(KEY_HANDLE)).toBe('gridshark')
    );
    // The remote rename RPC got the trimmed name…
    expect(setHandleRemote).toHaveBeenCalledWith(
      expect.any(String),
      'gridshark'
    );
    // …every reactive reader renamed at once…
    expect(screen.getByTestId('probe').textContent).toBe('gridshark');
    // …and the server-rendered display names were marked stale (the
    // rename applies to ALL past scores at read time).
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-stats'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-rank'] });
    invalidate.mockRestore();
  });

  it('leaves local state and caches untouched when the server rejects the name', async () => {
    vi.mocked(setHandleRemote).mockRejectedValue(new HandleTakenError());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderEditor();
    saveAs('taken');

    await screen.findByText('That name is taken — try another.');
    expect(localStorage.getItem(KEY_HANDLE)).toBeNull();
    expect(screen.getByTestId('probe').textContent).toBe('(anon)');
    expect(invalidate).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });

  it('setLocalHandle notifies subscribers on clear too', async () => {
    localStorage.setItem(KEY_HANDLE, 'oldname');
    render(<HandleProbe />);
    expect(screen.getByTestId('probe').textContent).toBe('oldname');

    act(() => setLocalHandle(null));
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('(anon)')
    );
    expect(localStorage.getItem(KEY_HANDLE)).toBeNull();
  });
});
