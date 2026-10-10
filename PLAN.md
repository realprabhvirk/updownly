# PLAN.md

Milestones from the build brief and their status. A milestone is marked done only when it is implemented **and** verified (tests, validation or reviewed screenshots).

| # | Milestone | Status | Evidence |
|---|---|---|---|
| 1 | Foundation — scaffold, tokens, typography, routing, manifest, icons, AGENTS/DECISIONS | Done | `vite.config.ts`, `src/design/tokens.css`, `src/app/router.ts`, `public/icons/`, `design/brand/` |
| 2 | Fact acquisition & validation — pipeline, schema, comparison pools, coverage report | Done | `scripts/data/`, `src/data/validate.ts`, `DATA-COVERAGE.md` (68,481 facts, 45 collections, 8 groups, 7 sources), `tests/unit/data.test.ts` |
| 3 | Game engine — comparisons, scoring, difficulty, deterministic RNG, queue, state machine | Done | `src/game/`, `tests/unit/{engine,queue,difficulty,daily,scoring,rng}.test.ts` |
| 4 | Visual application — Play, browser, category sheet, game screen | Done | `src/screens/`, `design/screens/*` |
| 5 | Modes & results — Classic, Sprint, Daily, results, persistence | Done | `tests/e2e/gameplay.spec.ts` |
| 6 | Stats & settings — stats, achievements, themes, sound, haptics, attribution, reset | Done | `src/screens/{StatsScreen,SettingsScreen,SourcesScreen}.tsx`, `tests/e2e/app.spec.ts` |
| 7 | PWA & offline — precache, update prompt, install help, offline reload | Done | `vite.config.ts` (workbox), offline e2e test |
| 8 | Quality assurance — tests, screenshots in both themes and four viewports, fixes | Done | 105 unit tests, 25 e2e tests, 74 screenshots reviewed |
| 9 | Deployment — Pages workflow, README, data report, parity checklist, handoff | Done | `.github/workflows/ci.yml`, `README.md`, `PARITY.md`, `HANDOFF-REPORT.md` |

## Next ideas (not in scope for v1)
- WebKit in CI once the suite is proven stable there.
- A consistent, openly licensed city-population source.
- Historical "eras" for World Bank indicators as separate collections.
