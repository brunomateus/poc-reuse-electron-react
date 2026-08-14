# PoC Reuso — sharing React components between web and Electron

Two applications — an Electron desktop app (macOS) and a web app — that render
**the same React component tree**, published as a workspace package. Each shows
one button; the button raises a native macOS notification. Everything is
TypeScript, strict mode.

## Run it

```bash
npm install

npm run dev        # desktop: compile main process, start Vite + Electron
npm run dev:web    # web: Vite dev server on http://localhost:5174

npm start          # desktop production build, then Electron
npm run build      # build every workspace
npm run typecheck  # every workspace + the boundary check
```

Click **Show notification** in either app.

> First run on desktop: macOS registers the app and may need notifications
> enabled under System Settings → Notifications. In dev the app is the unsigned
> `Electron` binary, so notifications are attributed to "Electron" rather than
> to a product name. Packaging with a real bundle id (electron-builder /
> electron-forge) fixes that — a packaging concern, not a code one.
>
> On web, the browser prompts for notification permission on first click. On
> macOS the browser then routes the notification to Notification Center too, so
> both apps end up in the same place by different roads.

## Layout

```
packages/ui/                 @poc-reuso/ui — ALL the React, no platform code
  src/
    index.ts                 the public surface
    App.tsx                  the entire UI
    NotifyButton.tsx
    types.ts                 the Notifier contract
    styles.css
    css.d.ts

apps/desktop/                @poc-reuso/desktop
  index.html
  src/main.tsx               entry point — injects desktopNotifier
  src/notifier.ts            the Electron half of the seam
  electron/main.ts           owns the OS Notification API
  electron/preload.cts       contextBridge -> window.desktop
  electron/bridge.ts         the IPC contract, private to this app
  scripts/dev.ts             boots Vite, then Electron pointed at it

apps/web/                    @poc-reuso/web
  index.html
  src/main.tsx               entry point — injects webNotifier
  src/notifier.ts            the browser half of the seam

scripts/check-boundaries.mjs enforces what npm only declares
```

## The result

Each app owns an `index.html`, a ~12-line entry point, and its own notifier.
The entry points differ by two lines of real code:

```diff
- import { desktopNotifier } from './notifier';
+ import { webNotifier } from './notifier';

-     <App notify={desktopNotifier} platform="Electron" />
+     <App notify={webNotifier} platform="the web" />
```

Both builds emit a byte-identical stylesheet (same content hash under
`apps/desktop/dist/` and `apps/web/dist/`), which is a cheap way to confirm the
shared layer really is shared and not quietly forked.

## How it works

`packages/ui` imports nothing from Electron and touches no platform API.
`NotifyButton` takes a `notify` prop typed as `Notifier` and calls it. That type
is the entire seam:

| | injected notifier | lives in | what it does |
|---|---|---|---|
| Desktop | `desktopNotifier` | `apps/desktop` | `ipcRenderer.invoke('notification:show')` → main process → `new Notification()` → Notification Center |
| Web | `webNotifier` | `apps/web` | browser `Notification` API, including the permission request |

Both notifiers live in their apps, not in the shared package. They are the
platform halves of the seam; putting either in `packages/ui` would put Electron
knowledge inside the package whose whole job is not to have any.

Dependencies are **injected at the entry point** rather than discovered at
runtime, so the shared components never sniff their environment and stay
trivially testable — pass a stub `notify` and assert on it.

### Two contracts that look alike

`packages/ui` defines `NotificationInput` (what the UI hands a notifier).
`apps/desktop/electron/bridge.ts` defines `NotificationRequest` (what travels
over IPC). They have the same fields today and are deliberately separate: one
is about rendering, the other is a wire format, and only the desktop app has
the second problem.

### Why there is no runtime platform detection

An obvious alternative is to pick the notifier at runtime with
`window.desktop ? desktopNotifier : webNotifier`. This PoC deliberately does
not, because that check is less trustworthy than it looks. Measured behaviour
in Electron 33:

| | |
|---|---|
| Bridge present before page JS runs | ✅ guaranteed — preload completes first |
| Page script can overwrite the bridge | ✅ can't — `writable: false, configurable: false` |
| Inside an `<iframe>` or child window | ⚠️ `undefined` — preloads aren't inherited |
| Browser `Notification` inside Electron | ⚠️ exists, permission already `granted` |
| Preload throws | ⚠️ page renders normally, bridge silently absent |

The last two rows are the problem together: if the preload fails, a
detection-based app falls back to Chromium's own `Notification` API,
notifications keep appearing, and the dead main-process path never announces
itself — along with anything attached to it (click handling, actions, app
attribution).

So detection is avoided entirely. Each build injects the notifier for the host
it was built for. If you ever do need one bundle for both hosts, use a
build-time constant (`import.meta.env`), which cannot be wrong at runtime and
dead-code-eliminates.

