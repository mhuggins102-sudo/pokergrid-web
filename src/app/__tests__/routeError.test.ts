import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '../RouteError';

describe('isChunkLoadError', () => {
  it('matches the per-engine stale-deploy chunk messages', () => {
    for (const msg of [
      'Failed to fetch dynamically imported module: https://x/assets/Play-abc.js',
      "'text/html' is not a valid JavaScript MIME type",
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Unable to preload CSS for /assets/Stats-def.js',
    ]) {
      expect(isChunkLoadError(new Error(msg))).toBe(true);
    }
  });

  it('matches the update-race fetch failures that used to slip through', () => {
    // These are what iOS Safari / Firefox throw when the chunk fetch
    // fails DURING the service-worker activation swap — previously
    // unclassified, so they surfaced the generic card instead of
    // self-healing.
    expect(isChunkLoadError(new Error('Load failed'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(true);
    expect(
      isChunkLoadError(new Error('NetworkError when attempting to fetch resource.'))
    ).toBe(true);
  });

  it('matches a ChunkLoadError by name even with an odd message', () => {
    const e = new Error('Loading chunk 5 failed.');
    e.name = 'ChunkLoadError';
    expect(isChunkLoadError(e)).toBe(true);
  });

  it('does NOT match a genuine application error (that card should show)', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(
      false
    );
    expect(isChunkLoadError(new TypeError('x.map is not a function'))).toBe(false);
    expect(isChunkLoadError('some string')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
