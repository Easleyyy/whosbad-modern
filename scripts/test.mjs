#!/usr/bin/env node
// Lance tests/*.test.ts avec le lanceur intégré de Node (node:test) — aucune dépendance en plus :
// esbuild (déjà là via Vite) compile chaque fichier, les paquets restent externes.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.test-build');
rmSync(out, { recursive: true, force: true });

const files = readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
if (!files.length) { console.error('Aucun test trouvé dans tests/'); process.exit(1); }

await build({
  entryPoints: files.map((f) => path.join(root, 'tests', f)),
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  loader: { '.sql': 'text' },
  alias: { '@': path.join(root, 'src') },
  define: { 'import.meta.env': '{"DEV":false}' },
  logLevel: 'error',
});

const run = spawnSync(process.execPath, ['--test', ...files.map((f) => path.join(out, f.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit', cwd: root });
rmSync(out, { recursive: true, force: true });
process.exit(run.status ?? 1);