`desktopNotifier` still touches `window.desktop`, but only as a **liveness
assertion that fails loudly**, and it probes `showNotification` rather than the
namespace: a truthy `window.desktop` does not prove the shape `DesktopBridge`
claims.

### The IPC message is untrusted

The handler in `apps/desktop/electron/main.ts` types its payload `unknown`, not
`NotificationRequest`, and parses it with `parseRequest()`. Same lesson as the
bridge check, pointed the other way: a type is a claim about our own source,
never about what arrives on the wire.

Without that parse, every malformed payload still returned `ok: true` and
raised a notification reading `undefined`:

| Payload | Before | After |
|---|---|---|
| `{title, body}` | `ok: true` | `ok: true` |
| `{title, message}` (renamed field) | `ok: true`, body `undefined` | `ok: false, malformed` |
| `{}` / `42` / `'hello'` | `ok: true`, both `undefined` | `ok: false, malformed` |
| `{title: {}, body: []}` | `ok: true`, `[object Object]` | `ok: false, malformed` |
| `null` | main-process TypeError | `ok: false, malformed` |

Titles and bodies are also capped (256 / 1024 chars).

**This does not make notification content safe.** The renderer still chooses
the words, and macOS renders them with the app's own identity and icon.
Closing that needs the main process to own the wording — the renderer sends a
*kind* plus parameters from a fixed set, never free text. Out of scope here,
but it is the shape of the real fix.

## The workspace, and what it actually buys

`packages/ui` is a real package. `apps/*` depend on it by name:

```ts
import { App } from '@poc-reuso/ui';
```

npm symlinks it into `node_modules/@poc-reuso/ui`. Nothing is published; there
are no version numbers.

**Consuming source, not a build.** `packages/ui` has no build step. Its
`exports` field points at `./src/index.ts` and each app's bundler compiles it.
That keeps Fast Refresh working across the package boundary and avoids a watch
build. Only compile the package if you ever publish it to a registry.

**Declaring a dependency is not enforcing it.** The reason to do this was to
make "shared code must not touch platform code" checkable. It turns out npm
alone does not deliver that. With `import { Notification } from 'electron'`
added to `packages/ui/src`:

| | Result |
|---|---|
| `tsc` typecheck of `@poc-reuso/ui` | passes |
| `vite build` of the desktop app | **succeeds**, warns about externalising `fs`/`path`, bundles Electron's `index.js` (+1 kB) |

npm hoists everything into the root `node_modules`, so the phantom import
resolves from anywhere in the repo. pnpm's strict layout would refuse it. Since
this project uses npm, `scripts/check-boundaries.mjs` does the job instead: it
walks each workspace's source, extracts every bare import, and fails if the
package does not declare it. It runs as part of `npm run typecheck`.

```
packages/ui/src/__probe.ts
  imports "electron", not declared by @poc-reuso/ui
```

**What it removed.** The old `vite.base.ts` factory and the
`server.fs.allow: ['..']` workaround are both gone. `fs.allow` existed only
because `shared/` sat above the Vite root; a workspace package is resolved
through `node_modules`, and Vite finds the workspace root by itself. With that
gone, the two Vite configs had almost nothing left in common, so each app now
owns its own ten-line config.

## Build setup

| | `apps/desktop` | `apps/web` |
|---|---|---|
| out | `dist/` + `dist-electron/` | `dist/` |
| base | `./` (loaded over `file://`) | `/` (served over http) |
| dev port | 5173 | 5174 |

TypeScript is one config per compilation target, all extending
`tsconfig.base.json`:

| Config | Covers | lib | Resolution |
|---|---|---|---|
| `packages/ui/tsconfig.json` | the shared components | DOM | `bundler` |
| `apps/*/tsconfig.json` | renderer / web source | DOM | `bundler` |
| `apps/desktop/tsconfig.node.json` | `electron/`, `scripts/` | Node | `NodeNext` |

The preload script is `.cts`, which compiles to `preload.cjs`. That extension
is load-bearing: preload scripts must stay CommonJS to run under
`sandbox: true`, while `main.ts` compiles to ESM because the package is
`"type": "module"`. Because `verbatimModuleSyntax` is on, the `.cts` file uses
`import electron = require('electron')` — the CommonJS import form — rather
than ESM syntax that would have to be rewritten on emit.

## What this establishes

- React components port unchanged when they don't reach for platform APIs
  directly. Push those behind injected functions.
- The per-app cost is an HTML file, a ~12-line entry point, and one notifier.
- A package boundary makes the rule *declarable*; under npm it takes an
  explicit check to make it *enforced*. Choosing pnpm would move that
  enforcement into resolution itself.
