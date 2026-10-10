/**
 * `npm run icons` — renders the hand-drawn master mark
 * (design/brand/updownly-mark.svg) into every icon size the PWA needs.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const master = readFileSync('design/brand/updownly-mark.svg', 'utf8');
mkdirSync('public/icons', { recursive: true });

const render = (svg: string, size: number) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const outputs: Array<[string, number]> = [
  ['design/brand/updownly-icon-1024.png', 1024],
  ['public/icons/icon-512.png', 512],
  ['public/icons/icon-192.png', 192],
  // The mark sits well inside the 80 % safe zone, so the full-bleed art
  // doubles as the maskable icon.
  ['public/icons/icon-maskable-512.png', 512],
  ['public/icons/apple-touch-icon.png', 180],
  ['public/icons/favicon-32.png', 32],
];
for (const [path, size] of outputs) {
  writeFileSync(path, render(master, size));
  console.log(`  ${path} (${size}px)`);
}
