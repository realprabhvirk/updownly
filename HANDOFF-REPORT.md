# HANDOFF REPORT — UPDOWNLY v1.0.0

Honest status at hand-off (10 October 2026).

## What was built
A complete, offline-first higher-or-lower trivia PWA:

- **Play** screen with Quick Play, Daily Challenge and 60-Second Sprint, plus a searchable, filterable category browser (8 groups, 45 categories).
- **Category sheet** with description, measured statistic, period, fact count, source, mode and difficulty.
- **Game screen** built for one-handed portrait play (stacked Higher/Lower), with count-up reveals, ✓/✗ feedback, verdict text, fact detail sheets with source links, keyboard controls and screen-reader announcements. Landscape and desktop layouts included.
- **Modes:** Classic, Sprint (tamper-resistant clock), Daily (deterministic per date, saved once, practice re-runs).
- **Results** with records, accuracy, daily pattern, achievements and native share / clipboard fallback.
- **Stats** (records, best category, daily streak and week view, achievements, recent games) and **Settings** (defaults, sound, haptics, reduced motion, theme, data sources, clear history, reset, version/build, install help, privacy).
- **PWA:** manifest, full icon set from a hand-drawn master, service worker precaching every dataset chunk, user-controlled update banner, iOS install sheet.

## Verified dataset
Counted from the bundled files by `npm run data:validate` and `tests/unit/data.test.ts`:

| | |
|---|---|
| Distinct observations | **68,481** |
| Unique entities | 41,278 |
| Playable collections | 45 (all ≥ 83 facts; most in the thousands) |
| Category groups | 8 |
| Sources | 7 (World Bank 2,683 · NASA Exoplanet Archive 18,236 · OurAirports 6,476 · USDA SR Legacy 15,751 · Wikidata 20,312 · Amniote database 4,518 · PubChem 505) |
| Validation | 0 errors, 11 review warnings (statistical outliers, flagged not removed) |

No values were invented, estimated or generated. Every fact has a source record reference; rejected records are counted by reason in `DATA-COVERAGE.md` and `data/exclusions.json`. The count exceeds the 20–50k target band because quality filtering still left large pools; see DECISIONS.md #19.

## Verification performed
- `npm run check` — typecheck, **105 unit tests**, data validation and production build: passing.
- `npm run test:e2e` — **25 Playwright tests** against a build served at `/updownly/` (iPhone 13 profile on Chromium): passing. Covers Quick Play, category/difficulty choice, correct/incorrect answers, chained references, hidden-value non-leakage, rapid taps, keyboard play, early exit, resume after navigation, Sprint with a controlled clock (including expiry while away), Daily (ten questions, persistence, practice runs, date determinism), stats, settings persistence, themes, reset, corrupt storage, data sources, fact sheet, search, subpath asset paths, offline reload with an unvisited category, 320 px long-name fixture, install help and live announcements. Every test fails on any console error.
- **74 screenshots** (`design/screens/`) at 390×844, 375×812, 844×390 and 1440×900 in light and dark were reviewed; issues found in review and fixed include a CSS class collision that recoloured Sprint/Daily screens, the “vs” badge overlapping names, the Escape key leaking from sheets into the game, the service worker not controlling the first visit, sheets staying open across navigation, stat-card overflow, landscape results below the fold and low-contrast tertiary text.

## Known limitations
- **No physical iPhone or WebKit run.** The suite runs on Chromium with an iPhone profile (only Chromium is available in the build environment). Layout, safe areas and PWA behaviour follow iOS conventions, but real-device testing in Safari/standalone mode is still recommended.
- **iOS haptics** use the iOS 18 native-switch technique, which could not be verified on hardware here. On older iOS there is no haptic, and the setting is disabled where no mechanism exists.
- **GitHub Pages must be enabled once:** Settings → Pages → Source: *GitHub Actions*. Until then the deploy job in `.github/workflows/ci.yml` will fail while the check and e2e jobs still run.
- **Not included:** city populations (no consistent, reachable open source) and aircraft/vehicle specifications (no openly licensed, consistently defined dataset).
- **Wikidata-derived pools** depend on community data. Conflicting records are excluded, but a single wrong record can't always be detected; obvious outliers are flagged in DATA-COVERAGE.md.
- **Data refresh** relies on public endpoints (QLever for Wikidata, which rate-limits aggressively; the fetcher backs off and falls back to the official endpoint).
- **Offline Daily Challenge** cannot offer global leaderboards, central anti-cheat or cross-device sync.

## Where to look
README (setup, deploy, data refresh) · DECISIONS (why) · PARITY (requirement → code → test) · DATA-COVERAGE (dataset) · AGENTS (rules for future changes) · design/ART-DIRECTION and design/DATA-SOURCES.
