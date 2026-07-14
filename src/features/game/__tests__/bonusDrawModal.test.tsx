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

vi.mock('../GameSessionProvider', () => ({
  useGameSession: () => ({ state: { bonusCards: held }, dispatch }),
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
