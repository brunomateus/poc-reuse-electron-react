import type { Notifier } from '@poc-reuso/ui';
import type { DesktopBridge } from '../electron/bridge';

declare global {
  interface Window {
    /** Present only under Electron -- injected by `electron/preload.cts`. */
    desktop?: DesktopBridge;
  }
}

/**
 * The desktop implementation of the UI package's `Notifier` contract. It hands
 * the request to the main process, which raises a genuine macOS Notification
 * Center notification.
 *
 * This lives in the app, not in @poc-reuso/ui: it is the platform half of the
 * seam, and the shared package must stay free of it.
 */
export const desktopNotifier: Notifier = async ({ title, body }) => {
  // Probe the method, not just the namespace. `window.desktop` being truthy
  // does not prove it has the shape `DesktopBridge` claims -- that type is a
  // compile-time assertion, and it only binds when the preload script and this
  // file are built together. An Electron shell loading a separately deployed
  // frontend can present an older bridge that is missing this method.
  const bridge = window.desktop;
  if (typeof bridge?.showNotification !== 'function') {
    throw new Error('desktop bridge unavailable or incompatible');
  }

  const result = await bridge.showNotification(title, body);
  if (!result.ok) throw new Error(result.reason ?? 'unknown error');
};
