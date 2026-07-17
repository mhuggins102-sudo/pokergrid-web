import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/inter/index.css';
// Card Room's body font (Morning Paper keeps Inter).
import '@fontsource-variable/space-grotesk/index.css';
import './design/reset.css';
import './design/tokens.css';
import './design/typography.css';

import { router } from './app/router';
import { CACHE_BUST_PARAM } from './app/RouteError';

// The stale-deploy self-heal navigates with a one-shot cache-buster
// query (see RouteError) — strip it before the router mounts so it
// never lingers in the address bar or gets copied into a share.
if (new URLSearchParams(window.location.search).has(CACHE_BUST_PARAM)) {
  const url = new URL(window.location.href);
  url.searchParams.delete(CACHE_BUST_PARAM);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
