import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

/** jsdom has no native ResizeObserver; Arc measurements are browser-only. */
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof ResizeObserver === 'undefined') {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver });
}

/** Radix Select scrolls highlighted options; jsdom has no scrollIntoView. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
