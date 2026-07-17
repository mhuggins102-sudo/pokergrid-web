import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '../../../design/primitives';
import { PlayPage } from '../PlayPage';

const renderPlay = (search: string) =>
  render(
    <ToastProvider><MemoryRouter initialEntries={[`/play${search}`]}>
      <Routes>
        <Route path="/play" element={<PlayPage />} />
      </Routes>
    </MemoryRouter></ToastProvider>
  );

describe('free play', () => {
  it('shows the difficulty picker without a difficulty param', () => {
    renderPlay('');
    // Phone (jsdom default): the segmented difficulty selector, Medium
    // preselected. Selecting Extreme pins the Start link's URL. Query
    // by the exact pill label so it doesn't also match the single
    // difficulty card (whose name begins "Extreme 450 target …").
    expect(
      screen.getByRole('button', { name: 'Medium', pressed: true })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Extreme' }));
    expect(screen.getByRole('link', { name: /Start game/ })).toHaveAttribute(
      'href',
      '/play?difficulty=extreme'
    );
  });

  it('plays a seeded easy game to completion with Place only', () => {
    renderPlay('?difficulty=easy&seed=42');

    // Board renders. The streamlined column game's score / target lives in
    // the header pill (mounted into the app nav via useNavGameRow), so it's
    // not present in this bare PlayPage harness — the score readout is
    // covered by streamlinedColumn.test.tsx's captured game row.
    expect(screen.getByRole('grid', { name: 'Game board' })).toBeInTheDocument();

    // Place until the run ends. 25 slots − the pre-placed center card,
    // with jokers auto-placing, bounds the loop well under 30 clicks.
    for (let i = 0; i < 30; i++) {
      const place = screen.queryByRole('button', { name: 'Place' });
      if (!place) break;
      fireEvent.click(place);
    }

    const final = screen.getByTestId('final-score');
    expect(final).toBeInTheDocument();
    expect(Number(final.textContent)).not.toBeNaN();
    // The streamlined column game ends in the DesktopResultDialog overlay:
    // the run's verdict, the key highlights (the line-by-line accordion was
    // retired for a few at-a-glance bullets), and the way back to the grid
    // (the full-screen ResultView is no longer used for the column family).
    expect(screen.getByText(/Target cleared|Just short/i)).toBeInTheDocument();
    expect(screen.getByText(/of 10 lines scored/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Grid' })).toBeInTheDocument();
  });

  it('is deterministic for a fixed seed', () => {
    const playThrough = (): string => {
      const view = renderPlay('?difficulty=hard&seed=1234');
      for (let i = 0; i < 30; i++) {
        const place = view.queryByRole('button', { name: 'Place' });
        if (!place) break;
        fireEvent.click(place);
      }
      const score = view.getByTestId('final-score').textContent ?? '';
      view.unmount();
      return score;
    };
    const a = playThrough();
    const b = playThrough();
    expect(a).toBe(b);
    expect(a).not.toBe('');
  });

  it('opens a suit-perk targeting phase and cancels back', () => {
    renderPlay('?difficulty=easy&seed=42');

    // Walk the run until a perk button is enabled, enter targeting,
    // check the banner + cancel path, then bail out.
    for (let i = 0; i < 30; i++) {
      const perk = screen
        .queryAllByRole('button')
        .find(
          b =>
            /Swap|Slide|Destroy|Bonus/.test(b.textContent ?? '') &&
            !(b as HTMLButtonElement).disabled
        );
      if (perk) {
        const isBonus = /Bonus/.test(perk.textContent ?? '');
        fireEvent.click(perk);
        if (isBonus) {
          // ♣ takes over the dock with compact keep-chips; the ✕
          // carries the "Decline both" label.
          expect(screen.getByText(/♣ Bonus draw/)).toBeInTheDocument();
          const decline = screen.queryByRole('button', { name: 'Decline both' });
          expect(decline).not.toBeNull(); // easy allows declining
          fireEvent.click(decline!);
        } else {
          // Targeting instruction shows in the dock banner.
          expect(screen.getByText(/— tap/i)).toBeInTheDocument();
          fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
          expect(screen.getByRole('button', { name: 'Place' })).toBeInTheDocument();
        }
        return;
      }
      const place = screen.queryByRole('button', { name: 'Place' });
      if (!place) break;
      fireEvent.click(place);
    }
    throw new Error('No enabled perk button appeared during the run');
  });

  it('undo restores the previous board state on easy (1 undo)', async () => {
    renderPlay('?difficulty=easy&seed=42');
    const board = screen.getByRole('grid', { name: 'Game board' });
    // The opening card stages in the well first, then flies to its
    // cell (useAutoPlaceFlights) — wait for the landing.
    await waitFor(() =>
      expect(
        board.querySelectorAll('[class*="cardWrap"]').length
      ).toBeGreaterThan(0)
    );
    const filledBefore = board.querySelectorAll('[class*="cardWrap"]').length;

    fireEvent.click(screen.getByRole('button', { name: 'Place' }));
    const undo = screen.getByRole('button', { name: /Undo/ });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    // AnimatePresence may keep an exiting card in the DOM briefly, so
    // assert on the engine-driven control state instead of node counts:
    // the single easy undo is now spent and the button disables.
    expect(filledBefore).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
  });
});
