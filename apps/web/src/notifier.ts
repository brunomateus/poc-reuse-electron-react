import type { Notifier } from '@poc-reuso/ui';

/**
 * The web implementation of the UI package's `Notifier` contract, using the
 * browser's own Notification API. On macOS the browser routes these to
 * Notification Center too, so both apps end up in the same place by
 * different roads.
 */
export const webNotifier: Notifier = async ({ title, body }) => {
  if (!('Notification' in window)) throw new Error('notifications unsupported');

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') throw new Error('permission denied');

  new Notification(title, { body });
};
