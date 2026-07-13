import { MutableRefObject, ReactNode, useMemo } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TapPopoverProvider, ToastProvider } from '../../../design/primitives';
import { NavExtrasContext } from '../../../app/DesktopNav';
import { DEFAULT_SETTINGS, useSettingsStore } from '../../settings/settingsStore';
import { PlayPage } from '../PlayPage';

/*
 * The streamlined column presentation is now the ONE column-family game
 * screen (the former settingsStore.streamlinedColumn flag is gone). At
 * the PHONE tier (jsdom's default — matchMedia answers false to both
 * width queries and the orientation query, so useGameFamily resolves to
 * 'column') the ScoreBar row is dropped: score + difficulty live in the
 * pill cluster mounted through useNavGameRow (NOT useNavExtras), Hands /
 * Scoring in that row's tap-driven popovers, Undo in the dock. This is
 * unconditional now — there is no "off" state to assert.
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

describe('streamlined column game', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });
  afterEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  it('always drops the ScoreBar and re-homes its controls (phone tier)', () => {
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
    expect(row.getByRole('button', { name: 'Scoring' })).toBeInTheDocument();
  });
});
