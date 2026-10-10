# UPDOWNLY

**Higher or lower. How far can you go?**

UPDOWNLY is an offline-first trivia game for iPhone (installable as a Home Screen web app) that also runs on Android and desktop browsers. You see a real fact with its number — Mount Everest, 8,849 m — and guess whether the next one is higher or lower. Get it right and the revealed fact becomes your new reference.

- **68,481 source-backed facts** in **45 categories** across **8 groups**, from 7 openly licensed public datasets (World Bank, NASA Exoplanet Archive, OurAirports, USDA FoodData Central, Wikidata, the Amniote Life-History Database and PubChem). See [DATA-COVERAGE.md](DATA-COVERAGE.md).
- **Three modes:** Classic (one miss ends the run), 60-Second Sprint, and a deterministic Daily Challenge of ten questions.
- **Easy / Normal / Hard** difficulty, defined on percentile ranks within each comparison pool.
- **Private by design:** no accounts, no backend, no analytics, no ads, no network calls during play. Stats live in `localStorage` on the device.

## Quick start

Requires Node.js 20.19+ (22 recommended, see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Validates the dataset, typechecks, builds to `dist/` |
| `npm run preview` | Serves the production build |
| `npm run typecheck` | `tsc -b` over app, tests, scripts and configs |
| `npm test` | Vitest unit tests (engine, data, storage, formatting, pipeline) |
| `npm run test:e2e` | Playwright end-to-end tests against a build served at `/updownly/` |
| `npm run screens` | Regenerates the review screenshots in `design/screens/` |
| `npm run data:validate` | Validates the bundled dataset (runs before every build) |
| `npm run data:report` | Regenerates `DATA-COVERAGE.md` from the bundled data |
| `npm run data:fetch` | Downloads raw source data (network; developer-only) |
| `npm run data:build` | Rebuilds `src/data/generated/` from `data/raw/` (offline) |
| `npm run data:refresh` | fetch → build → validate → report |
| `npm run check` | typecheck + unit tests + data validation + build |

The first `npm run test:e2e` builds the app in `e2e` mode (deterministic seeds and a test hook that are compiled out of production builds). Locally, Playwright uses the Chromium it finds via `PLAYWRIGHT_BROWSERS_PATH`; elsewhere run `npx playwright install chromium` once.

## Deploying to GitHub Pages

The build uses a **relative base** (`./`) and **hash routing**, so the same `dist/` works at a domain root and at any subpath such as `https://<user>.github.io/updownly/` — no rebuild needed. Set `BASE_PATH=/something/` only if you need absolute URLs.

`.github/workflows/ci.yml` runs typecheck, unit tests, data validation, the production build and the Playwright suite on every push and pull request, and deploys `dist/` to GitHub Pages from `main`.

One-time setup: in the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.

### Cloudflare Pages

Connect the repo and use **Framework preset: None**, **Build command: `npm run build`**, **Build output directory: `dist`** (also set in `wrangler.toml`). Node 22 is picked up from `.nvmrc`. If the site shows a black or white screen, Cloudflare is serving the unbuilt source `index.html` — the build command or output directory is wrong (check `/src/main.tsx` is not reachable on the live site).

## Installing on an iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.

The app shows these steps itself (Settings → Add to Home Screen, and a one-time hint on iOS Safari after your first game). It never claims to have been installed.

## Offline behaviour

A Workbox service worker (via `vite-plugin-pwa`) precaches the app shell, fonts, icons and **every collection's data chunk** (about 5.2 MB uncompressed, roughly 1.4 MB over the wire with gzip) on first load, then claims the page. After that every category plays offline, including ones you have never opened, and reloads work without a connection.

Updates never interrupt a game: when a new version is ready, a "Reload" banner appears on the main screens, and only when no game is in progress.

## The fact database

Data is **built at development time, never fetched by the app**:

```
data/raw/            (git-ignored) raw downloads from each source
scripts/data/        fetch → build → validate → report pipeline
src/data/generated/  app-ready, committed: manifest.json + one JSON per collection
data/exclusions.json every rejected observation, counted by reason
DATA-COVERAGE.md     generated report
```

- `src/data/definitions.ts` is the single source of truth for groups, metrics (units, formatting, methodology), sources (licence, attribution, record links) and collections.
- Each **collection is one comparison group**: one metric, one unit, one reference period, one source. The game never compares across collections, so a population can never meet a GDP.
- The pipeline rejects missing, non-finite, ambiguous, conflicting, out-of-range and indistinguishable records and logs each rejection with a reason. Unit conversions (feet → metres, parsecs → light-years, kelvin → Celsius, Wikidata units) are explicit and unit-tested.
- A clean checkout builds **without a network connection** because `src/data/generated/` is committed.

### Refreshing the data

```bash
npm run data:fetch        # add --force to re-download, --only=<source-id> for one source
npm run data:build
npm run data:validate
npm run data:report
```

Wikidata collections are queried through the QLever Wikidata endpoint (the official query service times out on these queries) with the official endpoint as fallback. If you change selection rules or the data meaningfully, bump `DATA_VERSION` in `scripts/data/build.ts` and `DAILY_ALGORITHM_VERSION` in `src/game/daily.ts` (Daily Challenge sequences depend on the pool contents).

### Licences and attribution

Each source's licence, attribution text and links live in `SOURCES` in `src/data/definitions.ts`. The validator only accepts `CC BY 4.0`, `CC0 1.0` and `Public domain`. Attribution is shown in-app under **Settings → Data sources** and in [DATA-COVERAGE.md](DATA-COVERAGE.md). Bricolage Grotesque is SIL OFL (`src/assets/fonts/`), Phosphor Icons are MIT (`src/assets/PHOSPHOR-LICENSE.txt`).

## iOS PWA limitations

- **Haptics:** iOS Safari has no Vibration API. On iOS 18+ the app triggers the system haptic by toggling a hidden native switch inside the tap handler; on older iOS there is no haptic. The Settings toggle is disabled where no mechanism exists, and the app never claims a vibration happened.
- **Install prompt:** iOS has no programmatic install prompt; installation is manual via Share → Add to Home Screen.
- **Storage:** iOS may evict web app storage for sites that are not added to the Home Screen and go unused for weeks. Installed apps keep their data.
- **Daily Challenge:** fully offline, so there is no global leaderboard, no central anti-cheat and no cross-device sync. Results are local to the device.
- **Audio** only plays after a tap (Web Audio is created inside a user gesture).

## Project layout

```
src/app/          shell, router (hash), store (signals), game controller
src/components/   Button, BottomSheet, CategoryTile, FactCard, AnswerButtons…
src/screens/      Play, CategorySheet, Game, Results, Stats, Settings, Sources…
src/game/         engine (state machine), queue, difficulty, daily, scoring, clock, rng
src/data/         schema, definitions, loader, catalog, format, units, validate
src/services/     storage, audio, haptics, share, platform
src/design/       tokens.css (colour/type/space/motion), strings, palette
scripts/          data pipeline, icon rendering, icon-path generation
tests/unit/       Vitest
tests/e2e/        Playwright
tests/screens/    screenshot capture
design/           brand master, art direction, data-source notes, screenshots
```

See [AGENTS.md](AGENTS.md) for contribution rules, [DECISIONS.md](DECISIONS.md) for the reasoning behind major choices, [PARITY.md](PARITY.md) for the requirements checklist and [HANDOFF-REPORT.md](HANDOFF-REPORT.md) for the current status.
