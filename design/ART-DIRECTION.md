# Art direction

**Bold, playful, confident, clean.** Solid colour fields, big numbers, strong type and deliberate rhythm — an App Store game, not a web page.

## Principles
- **Numbers are the hero.** Values set in Bricolage Grotesque 800 at up to 60 px with tabular figures; units smaller and lighter beside them.
- **Solid colour, no effects.** No gradients, glow, glass, blur or gradient text. Shadows only on floating sheets and the segmented thumb.
- **Colour identifies, text explains.** Category colours mark groups; correctness is always also shown by a ✓/✗ badge, an icon and words.
- **Hierarchy through blocks.** Quick Play is a full-width cobalt block; Daily (butter) and Sprint (ink) sit side by side; each category group opens with one large colour tile followed by smaller neutral tiles.
- **Thumb-first game screen.** Reference card on top (category colour), challenger below (neutral, then mint/coral on reveal), answers stacked at the bottom — Higher above Lower.

## Palette (source of truth: `src/design/tokens.css`)
| Token | Hex | Use |
|---|---|---|
| Ink | `#101827` | Text, strong buttons, hero blocks |
| Cobalt | `#3155E8` | Brand, primary actions, Quick Play |
| Cloud | `#F5F6F8` | Light background |
| White | `#FFFFFF` | Surfaces |
| Mint | `#2EA87C` | Correct |
| Coral | `#F16C5B` | Incorrect |
| Butter | `#F2CF5B` | Records, streaks, Daily, achievements |
| Lilac | `#A597F5` | Space & Science group |
| Sky | `#91BFF0` | Secondary accent |
| Slate | `#596678` | Secondary text |

Group colours: World `#8DB8F2`, Geography `#7CCBA2`, Space `#A597F5`, Transport `#F2A65A`, Animals `#E3BC8E`, Food `#F2CF5B`, Buildings `#C3CAD5`, Culture `#F2A9C9`. Ink text sits on all of them (contrast ≥ 7:1).

Dark theme: background `#0B111C`, surfaces `#151D2B`/`#1D2738`, text `#F2F4F8`; category colours keep their fills with ink text; the "strong" token inverts to near-white so answer buttons stay the most prominent element.

## Type
- Display: **Bricolage Grotesque** (variable, `opsz` + `wght`, SIL OFL), self-hosted latin + latin-ext subsets.
- UI: system stack (`-apple-system`, SF Pro on iOS).
- Uppercase eyebrow labels at 12 px with 0.08–0.12 em tracking for section and mode labels.

## Brand mark
Two solid block arrows on a cobalt square: white pointing up, butter pointing down, the second a half-turn rotation of the first, separated by a clear gap. Master: `design/brand/updownly-mark.svg`; every PNG size is rendered from it (`npm run icons`). Recognisable at 60 px; no text in the icon.

## Motion
Short and purposeful: reference card slides up as the challenger becomes the reference (420 ms), revealed value counts up (450 ms) with a small pop, verdict badge springs in, records get a badge pop. Everything collapses to instant under reduced motion (system setting or Settings).
