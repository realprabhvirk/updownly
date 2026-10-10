import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const manifestData = JSON.parse(
  readFileSync(new URL('./src/data/generated/manifest.json', import.meta.url), 'utf8'),
) as { dataVersion: string };

// Relative base by default: the same build works at a domain root and under
// any GitHub Pages subpath (e.g. /updownly/). Override with BASE_PATH.
const base = process.env.BASE_PATH ?? './';
const buildStamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export default defineConfig(({ mode }) => ({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(buildStamp),
    __DATA_VERSION__: JSON.stringify(manifestData.dataVersion),
    __E2E__: JSON.stringify(mode === 'e2e'),
  },
  build: {
    target: ['es2021', 'safari15'],
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
    chunkSizeWarningLimit: 700,
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.svg', 'favicon.ico'],
      manifest: {
        id: './',
        name: 'UPDOWNLY',
        short_name: 'UPDOWNLY',
        description: 'Higher or lower? A trivia game built on thousands of real, source-backed facts.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F6F8',
        theme_color: '#3155E8',
        categories: ['games', 'education', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app, including every dataset chunk, so all
        // collections are playable offline after the first load.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
