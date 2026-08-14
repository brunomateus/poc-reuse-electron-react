import { NotifyButton } from './NotifyButton';
import type { Notifier } from './types';
import './styles.css';

export interface AppProps {
  notify: Notifier;
  /** Human-readable name of the host, supplied by whichever app boots. */
  platform: string;
}

/**
 * The whole UI, shared verbatim by the desktop app and the web app.
 * Neither the notifier nor the platform label is discovered here -- both are
 * injected, so this file has no idea where it is running.
 */
export function App({ notify, platform }: AppProps) {
  return (
    <main className="app">
      <h1>PoC Reuso</h1>
      <p className="app__subtitle">
        Running on <strong>{platform}</strong>
      </p>

      <NotifyButton
        notify={notify}
        title={`Hello from ${platform}`}
        body="This is a native macOS notification."
        label="Show notification"
      />
    </main>
  );
}
