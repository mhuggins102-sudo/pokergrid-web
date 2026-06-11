import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BONUS_DECK_POOL, SPECIAL_DECK_POOL } from '../../../game/bonusCards';
import { BonusCardReferencePage } from '../BonusCardReferencePage';

describe('bonus card reference', () => {
  it('lists the complete catalog, grouped, with a path back to the rules', () => {
    render(
      <MemoryRouter>
        <BonusCardReferencePage />
      </MemoryRouter>
    );

    // Every card in both pools appears exactly once.
    const total = BONUS_DECK_POOL.length + SPECIAL_DECK_POOL.length;
    const entries = screen.getAllByRole('article');
    expect(entries).toHaveLength(total);

    // Category groups render with counts; specials are present.
    expect(screen.getByText(/One-time action · \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Hand-type bonus · \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Grid achievement · \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Mega Destroy/)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: '← How to Play' })).toHaveAttribute(
      'href',
      '/rules'
    );
  });
});
