// Starts the Vite dev server, then launches Electron pointed at it.
// Keeps the dev flow to a single command without extra tooling deps.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';

// In a Node context the `electron` package's default export is the path to the
// binary, but its bundled types describe the renderer/main API surface.
const electronBinary = electron as unknown as string;

const server = await createServer();
await server.listen();

const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('vite dev server did not report a local URL');

console.log(`vite dev server ready at ${url}`);

const child = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

child.on('close', () => {
  void server.close().then(() => process.exit(0));
});
