/**
 * Copies the Vite build (dist/) to the repository root so any static host
 * can serve the repo as-is, with no build step. Runs after `vite build`.
 * Only known build outputs are removed from the root first.
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';

const OLD = ['index.html', 'assets', 'icons', 'sw.js', 'manifest.webmanifest', 'registerSW.js', 'favicon.svg', '_headers'];
for (const name of OLD) rmSync(name, { recursive: true, force: true });
for (const name of readdirSync('.')) if (/^workbox-.*\.js$/.test(name)) rmSync(name, { force: true });

if (!existsSync('dist/index.html')) {
  console.error('publish: dist/index.html missing — did vite build run?');
  process.exit(1);
}
cpSync('dist', '.', { recursive: true });
console.log(`publish: copied dist/ to repo root (${readdirSync('dist').join(', ')})`);
