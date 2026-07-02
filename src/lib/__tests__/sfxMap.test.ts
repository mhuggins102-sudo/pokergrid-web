import { sfxForHistoryEntry } from '../sfx';

describe('sfxForHistoryEntry', () => {
  it('covers placements and all four suit perks', () => {
    expect(sfxForHistoryEntry('Place')).toBe('place');
    expect(sfxForHistoryEntry('Joker auto-placed')).toBe('joker');
    expect(sfxForHistoryEntry('Hop 3↔7')).toBe('swap'); // ♥
    expect(sfxForHistoryEntry('Slide left × 2')).toBe('slide'); // ♠
    expect(sfxForHistoryEntry('Destroy slot 12')).toBe('destroy'); // ♦
    expect(sfxForHistoryEntry('Bonus draw resolved')).toBe('chime'); // ♣
  });

  it('covers every green one-time action card', () => {
    expect(sfxForHistoryEntry('Power Swap 3↔7')).toBe('swap');
    expect(sfxForHistoryEntry('Jump 4→18')).toBe('swap');
    expect(sfxForHistoryEntry('Slip & Slide up-up-left')).toBe('slide');
    expect(sfxForHistoryEntry('Mega Destroy on 3 slots')).toBe('destroy');
    expect(sfxForHistoryEntry('Doubler on slot 9')).toBe('enchant');
    expect(sfxForHistoryEntry('Wildcard on slot 2')).toBe('enchant');
    expect(sfxForHistoryEntry('Plus/Minus +1 on slot 5')).toBe('enchant');
    expect(sfxForHistoryEntry('Shuffle on 4 slots')).toBe('riffle');
    expect(sfxForHistoryEntry('Rewind on 3 slots')).toBe('riffle');
    expect(sfxForHistoryEntry('Revive discard #2')).toBe('revive');
  });

  it('covers the Double Duty flip', () => {
    expect(sfxForHistoryEntry('Flip (2 cards burned)')).toBe('flip');
  });

  it('stays silent for non-action entries', () => {
    expect(sfxForHistoryEntry('Discard')).toBeNull();
    expect(sfxForHistoryEntry('Game start')).toBeNull();
  });
});
