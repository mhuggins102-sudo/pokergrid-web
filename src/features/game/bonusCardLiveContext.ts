import { BonusCard } from '../../game/bonusCards';
import { Suit, isJoker } from '../../game/cards';
import { GameState } from '../../game/state';

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };
const SUIT_NAME: Record<Suit, string> = {
  H: 'Hearts',
  S: 'Spades',
  D: 'Diamonds',
  C: 'Clubs',
};

/**
 * Live numbers behind a bonus card's condition — shown in the card's
 * detail popup so "20+ suit perks spent" comes with "perks spent so
 * far: 7" instead of leaving the player to count.
 */
export const bonusCardLiveContext = (
  card: BonusCard,
  state: GameState
): string[] => {
  const baseId = card.id.replace(/-pwr\d+$/, '');
  const lines: string[] = [];

  if (baseId === 'burnout-x1_25' || baseId === 'frugal-x1_5') {
    lines.push(`Suit perks spent so far: ${state.perkSpent.length}`);
  }
  if (baseId === 'deck-bank-x1_05') {
    lines.push(`Deck cards remaining: ${state.deck.length}`);
  }
  if (baseId === 'trash-joker-x1_25') {
    const n = state.discards.filter(isJoker).length;
    lines.push(`Jokers destroyed so far: ${n}`);
  }
  if (baseId === 'cozy-joker-x1_15' || baseId === 'joker-line-x1_5') {
    const n = state.grid.filter(c => c !== null && isJoker(c)).length;
    lines.push(`Jokers on the board: ${n}`);
  }
  if (baseId.startsWith('suit-density-')) {
    const tail = baseId.slice('suit-density-'.length).toUpperCase();
    if (tail === 'H' || tail === 'S' || tail === 'D' || tail === 'C') {
      const suit = tail as Suit;
      const n = state.grid.filter(
        c => c !== null && !isJoker(c) && c.suit === suit
      ).length;
      lines.push(`${SUIT_GLYPH[suit]} ${SUIT_NAME[suit]} on the board: ${n}`);
    }
  }

  return lines;
};
