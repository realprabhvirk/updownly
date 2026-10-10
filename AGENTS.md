# AGENTS.md — rules for changing UPDOWNLY

## Product
- The app is **UPDOWNLY** (package/storage slug `updownly`). Tagline: “Higher or lower. How far can you go?” — use it sparingly.
- Offline-first, private: no backend, accounts, analytics, ads or runtime network calls. Data ships in the bundle.
- Never add fabricated, estimated or LLM-generated facts. Every fact must come from a licensed source through the pipeline.

## Data
- Edit sources/collections/metrics only in `src/data/definitions.ts`; never hand-edit `src/data/generated/`.
- One collection = one comparison group (metric + unit + period + source). Never compare across collections.
- New rules go in the source module under `scripts/data/sources/`, log every rejection via `ExclusionLog`, and add a unit test for any conversion (`src/data/units.ts`).
- After data changes: `npm run data:build && npm run data:validate && npm run data:report`, and bump `DATA_VERSION` (and `DAILY_ALGORITHM_VERSION` if Daily sequences change).

## Game logic
- Engine code in `src/game/` stays pure and UI-free. Scoring happens only in `GameEngine.answer`.
- Every transition must validate the phase; timers must check `gameId` + question index before acting.
- Never render or announce a hidden value before the answer (`hiddenValue()` exists for placeholders).
- Inject `Rng` and `CompetitiveClock`; tests must be deterministic.

## UI & design
- Use tokens from `src/design/tokens.css`; no new raw colours in components. Solid fills only: no gradients, glow, glass or emoji icons.
- Icons: Phosphor bold via `<Icon>`; add names to `scripts/gen-icons.ts` and run `npx tsx scripts/gen-icons.ts`.
- Display font: Bricolage Grotesque; numbers use tabular figures. UI text uses the system stack.
- Touch targets ≥ 44 px, visible focus, colour never the only signal, respect `data-motion="reduce"`.
- All copy in British English.

## Quality gates
- The repo root is the deployed site. After **every** code change run `npm run build` and commit the regenerated root files (`index.html`, `assets/`, `icons/`, `sw.js`, `manifest.webmanifest`, `workbox-*.js`, `favicon.svg`, `_headers`). Never edit them by hand; edit `src/index.html` and `public/` instead.
- `npm run check` and `npm run test:e2e` must pass. Review screenshots (`npm run screens`) after visual changes — look at them, don't just generate them.
- Wrap every storage access (see `src/services/storage.ts`). Keep paths relative; never assume hosting at `/`.
