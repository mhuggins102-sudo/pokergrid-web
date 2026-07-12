import { MutableRefObject, ReactNode, useMemo } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TapPopoverProvider, ToastProvider } from '../../../design/primitives';
import { NavExtrasContext } from '../../../app/DesktopNav';
import {
  DEFAULT_SETTINGS,
  useSettingsStore,
} from '../../settings/settingsStore';
import { PlayPage } from '../PlayPage';

/*
 * The streamlined column preview (settingsStore.streamlinedColumn), v2.
 * The flag re-homes the ScoreBar: at the PHONE tier (jsdom's default —
 * matchMedia answers false to both width queries) score + difficulty →
 * the pill cluster in a second header row (mounted through
 * useNavGameRow, NOT useNavExtras), Hands / Scoring / Lines → that row's
 * tap-driven popovers, Undo → the dock. Off is a no-op — the ScoreBar
 * renders exactly as before, and NO game row is pushed.
 *
 * The real NavExtrasProvider re-provides a fresh context value on every
 * setter call, so a fresh-identity node feeds a re-render → re-set →
 * re-render cascade that act() flushes to a hang in jsdom (the same
 * pattern the desk pill uses — it settles in a real browser, verified by
 * screenshot). The probe swaps in a STABLE-value provider that captures
 * the mounted gameRow node into a ref without re-providing it, so the
 * game tree never re-renders from the write and the loop can't form.
 */
function CaptureNav({
  captured,
  children,
}: {
  captured: MutableRefObject<ReactNode>;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      extras: null as ReactNode,
      // Phone tier mounts nothing into the extras slot (the tablet tier
      // would) — capture the gameRow instead.
      setExtras: () => {},
      gameRow: null as ReactNode,
      setGameRow: (n: ReactNode) => {
        captured.current = n;
      },
    }),
    [captured]
  );
  return (
    <NavExtrasContext.Provider value={value}>
      {children}
    </NavExtrasContext.Provider>
  );
}

const renderGame = (captured: MutableRefObject<ReactNode>) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/play?difficulty=easy&seed=42']}>
        <TapPopoverProvider>
          <CaptureNav captured={captured}>
            <Routes>
              <Route path="/play" element={<PlayPage />} />
            </Routes>
          </CaptureNav>
        </TapPopoverProvider>
      </MemoryRouter>
    </ToastProvider>
  );

describe('streamlined column preview', () => {
  beforeEach(() => {
    // Reset to defaults so a prior test's toggle can't leak (persist
    // reads jsdom localStorage).
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });
  afterEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  it('keeps the ScoreBar by default (flag off)', () => {
    const captured: MutableRefObject<ReactNode> = { current: null };
    renderGame(captured);
    // The ScoreBar's Lines button is the tell for the row being present.
    expect(screen.getByRole('button', { name: 'Lines' })).toBeInTheDocument();
    // Off pushes no game row.
    expect(captured.current).toBeNull();
  });

  it('drops the ScoreBar and re-homes its controls into the game row when enabled', () => {
    useSettingsStore.setState({ streamlinedColumn: true });
    const captured: MutableRefObject<ReactNode> = { current: null };
    renderGame(captured);

    // ScoreBar gone: its exact "Lines" button no longer exists (the
    // Lines breakdown now opens from the Scoring popover's line rows).
    expect(
      screen.queryByRole('button', { name: 'Lines' })
    ).not.toBeInTheDocument();

    // Undo relocated into the dock (easy grants one undo).
    expect(screen.getByRole('button', { name: /Undo/ })).toBeInTheDocument();

    // Game row mounted (phone tier): render the captured node and confirm
    // it carries the score readout (the split pill) + the Hands / Scoring
    // controls that re-home the removed ScoreBar's doors.
    expect(captured.current).not.toBeNull();
    const row = render(<>{captured.current}</>);
    expect(row.getByLabelText(/Score \d+ of 400/)).toBeInTheDocument();
    expect(
      row.getByRole('button', { name: 'Hand values' })
    ).toBeInTheDocument();
    expect(
      row.getByRole('button', { name: 'Scoring' })
    ).toBeInTheDocument();
  });
});
