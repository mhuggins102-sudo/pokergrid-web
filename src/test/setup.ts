import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

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
