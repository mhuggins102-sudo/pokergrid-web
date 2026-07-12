import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../../design/primitives';
import { PlayPage } from '../../features/game/PlayPage';
import { RulesPage } from '../../features/rules/RulesPage';
import { HomePage } from '../../features/home/HomePage';
import { mockTier } from '../../test/tier';

/*
 * Tier-fork guards.
 *
 * Converged pages (phase 3, cluster A) render ONE responsive tree —
 * the same components at every tier; only CSS differs. Two
 * representative pages pin that (one interactive picker, one static
 * content page). jsdom answers false to width queries by default →
 * phone tier; mockTier('tablet') flips it.
 *
 * Cluster-B pages stay forked until phase 4 under the phase-2
 * contract: phone tree by default in jsdom, the *Desk variant at the
 * tablet tier and up. HomePage pins that fork condition.
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

describe('converged pages render one tree at every tier (phase 3)', () => {
  it('Free Play: the difficulty-card picker renders at the phone tier', () => {
    renderRoute('/play', <PlayPage />);
    expect(screen.getByText('Choose your table')).toBeInTheDocument();
  });

  it('Free Play: and the same picker at the tablet tier', () => {
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
});

describe('cluster-B pages stay forked until phase 4', () => {
  it('Home: phone tile list by default (no desk hero)', () => {
    renderRoute('/', <HomePage />);
    expect(
      screen.queryByText(/Everyone plays the same deal/)
    ).not.toBeInTheDocument();
  });

  it('Home: renders the desk landing at the tablet tier', () => {
    active = mockTier('tablet');
    renderRoute('/', <HomePage />);
    expect(
      screen.getByText(/Everyone plays the same deal/)
    ).toBeInTheDocument();
  });
});
