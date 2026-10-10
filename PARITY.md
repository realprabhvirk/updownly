# PARITY.md — brief requirements → implementation → verification

✅ done and verified · ⚠️ done with a documented limitation

## Identity & branding
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Name UPDOWNLY everywhere; `updownly` slug | ✅ | `src/design/strings.ts`, `index.html`, manifest in `vite.config.ts`, `package.json`, storage key `updownly:v1` | screenshots; `grep` |
| Tagline used sparingly | ✅ | Play header only (`PlayScreen.tsx`), README | screenshots |
| Original geometric up/down mark, not "UP OR DOWN" wordmark | ✅ | `design/brand/updownly-mark.svg`, `BrandMark.tsx` | `design/brand/updownly-icon-1024.png` |
| 1024 master, 192/512, maskable, apple-touch, favicon | ✅ | `scripts/icons.ts`, `public/icons/`, `public/favicon.svg` | built `dist/manifest.webmanifest` |

## Technical
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Vite 7, strict TS, Preact 10, signals, vite-plugin-pwa, Vitest, Playwright | ✅ | `package.json`, `tsconfig.*.json` | `npm run check` |
| No backend/analytics/ads/runtime API/CDN | ✅ | all assets bundled; fonts in `src/assets/fonts` | e2e "serves every asset from the subpath", offline test |
| Safe storage, works without storage | ✅ | `src/services/storage.ts` | `tests/unit/storage.test.ts`, e2e "corrupt saved data" |
| GitHub Pages subpath + domain root | ✅ | relative base + hash router (`vite.config.ts`, `src/app/router.ts`) | e2e runs at `/updownly/`; asset-path test |
| Persist totals, bests, per-category, daily, achievements, recent, prefs | ✅ | `SaveData` in `storage.ts`, `game.ts#onFinished` | unit + e2e persistence tests |
| Limited history; reset option | ✅ | `MAX_RECENT_GAMES = 20`; Settings reset/clear | e2e "reset clears…", unit "limits history" |

## Design
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Palette tokens, dark theme, single source | ✅ | `src/design/tokens.css`, `tokens.ts`, `design/ART-DIRECTION.md` | screenshots light/dark |
| Display font (self-hosted), system UI font, tabular numbers | ✅ | Bricolage Grotesque in `tokens.css`; `.tabular`, `.fact-number` | screenshots |
| No gradients/glass/glow/emoji icons | ✅ | CSS uses solid fills only; Phosphor SVG icons | review of `src/styles/*` |
| Consistent licensed icon set | ✅ | Phosphor bold, `scripts/gen-icons.ts`, MIT licence in `src/assets/` | — |
| Long names / big numbers never clip | ✅ | line-clamp, `overflow-wrap:anywhere`, clamp() sizes | e2e "narrow screens" (320 px fixture) |

## Screens & flow
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Bottom nav Play · Stats · Settings, safe areas | ✅ | `App.tsx` `TabBar`, `--safe-*` tokens | screenshots |
| Play: wordmark, tagline, best-streak chip, Quick Play / Daily / Sprint | ✅ | `PlayScreen.tsx` | e2e Quick Play test |
| Category browser: groups, varied tile sizes, counts, search, filters | ✅ | `PlayScreen.tsx#Browser`, `CategoryTile.tsx` | e2e search test |
| Only playable categories shown | ✅ | `catalog.ts` (`MIN_POOL_SIZE`) | `data.test.ts` |
| Category sheet: description, statistic, period, count, source, difficulty, start | ✅ | `CategorySheet.tsx` | e2e category test |
| Short pre-game screen with first-game instructions | ✅ | `GameScreen.tsx#ReadyView` | screenshot `ready-first-game` |

## Core gameplay
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Reference + challenger, hidden value, Higher/Lower buttons ≥ 44 pt | ✅ | `GameScreen.tsx`, `FactCard.tsx`, `AnswerButtons.tsx` (64 px) | e2e |
| Answer registered once; reveal; correct direction; feedback; Continue | ✅ | `engine.ts#answer`, `Verdict`, continue button | unit "scores once", e2e "rapid taps" |
| Formatting per metric with units and period | ✅ | `src/data/format.ts` | `format.test.ts` |
| Fact detail sheet: value, unit, period, source link, method | ✅ | `FactSheet.tsx` | e2e "fact detail sheet" |
| Same metric/unit/period only; no unknowns as zero; no ties; no leaks | ✅ | one comparison group per collection; `buildPool`; `isValidPair`; `hiddenValue()` | `queue.test.ts`, `data.test.ts`, e2e "hidden values are not in the DOM" |
| Explicit conversions tested | ✅ | `src/data/units.ts` | `units.test.ts` |
| Queue: no repeats until exhausted, no self/duplicate, no infinite loops | ✅ | `src/game/queue.ts` | `queue.test.ts`, `engine.test.ts` |
| Classic: one miss ends; record only when finished | ✅ | `engine.ts#next`, `scoring.ts#recordFromState` | unit + e2e "leaving early creates no record" |
| Sprint: 60 s monotonic clock, misses continue, no free time when suspended | ✅ | `clock.ts`, `engine.ts#tick` | unit suspend/rewind tests, e2e with `page.clock` |
| Daily: 10 questions, deterministic by date + version, offline, saved once, practice runs | ✅ | `daily.ts`, `game.ts#onFinished` | `daily.test.ts`, e2e daily tests |
| Results: score, accuracy, best streak, category, mode, record treatment, replay/change/back, share | ✅ | `ResultsScreen.tsx`, `services/share.ts` | e2e + screenshots |
| Explicit state machine, stale timers ignored, listeners cleaned up | ✅ | `engine.ts`, `GameScreen.tsx` effects | `engine.test.ts` |

