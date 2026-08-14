import { useState } from 'react';
import type { Notifier } from './types';

export interface NotifyButtonProps {
  notify: Notifier;
  title: string;
  body: string;
  label?: string;
}

/**
 * Platform-agnostic React component.
 *
 * It knows nothing about Electron or the browser: it receives a `notify`
 * function and calls it. That single prop is the seam that lets the exact
 * same file be rendered by the web app and by the desktop app.
 */
export function NotifyButton({
  notify,
  title,
  body,
  label = 'Notify me',
}: NotifyButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleClick() {
    try {
      await notify({ title, body });
      setStatus('sent');
    } catch (error) {
      setStatus(`failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  return (
    <div className="notify-button">
      <button type="button" onClick={handleClick}>
        {label}
      </button>
      {status && <p className="notify-button__status">{status}</p>}
    </div>
  );
}
