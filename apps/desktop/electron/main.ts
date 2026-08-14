import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NotificationRequest, NotificationResult } from './bridge.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Set before app is ready so macOS attributes the notification to this name.
app.setName('PoC Reuso');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 520,
    height: 420,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#16161a',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    // Compiled layout: dist-electron/electron/main.js -> ../../dist
    void win.loadFile(path.join(currentDir, '..', '..', 'dist', 'index.html'));
  }
}

// macOS truncates long notification text when it draws it, so a cap costs
// nothing legitimate while denying a compromised renderer an easy abuse.
const MAX_TITLE = 256;
const MAX_BODY = 1024;

/**
 * Parse an untrusted IPC message into a request we are willing to act on.
 *
 * `payload` is `unknown` on purpose. Typing it as `NotificationRequest` would
 * assert that the message has already been checked, which nothing does: the
 * renderer may be an older build than this shell, or a compromised page. The
 * type is a claim about our own source, never about what arrives on the wire.
 *
 * Returns null when the message is unusable, so a bad payload becomes a
 * reported failure rather than a notification reading "undefined".
 */
function parseRequest(payload: unknown): NotificationRequest | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const { title, body } = payload as Partial<
    Record<keyof NotificationRequest, unknown>
  >;

  if (typeof title !== 'string' || typeof body !== 'string') return null;
  if (title.trim() === '') return null;

  return { title: title.slice(0, MAX_TITLE), body: body.slice(0, MAX_BODY) };
}

// The renderer never touches Electron APIs directly; it asks the main process
// to raise a real macOS notification through the Notification Center.
ipcMain.handle(
  'notification:show',
  (_event, payload: unknown): NotificationResult => {
    const request = parseRequest(payload);
    if (!request) return { ok: false, reason: 'malformed' };

    if (!Notification.isSupported()) {
      return { ok: false, reason: 'unsupported' };
    }

    new Notification({ ...request, silent: false }).show();

    return { ok: true };
  },
);

void app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
