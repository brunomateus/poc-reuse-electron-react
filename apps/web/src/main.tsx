import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@poc-reuso/ui';
import { webNotifier } from './notifier';

// The web entry point. Identical to the desktop one except for which
// notifier it injects -- that difference is the entire platform delta.
const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App notify={webNotifier} platform="the web" />
  </StrictMode>,
);
