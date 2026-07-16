import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../../design/primitives';
import { PlayPage } from '../../features/game/PlayPage';
import { RulesPage } from '../../features/rules/RulesPage';
import { HomePage } from '../../features/home/HomePage';
import { mockTier } from '../../test/tier';

/*
 * Convergence guards (phases 3–4): every page route renders ONE
 * responsive tree — the same components at phone, tablet, and desktop;
 * only CSS differs. Three representative pages pin that (an
 * interactive picker, a static content page, and the landing page).
 * jsdom answers false to width queries by default → phone tier;
 * mockTier('tablet') flips it. The only remaining JSX fork is the
 * in-game desktop layout (tier === 'desktop' in GameScreen), which
 * the e2e suite exercises at all three viewports.
 */

let active: { restore: () => void } | null = null;
afterEach(() => {
  active?.restore();
  active = null;
});

const renderRoute = (path: string, element: React.ReactNode) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

describe('converged pages render one tree at every tier', () => {
  it('Free Play: the phone density variant shows the segmented picker', () => {
    // Phone (jsdom default): the header text block + four stacked cards
    // give way to the four-button difficulty selector (Medium
    // preselected) over a single card. The desk heading is absent.
    renderRoute('/play', <PlayPage />);
    expect(screen.queryByText('Choose your table')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Medium', pressed: true })
    ).toBeInTheDocument();
  });

  it('Free Play: the tablet tier keeps the four-card picker + heading', () => {
    active = mockTier('tablet');
    renderRoute('/play', <PlayPage />);
    expect(screen.getByText('Choose your table')).toBeInTheDocument();
  });

  it('Rules: the spread with the inline reference renders at the phone tier', () => {
    renderRoute('/rules', <RulesPage />);
    expect(screen.getByText('Bonus card reference')).toBeInTheDocument();
  });

  it('Rules: and the same spread at the tablet tier', () => {
    active = mockTier('tablet');
    renderRoute('/rules', <RulesPage />);
    expect(screen.getByText('Bonus card reference')).toBeInTheDocument();
  });

  it('Home: the landing hero renders at the phone tier', () => {
    renderRoute('/', <HomePage />);
    expect(
      screen.getByText(/Same for everyone/)
    ).toBeInTheDocument();
  });

  it('Home: and the same landing at the tablet tier', () => {
    active = mockTier('tablet');
    renderRoute('/', <HomePage />);
    expect(
      screen.getByText(/Same for everyone/)
    ).toBeInTheDocument();
  });
});
