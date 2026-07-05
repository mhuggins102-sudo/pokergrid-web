import { migrateSettings } from '../settingsStore';
import { resolveTheme } from '../useTheme';

describe('migrateSettings (v0 theme → v1 family + appearance)', () => {
  it('maps each legacy choice', () => {
    expect(migrateSettings({ theme: 'paper', sounds: true }, 0)).toEqual({
      themeFamily: 'paper',
      appearance: 'light',
      sounds: true,
    });
    expect(migrateSettings({ theme: 'card-room' }, 0)).toEqual({
      themeFamily: 'card-room',
      appearance: 'light',
    });
    expect(migrateSettings({ theme: 'card-room-dark' }, 0)).toEqual({
      themeFamily: 'card-room',
      appearance: 'dark',
    });
    expect(migrateSettings({ theme: 'system' }, 0)).toEqual({
      themeFamily: 'card-room',
      appearance: 'system',
    });
  });

  it('defaults a missing legacy theme to card-room/system', () => {
    expect(migrateSettings({ sounds: false }, 0)).toEqual({
      themeFamily: 'card-room',
      appearance: 'system',
      sounds: false,
    });
  });

  it('leaves current-version state untouched', () => {
    const v1 = { themeFamily: 'paper', appearance: 'dark' };
    expect(migrateSettings(v1, 1)).toBe(v1);
  });
});

describe('resolveTheme', () => {
  it('resolves every family/appearance pair', () => {
    expect(resolveTheme('card-room', 'light', true)).toBe('card-room');
    expect(resolveTheme('card-room', 'dark', false)).toBe('card-room-dark');
    expect(resolveTheme('card-room', 'system', true)).toBe('card-room-dark');
    expect(resolveTheme('card-room', 'system', false)).toBe('card-room');
    expect(resolveTheme('paper', 'light', true)).toBe('paper');
    expect(resolveTheme('paper', 'dark', false)).toBe('paper-dark');
    expect(resolveTheme('paper', 'system', true)).toBe('paper-dark');
    expect(resolveTheme('paper', 'system', false)).toBe('paper');
  });
});
