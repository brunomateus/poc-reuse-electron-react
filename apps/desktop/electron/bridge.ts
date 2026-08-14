/**
 * The IPC contract, private to the desktop app.
 *
 * This lives here rather than in @poc-reuso/ui on purpose. It describes how
 * *this shell* talks to its own renderer, which is nothing the shared
 * components should know about. `NotificationInput` in the UI package and
 * `NotificationRequest` here look alike today, but they are separate
 * contracts and are free to diverge.
 */

export interface NotificationRequest {
  title: string;
  body: string;
}

export interface NotificationResult {
  ok: boolean;
  reason?: string;
}

/** The surface the preload script puts on `window`. */
export interface DesktopBridge {
  showNotification(title: string, body: string): Promise<NotificationResult>;
}
