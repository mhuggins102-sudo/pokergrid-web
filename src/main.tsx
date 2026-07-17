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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
