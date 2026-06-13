import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no matchMedia; motion (and any prefers-reduced-motion guard)
// queries it. Tests declare reduced motion so presentation staging
// (e.g. useAutoPlaceFlights' well pose, which briefly disables the
// dock) collapses to instant — fireEvent doesn't wait for buttons to
// re-enable the way Playwright does.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom doesn't implement the native <dialog> show/close methods yet;
// shim enough for Dialog/Sheet component tests.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(
    this: HTMLDialogElement
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(
    this: HTMLDialogElement
  ) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
});
