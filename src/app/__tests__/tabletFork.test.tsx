import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../../design/primitives';
import { PlayPage } from '../../features/game/PlayPage';
import { RulesPage } from '../../features/rules/RulesPage';
import { mockTier } from '../../test/tier';

/*
 * Phase-2 fork guard: the page routes render their desktop-redesign
 * (*Desk) variant at the tablet tier and up, and the phone variant
 * below it. jsdom answers false to width queries by default → phone
 * tree; mockTier('tablet') flips it. Two representative pages (one
 * data-light picker, one static content page) pin the fork condition;
 * the screenshot sweep covers the visual result across all ten routes.
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

describe('tablet tier adopts the desktop pages', () => {
  it('Free Play: phone picker by default, desk table at tablet', () => {
    renderRoute('/play', <PlayPage />);
    expect(screen.getByText('Free Play')).toBeInTheDocument();
    expect(screen.queryByText('Choose your table')).not.toBeInTheDocument();
  });

  it('Free Play: renders the desk table at the tablet tier', () => {
    active = mockTier('tablet');
    renderRoute('/play', <PlayPage />);
    expect(screen.getByText('Choose your table')).toBeInTheDocument();
  });

  it('Rules: phone article by default, desk spread at tablet', () => {
    renderRoute('/rules', <RulesPage />);
    // The desk spread's inline bonus-card reference heading is desk-only.
    expect(
      screen.queryByText('Bonus card reference')
    ).not.toBeInTheDocument();
  });

  it('Rules: renders the desk spread at the tablet tier', () => {
    active = mockTier('tablet');
    renderRoute('/rules', <RulesPage />);
    expect(screen.getByText('Bonus card reference')).toBeInTheDocument();
  });
});
