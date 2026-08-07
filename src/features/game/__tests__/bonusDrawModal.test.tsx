import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { BonusCard } from '../../../game/bonusCards';
import { BonusDrawModal } from '../components/BonusDrawModal';
import type { BonusDialogUI } from '../usePhaseUI';

const dispatch = vi.fn();
const held: BonusCard[] = [
  { id: 'a', title: 'Alpha', mult: '×2', description: 'a', category: 'gold' } as unknown as BonusCard,
  { id: 'b', title: 'Bravo', mult: '×2', description: 'b', category: 'gold' } as unknown as BonusCard,
  { id: 'c', title: 'Charlie', mult: '×2', description: 'c', category: 'gold' } as unknown as BonusCard,
];

// Mutable so individual tests can enrich the state (the draw-stat
// badge reads perkSpent / discards / deck when present).
let mockState: Record<string, unknown> = { bonusCards: held };
vi.mock('../GameSessionProvider', () => ({
  useGameSession: () => ({ state: mockState, dispatch }),
}));
vi.mock('../../settings/settingsStore', () => ({
  useSettingsStore: () => false,
}));

const replacingUI = (canGoBack: boolean): BonusDialogUI => ({
  mode: 'replacing',
  drawn: [{ id: 'x', title: 'Xray', mult: '×3', description: 'x', category: 'gold' } as unknown as BonusCard],
  pickedNew: 0,
  atCap: true,
  canDecline: false,
  canGoBack,
});

describe('BonusDrawModal — back to card select', () => {
  test('easy mode (canGoBack) shows the back link and dispatches BONUS_BACK', () => {
    render(<BonusDrawModal ui={replacingUI(true)} />);
    const back = screen.getByText(/Back to card select/i);
    fireEvent.click(back);
    expect(dispatch).toHaveBeenCalledWith({ type: 'BONUS_BACK' });
  });

  test('non-easy mode hides the back link', () => {
    render(<BonusDrawModal ui={replacingUI(false)} />);
    expect(screen.queryByText(/Back to card select/i)).toBeNull();
  });
});

describe('BonusDrawModal — draw-time stat badge', () => {
  const burnout = {
    id: 'burnout-x1_25',
    title: 'Burnout',
    mult: '×1.5',
    description: '22+ suit perks spent across the run.',
    category: 'purple',
  } as unknown as BonusCard;
  const resolvingUI: BonusDialogUI = {
    mode: 'resolving',
    drawn: [burnout],
    pickedNew: undefined,
    atCap: false,
    canDecline: true,
    canGoBack: false,
  };

  test('a counter-keyed card shows its run-state badge', () => {
    mockState = {
      bonusCards: held,
      perkSpent: [{}, {}, {}],
    };
    render(<BonusDrawModal ui={resolvingUI} />);
    expect(screen.getByText('3 / 22 perks')).toBeInTheDocument();
    mockState = { bonusCards: held };
  });

  test('the badge stays absent on a minimal state (no counters)', () => {
    render(<BonusDrawModal ui={resolvingUI} />);
    expect(screen.queryByText(/\/ 22 perks/)).toBeNull();
  });
});