## Fact database
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| ≥ 10,000 distinct source-backed observations | ✅ 68,481 | `src/data/generated/` | `data.test.ts`, `npm run data:validate` |
| ≥ 20 collections, ≥ 6 groups, multiple sources | ✅ 45 / 8 / 7 | `definitions.ts` | `data.test.ts` |
| Reproducible pipeline (acquire → parse → normalise → attribute → reject → group → generate → report → validate) | ✅ | `scripts/data/*` | `npm run data:refresh` |
| Typed schema with provenance, stable ids | ✅ | `src/data/schema.ts`, `loader.ts#expandRow` | `data.test.ts` |
| Validation of ids, duplicates, names, sources, metrics, finite values, units, periods, licences, pool sizes, ties, outliers | ✅ | `src/data/validate.ts` | runs before every build; unit tests |
| DATA-COVERAGE.md computed from actual data | ✅ | `scripts/data/report.ts` | regenerated |
| About/Data Sources screen | ✅ | `SourcesScreen.tsx` | e2e "data sources screen" |
| City populations, aircraft specs | ⚠️ not included | see `DATA-COVERAGE.md` → Limitations | — |

## Stats, settings, feedback
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Stats: games, best Classic, best streak, correct, accuracy, best category, daily completed/streak, recent, achievements | ✅ | `StatsScreen.tsx` | e2e "stats reflect…" |
| Real achievements, celebrated once | ✅ | `achievements.ts` | `scoring.test.ts` |
| Settings: mode, difficulty, sound, haptics, reduced motion, theme, data sources, clear history, reset (confirmed), about/version/build/privacy/install | ✅ | `SettingsScreen.tsx` | e2e settings/reset tests |
| Sounds local, after interaction only | ✅ | `services/audio.ts` | — |
| Haptics where supported, graceful otherwise | ⚠️ | `services/haptics.ts` (iOS 18 switch technique unverified on a physical device) | — |
| Reduced motion | ✅ | `data-motion` attribute + CSS | — |

## PWA & accessibility
| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Manifest, standalone, theme colours, viewport-fit=cover, apple touch icon | ✅ | `vite.config.ts`, `index.html` | built output |
| Offline after first load incl. reload | ✅ | Workbox precache + `clientsClaim` | e2e offline test |
| Update prompt that never interrupts a game | ✅ | `main.tsx` + `UpdateBanner` | — |
| iOS install instructions, never claims installed | ✅ | `InstallSheet.tsx`, Play hint | e2e install help test |
| Keyboard, focus, accessible names, live announcements, no answer leaks | ✅ | `AnswerButtons`, `Segmented`, `BottomSheet` focus trap, `announce.ts` | e2e keyboard + announcement tests |
| Contrast (AA) | ✅ | tokens tuned (`--text-3`) | computed ratios in DECISIONS/ART-DIRECTION |

## Testing, CI, docs
| Requirement | Status | Where |
|---|---|---|
| Unit tests (data, engine, persistence) | ✅ 105 tests | `tests/unit/` |
| E2E (mobile viewport, subpath, offline, themes, narrow screens, no console errors) | ⚠️ 25 tests on Chromium with an iPhone profile; WebKit not run | `tests/e2e/` |
| Screenshots at 390×844, 375×812, 844×390, 1440×900, light & dark, reviewed | ✅ 74 | `design/screens/` |
| Scripts (dev/build/preview/typecheck/test/test:e2e/data:validate/data:report/check) | ✅ | `package.json` |
| GitHub Actions: typecheck, tests, data validation, build, deploy to Pages | ✅ | `.github/workflows/ci.yml` |
| README, AGENTS, DECISIONS, PARITY, PLAN, DATA-COVERAGE, HANDOFF-REPORT | ✅ | repo root |
