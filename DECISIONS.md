# DECISIONS.md

Significant decisions, with the reasoning. Newest considerations last within each section.

## Platform & architecture

1. **Stack as specified:** Vite 7, strict TypeScript, Preact 10 (not 11, as the brief requires), `@preact/signals`, `vite-plugin-pwa` 2, Vitest 4, Playwright. `@playwright/test` is pinned to 1.56.1 so it matches the Chromium build preinstalled in the development container.
2. **Relative base (`./`) + hash routing.** One build works at a domain root and under any GitHub Pages subpath, survives reloads without server rewrites, and keeps the service worker scope correct. `BASE_PATH` can still force an absolute base.
3. **Lockfile resolved with npm 11.** npm 10.9 hit an Arborist bug (`edgesOut`) when resolving Vitest 4.1's peer graph. The lockfile works unchanged with `npm ci` on npm 10 (verified), which is what CI uses.
4. **Collections load lazily** as separate JSON chunks via `import.meta.glob`; the small manifest is bundled eagerly. Every chunk is precached by the service worker so all categories work offline.
5. **Service worker:** Workbox `generateSW`, `registerType: 'prompt'` (updates wait for the player) plus `clientsClaim: true` (the first install controls the page immediately, so offline works without a second visit). The update banner is suppressed while a game is active.
6. **E2E build mode** (`vite build --mode e2e`) adds URL-driven seeds/dates, an optional fixture category (`?fixtures=1`) and a read-only `window.__updownly` hook so tests can answer deterministically. All of it sits behind the compile-time `__E2E__` constant and is stripped from production.

## Data

7. **Seven sources, all redistributable:** World Bank WDI (CC BY 4.0), NASA Exoplanet Archive (public domain, acknowledgement shown), OurAirports (public domain), USDA FoodData Central SR Legacy (CC0), Wikidata (CC0), Amniote Life-History Database (CC0 via figshare), PubChem periodic table (public-domain U.S. Government compilation).
8. **One collection = one comparison group.** Simpler and safer than mixing periods at runtime: the engine physically cannot compare across metrics, units or years.
9. **World Bank: one fixed year per indicator** — the latest year with ≥ 85 % of the best country coverage since 2010 — rather than many historical years. Plays better (current numbers) and avoids padding the count with near-duplicate history.
10. **Wikidata via QLever.** The official query service timed out on these queries; QLever (University of Freiburg) serves the same CC0 data in seconds. The fetcher falls back to the official endpoint. Numeric filters are applied in post-processing because QLever mishandled decimal FILTERs.
11. **Wikidata statement resolution:** ignore deprecated statements and part-of-entity statements (`P518`); a preferred statement wins; otherwise values must agree within 0.5 % or the entity is excluded. Building heights in particular are messy (roof vs spire vs antenna), so conflicts are excluded, not guessed.
12. **Notability filters** (Wikipedia language editions) keep pools to things players can picture. Bird/mammal thresholds are higher because some Wikipedias bot-generate species articles.
13. **Skyscrapers** must show evidence of completion (opening date or “in use” state); height and floor counts are cross-checked (2.4–8 m per floor) and towers over 120 floors need a corroborating height.
14. **Food:** SR Legacy per-100 g values only; zero amounts are excluded because a 0 g reference makes the next answer certain. Branded, fast-food, restaurant, baby-food and commodity items are excluded.
15. **Animals:** mean adult body mass and *maximum recorded* longevity are separate pools, never mixed with averages. Sub-six-month “maximum” lifespans are excluded as implausible records.
16. **Elements:** melting/boiling points at 1 atm only (He, C, As excluded); density only for solids; elements above einsteinium excluded from physical pools (predicted values).
17. **Exoplanets:** archive “calculated” values excluded; mass uses true masses only (no M sin i, no mass–radius estimates); distance is per host system, converted from parsecs with the IAU factor.
18. **Display names** for a handful of World Bank economies (“Korea, Rep.” → “South Korea”) and Wikidata country labels (“People's Republic of China” → “China”) are display-only; identity stays the ISO/QID code.
19. **Dataset size: 68,481 observations**, above the 20–50k target band. Every pool was already filtered for quality; cutting further would have meant arbitrary truncation. Lazy per-collection loading keeps runtime cost low (largest chunk ≈ 90 KB gzipped).
20. **Not included:** city populations (no reachable open source with one consistent reference period — UN WUP links moved, US Census API unreachable, Wikidata mixes census years) and aircraft/vehicle specs (no openly licensed, consistently defined dataset). Documented as incomplete areas.

## Game design

21. **Difficulty by percentile distance** inside the pool: Easy ≥ 0.30, Normal 0.06–0.60, Hard 0.005–0.12. Works for negatives, zeros and ten orders of magnitude, unlike ratios. Ties share an average rank.
22. **No ambiguous questions:** challengers with equal values *or identical displayed values* (e.g. 27.21 vs 27.24 million both showing “27.2 million”) are rejected.
23. **Queue:** unused items first, random side choice (so the answer isn't predictable from which side has more room), band → widen → recycle → reuse, all bounded. Normal/Hard starts avoid the extremes.
24. **Continue tap** after each reveal in Classic and Daily (the brief asks not to rush players); Sprint auto-advances (0.7 s after a right answer, 1.1 s after a miss) because the clock is the point.
25. **Daily Challenge:** ten questions that continue after misses (so 10/10 is meaningful), category drawn from the featured pool by a versioned FNV hash of the date and never the same as yesterday, Normal difficulty. Re-plays are explicit practice runs and can never overwrite the official result.
26. **Sprint clock** = max(monotonic elapsed, wall-clock elapsed): suspension can't pause it and moving the system clock back can't add time. The clock starts with the first question, not on the ready screen.
27. **Abandoned games create no record at all** (not even totals), so leaving early can never manufacture a stat.
28. **Quick Play / Sprint cards** start in a random featured category with a short ready screen; the category sheet starts directly because it already shows all the details.

## Design

29. **Bricolage Grotesque** (variable, optical-size axis, tabular figures) over Archivo Black: equally bold at numeral sizes but with more character in the wordmark and titles; the `opsz` axis keeps big numbers tight. System font for UI text.
30. **Brand mark:** two solid block arrows (white up, butter down) on cobalt, drawn by hand on a 1024 grid with a clear gap so they read at 60 px. All icon sizes are rendered from the one master by `npm run icons`.
31. **Answer buttons stacked** — Higher above Lower — so the spatial metaphor matches; both use the same strong fill so neither looks like “the right one”. Arrow chips differ (cobalt/butter) for quick recognition.
32. **Reference card in the category colour, challenger on a neutral surface**, turning solid mint/coral on reveal with a ✓/✗ badge and verdict text — colour is never the only signal.
33. **Haptics** use the Vibration API where present and the iOS 18 native-switch technique on iPhone; otherwise the toggle is disabled with an explanation.
34. **Sounds** are synthesised with Web Audio (no files, nothing before a tap).
