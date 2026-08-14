// `import ... = require(...)` is the CommonJS import form. A `.cts` file emits
// CJS, and `verbatimModuleSyntax` forbids writing ESM syntax that would have to
// be rewritten on the way out.
import electron = require('electron');
import type { DesktopBridge } from './bridge.js';

const { contextBridge, ipcRenderer } = electron;

// The only surface the React code sees. The web app simply won't have it,
// which is why the shared components never look for it.
//
// `.cts` compiles to `preload.cjs`: preload scripts stay CommonJS so they can
// run with `sandbox: true`.
const bridge: DesktopBridge = {
  showNotification: (title, body) =>
    ipcRenderer.invoke('notification:show', { title, body }),
};

contextBridge.exposeInMainWorld('desktop', bridge);
