// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EMPTY_STATS, Stats } from '../../../lib/stats';
import {
  clearIntroTour,
  freshProfile,
  introTourChoice,
  markIntroTourSeen,
  requestIntroTour,
} from '../introTourSeen';

const statsWith = (patch: Partial<Stats>): Stats => ({
  ...EMPTY_STATS,
  ...patch,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('introTourChoice — tri-state flag', () => {
  test('untouched storage reads null', () => {
    expect(introTourChoice()).toBeNull();
  });

  test('markIntroTourSeen persists "seen"', () => {
    markIntroTourSeen();
    expect(introTourChoice()).toBe('seen');
  });

  test('requestIntroTour persists "show" (Settings re-arm)', () => {
    markIntroTourSeen();
    requestIntroTour();
    expect(introTourChoice()).toBe('show');
  });

  test('clearIntroTour returns to the untouched state', () => {
    markIntroTourSeen();
    clearIntroTour();
    expect(introTourChoice()).toBeNull();
  });

  test('an unrecognized stored value reads as untouched', () => {
    localStorage.setItem('pokergrid:intro-tour:v1', 'garbage');
    expect(introTourChoice()).toBeNull();
  });

  test('a storage read throw fails CLOSED to "seen" — never nag', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(introTourChoice()).toBe('seen');
  });

  test('writers swallow storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => markIntroTourSeen()).not.toThrow();
    expect(() => requestIntroTour()).not.toThrow();
    expect(() => clearIntroTour()).not.toThrow();
  });
});

describe('freshProfile — has this profile ever really played?', () => {
  test('a blank profile is fresh', () => {
    expect(freshProfile(EMPTY_STATS)).toBe(true);
  });

  test('any finished free run disqualifies', () => {
    expect(freshProfile(statsWith({ wins: 1 }))).toBe(false);
    expect(freshProfile(statsWith({ losses: 1 }))).toBe(false);
  });

  test('a beaten challenge disqualifies', () => {
    expect(
      freshProfile(statsWith({ challengesDone: ['poker-purist'] }))
    ).toBe(false);
  });

  test('a Targets-Up ladder disqualifies', () => {
    expect(freshProfile(statsWith({ targetsUpBest: 2 }))).toBe(false);
  });

  test('a recorded daily play disqualifies', () => {
    localStorage.setItem(
      'pokergrid:daily:plays:v1',
      JSON.stringify({ state: { plays: { '2026-08-20': {} } }, version: 0 })
    );
    expect(freshProfile(EMPTY_STATS)).toBe(false);
  });
});
