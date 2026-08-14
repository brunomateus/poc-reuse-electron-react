/**
 * The contract between these components and whatever platform renders them.
 *
 * This is the whole platform-facing surface of the package. There is
 * deliberately nothing here about Electron, IPC or the browser: a host
 * supplies a `Notifier`, and the components call it.
 */

export interface NotificationInput {
  title: string;
  body: string;
}

export type Notifier = (input: NotificationInput) => Promise<void>;
