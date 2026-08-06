import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { usePhaseUI } from '../usePhaseUI';

/*
 * Every green special-card phase must raise a banner and drop the
 * Discard action: the docks hide Discard/Undo whenever `ui.banner` is
 * set (the mid-action gate), so a special phase that forgot its banner
 * would leave those buttons live mid-flow — and Undo mid-action is
 * destructive (ACTIVATE_SPECIAL_CARD pushes no snapshot, so ↺ restores
 * the PREVIOUS turn and silently blows the action away).
 */

let mockState: Record<string, unknown> = {};
vi.mock('../GameSessionProvider', () => ({
  useGameSession: () => ({ state: mockState, dispatch: vi.fn() }),
}));

function Probe() {
  const ui = usePhaseUI();
  return (
    <div>
      <div data-testid="banner">{ui.banner ?? ''}</div>
      <div data-testid="actions">{ui.actions.map(a => a.id).join(',')}</div>
      <div data-testid="specials">{String(ui.canActivateSpecials)}</div>
    </div>
  );
}

const baseState = { grid: Array(25).fill(null), randomPerks: false };
const ret = { returnTo: 'awaiting-action' };

const PHASES: Array<Record<string, unknown>> = [
  { kind: 'awaiting-special-power-swap-source', cardIdx: 0, slots: [0, 1], ...ret },
  { kind: 'awaiting-special-power-swap-dest', cardIdx: 0, source: 0, slots: [1], ...ret },
  { kind: 'awaiting-special-doubler', cardIdx: 0, slots: [0], ...ret },
  { kind: 'awaiting-special-wildcard', cardIdx: 0, slots: [0], ...ret },
  { kind: 'awaiting-special-mega-destroy', cardIdx: 0, slots: [0, 1], selected: [], ...ret },
  { kind: 'awaiting-special-side-slide-pick', cardIdx: 0, selected: [], ...ret },
  { kind: 'awaiting-special-side-slide-dest', cardIdx: 0, chain: [0], moves: [], ...ret },
  { kind: 'awaiting-special-jump-source', cardIdx: 0, sources: [0], ...ret },
  { kind: 'awaiting-special-jump-dest', cardIdx: 0, source: 0, dests: [1], ...ret },
  { kind: 'awaiting-special-shuffle', cardIdx: 0, slots: [0, 1, 2], selected: [], ...ret },
  { kind: 'awaiting-special-plus-minus-target', cardIdx: 0, slots: [0], ...ret },
  { kind: 'awaiting-special-plus-minus-direction', cardIdx: 0, target: 0, ...ret },
  { kind: 'awaiting-special-revive-pick', cardIdx: 0, ...ret },
  { kind: 'awaiting-special-rewind', cardIdx: 0, slots: [0, 1, 2], selected: [], ...ret },
];

describe('special-card phases raise a banner and never offer Discard', () => {
  test.each(PHASES)('$kind', phase => {
    mockState = { ...baseState, phase };
    const view = render(<Probe />);
    expect(screen.getByTestId('banner').textContent).not.toBe('');
    const ids = (screen.getByTestId('actions').textContent ?? '').split(',');
    expect(ids).not.toContain('discard');
    expect(screen.getByTestId('specials').textContent).toBe('false');
    view.unmount();
  });
});
