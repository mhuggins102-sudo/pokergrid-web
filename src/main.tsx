import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/inter/index.css';
// Card Room's body font (Morning Paper keeps Inter).
import '@fontsource-variable/space-grotesk/index.css';
// Drafting Room's voice: IBM Plex Mono display over IBM Plex Sans
// body. Static cuts — only the weights the app actually sets.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
// Deck-skin display fonts (used only on skinned card faces).
import '@fontsource/special-elite/index.css';
import '@fontsource/press-start-2p/index.css';
import '@fontsource/share-tech-mono/index.css';
import '@fontsource/unifrakturmaguntia/index.css';
import '@fontsource/pirata-one/index.css';
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
