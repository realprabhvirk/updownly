# Data sources — working notes

Licence checks done before bundling (October 2026). The authoritative per-source metadata is `SOURCES` in `src/data/definitions.ts`; the generated report is `DATA-COVERAGE.md`.

| Source | Access | Licence | Used for | Notes |
|---|---|---|---|---|
| World Bank WDI | `api.worldbank.org/v2` | CC BY 4.0 | 13 country indicators | Aggregates removed via country metadata (`region.id = NA`). |
| NASA Exoplanet Archive | TAP `pscomppars` | Public domain; acknowledgement requested | Radius, mass, orbital period, system distance | `CALCULATED_VALUE` reflinks excluded; true masses only. |
| OurAirports | GitHub mirror CSVs | Public domain | Airport elevation, longest open runway | Large/medium airports with scheduled service. |
| USDA FoodData Central SR Legacy | Zipped CSV (2018-04) | CC0 1.0 | Energy, protein, sugar, fat, fibre per 100 g | Brand/fast-food/restaurant/baby/commodity items excluded. |
| Wikidata | QLever endpoint (fallback WDQS) | CC0 1.0 | Mountains, rivers, lakes, islands, waterfalls, skyscrapers, dams, bridges, tunnels, stadiums, films; taxon notability | English label + enwiki article required; conflicts excluded. |
| Amniote Life-History Database | figshare 10.6084/m9.figshare.3563457 | CC0 1.0 | Body mass (mammals, birds, reptiles), maximum longevity | Common name + notability filter. |
| PubChem periodic table | PUG REST JSON | Public-domain U.S. Gov. compilation | Atomic number/mass, melting/boiling point, density | Consistent-conditions rules (1 atm, solids). |

Considered and not used:
- **UN World Urbanization Prospects** (city populations) — download URLs had moved; not reachable at build time.
- **US Census API** — unreachable from the build environment.
- **Wikidata city populations** — mixed census years and methods; would violate the single-period rule.
- **HYG star database** — CC BY-SA; share-alike would have applied to the bundled dataset, and exoplanet host distances already cover stars.
- **GeoNames** city populations — mixed reference dates.
