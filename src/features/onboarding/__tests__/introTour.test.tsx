// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { IntroTour } from '../IntroTour';
import { introTourChoice } from '../introTourSeen';

/*
 * The overlay itself. The test env's matchMedia declares reduced
 * motion (src/test/setup.ts), so every demo renders its static frame —
 * no timers to flush. The dismissal contract under test: ✕ / Escape
 * close WITHOUT writing the flag (this game only); the checkbox and
 * reaching the last page persist 'seen'.
 */

const openTour = () => {
  const onClose = vi.fn();
  render(<IntroTour onClose={onClose} />);
  return onClose;
};

const dialog = () =>
  screen.getByRole('dialog', { name: 'How to play PokerGrid' });
const next = () => screen.getByRole('button', { name: 'Next page' });
const prev = () => screen.getByRole('button', { name: 'Previous page' });

beforeEach(() => {
  localStorage.clear();
});

describe('IntroTour — paging', () => {
  test('opens on page 1 of 6 with back disabled', () => {
    openTour();
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
    expect(
      screen.getByText('Build 10 poker hands at once')
    ).toBeInTheDocument();
    expect(prev()).toBeDisabled();
  });

  test('▶ and ◀ page forward and back', () => {
    openTour();
    fireEvent.click(next());
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
    expect(
      screen.getByText('Place cards along the spiral')
    ).toBeInTheDocument();
    expect(prev()).toBeEnabled();
    fireEvent.click(prev());
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
  });

  test('the last page swaps ▶ for a Start playing CTA that closes', () => {
    const onClose = openTour();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    expect(screen.getByText('6 / 6')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    const cta = screen.getByRole('button', { name: 'Start playing' });
    fireEvent.click(cta);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('IntroTour — dismissal contract', () => {
  test('✕ closes without writing the flag (this game only)', () => {
    const onClose = openTour();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(introTourChoice()).toBeNull();
  });

  test('Escape closes without writing the flag', () => {
    const onClose = openTour();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(introTourChoice()).toBeNull();
  });

  test('the checkbox persists "seen"; unticking re-arms "show"', () => {
    // Untick must write the explicit 'show' state, NOT clear to the
    // untouched one — the fresh-profile guard would swallow a cleared
    // flag once any game is on the books.
    openTour();
    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(introTourChoice()).toBe('seen');
    fireEvent.click(box);
    expect(introTourChoice()).toBe('show');
  });

  test('reaching the last page marks the tour seen and ticks the box', () => {
    openTour();
    expect(introTourChoice()).toBeNull();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    expect(introTourChoice()).toBe('seen');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('unticking after finishing overrides the auto-mark', () => {
    openTour();
    for (let i = 0; i < 5; i++) fireEvent.click(next());
    expect(introTourChoice()).toBe('seen');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(introTourChoice()).toBe('show');
  });
});
