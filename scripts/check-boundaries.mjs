// Fails if a workspace imports a package it does not declare.
//
// npm hoists dependencies into the root node_modules, so a stray
// `import 'electron'` inside packages/ui still RESOLVES -- typecheck passes and
// the bundler only warns. Declaring dependencies is therefore not the same as
// enforcing them. pnpm's strict layout would enforce this at resolution time;
// with npm the check has to be explicit, so here it is.
//
// Plain JS on purpose: this runs before, and independently of, any compile step.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_EXT = new Set(['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'dist-electron', '.git']);
const BUILTINS = new Set(builtinModules);

const IMPORT_RE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

/** "@scope/pkg/sub" -> "@scope/pkg";  "pkg/sub" -> "pkg" */
function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (SOURCE_EXT.has(path.extname(entry))) found.push(full);
  }
  return found;
}

function workspaceDirs() {
  const { workspaces = [] } = JSON.parse(
    readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
  );
  const dirs = [];
  for (const pattern of workspaces) {
    const base = path.join(ROOT, pattern.replace(/\/\*$/, ''));
    for (const entry of readdirSync(base)) {
      const full = path.join(base, entry);
      if (statSync(full).isDirectory()) dirs.push(full);
    }
  }
  return dirs;
}

const violations = [];

for (const dir of workspaceDirs()) {
  const manifest = JSON.parse(
    readFileSync(path.join(dir, 'package.json'), 'utf8'),
  );
  const declared = new Set([
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  for (const file of sourceFiles(dir)) {
    const text = readFileSync(file, 'utf8');
    for (const [, specifier] of text.matchAll(IMPORT_RE)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
      if (specifier.startsWith('node:')) continue;

      const name = packageNameOf(specifier);
      if (BUILTINS.has(name) || declared.has(name)) continue;

      violations.push({
        workspace: manifest.name,
        file: path.relative(ROOT, file),
        specifier,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Undeclared imports found:\n');
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    imports "${v.specifier}", not declared by ${v.workspace}\n`);
  }
  process.exit(1);
}

console.log('boundaries ok: every import is declared by its own workspace');
