import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@poc-reuso/ui';
import { desktopNotifier } from './notifier';

// The desktop entry point. Its only job is to inject the Electron notifier
// into the shared App -- no UI of its own.
const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App notify={desktopNotifier} platform="Electron" />
  </StrictMode>,
);
