# Recipe illustrations (2026-11-12, rev 2: child-drawn style)

PO: recipe card and recipe page feel "sad". PO chose a shared dish-type SVG set, tiny, offline, no licensing. Rough look to react to: `design/preview/illustrations.html` (light, dark, sizes, play button; `illustrations-standalone.html` is the same page with tokens inlined, opens from file://). The preview is the drawing reference for shape and colour; the production SVGs are written by the developer from section 3 and may refine paths, never colours or motion. Motion rules follow `design/motion.md`; this file adds the only permitted ambient loops (motion.md rule 4 otherwise forbids loops).

## 1. Dish types (exactly 18; id = the `dishType` enum value, also the SVG component name)
onigiri, rice-bowl, sandwich, noodles, egg, fried-chicken, meat-patty, meat-roll, grilled-fish, simmered, tofu, salad, soup, vegetable-side, fritter, dumpling, sweet, other.
Labels are never shown (decorative); no copy needed. A recipe maps to exactly one type. Recipes without a type, or with a value not in the list, render `other` (section 5). The recipe data has to carry the type (gap, section 7).

## 2. Visual style
- **viewBox `0 0 120 120`, square.** Decision: square, because the same drawing is shown in three differently shaped frames (card strip 72/120 px high and full width, thumb 64 wide, hero 150 high). It is centred with `preserveAspectRatio="xMidYMid meet"` on the existing `.recipe-art` panel (`--surface-3`, stripe band kept), so side areas are panel colour and nothing is cropped. The drawing stays inside a 100x100 safe area (10 px margin) so the blob never touches the edge.
- Flat fills, no gradients, no shadows. **No SVG filters at all** (no feTurbulence, feDisplacementMap, blur, drop-shadow): they are slow and heavy on phones. All wobble is static path data. Round caps and joins, as `Icon.tsx`. Strokes scale with the drawing (no `vector-effect`): at 72 px they render about 1.2 px, which still reads because the line colour has 7:1 on the panel.
- **Soft blob:** one organic blob per dish (`M16 62C14 34 40 16 66 20c26 4 40 24 38 46-2 24-24 38-46 36C34 100 18 86 16 62Z`, no stroke), `--illus-blob-warm` for warm dishes (onigiri, rice-bowl, sandwich, egg, fried-chicken, meat-patty, meat-roll, simmered, fritter, sweet, other) and `--illus-blob-cool` for the rest. Blob is texture only (1.1 to 1.6:1 on the panel on purpose).
- **Legibility rule:** shape is carried by the outline, never by fill contrast alone. Every filled shape has the `--illus-line` outline (exceptions: tiny dots, sparkles, steam). Fills are not required to reach 3:1 (decorative, `aria-hidden`); outline and steam do, see audit.
- **Palette.** Existing: `--illus-rice, -egg, -green, -brown, -nori, -pink`, `--surface-2` (empty ware: bowls and plates). New (8), light / dark:

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--illus-line` | `#3F4B66` | `#CDC6B8` | all outlines |
| `--illus-steam` | `#7B859B` | `#B5BCCC` | steam, sparkles |
| `--illus-red` | `#D9564B` | `#EE8B80` | tomato, sauce, strawberry |
| `--illus-orange` | `#E58A3A` | `#EDA460` | carrot, salmon, fried coating |
| `--illus-tan` | `#D9AE6C` | `#D8B47A` | bread, noodles, batter, pastry |
| `--illus-blue` | `#4F7AB3` | `#7FA3D6` | bowl, fish tail |
| `--illus-blob-warm` | `#F5D6A8` | `#4A3F3F` | blob |
| `--illus-blob-cool` | `#C9DDE8` | `#2F4660` | blob |

Neither mode uses pure white or black. `--illus-nori` in dark (`#141B2B`) sits on rice or egg only, never directly on the panel. Added to `tokens.json` and `tokens.css` (all three dark blocks).
- Contrast (computed): line on `surface-2` / `surface-3` light 8.57 / 7.29, dark 9.01 / 7.74. Steam light 3.64 / 3.10, dark 8.03 / 6.90. Blue light 4.33 / 3.69. Red light 3.84 / 3.26. Orange and tan in light are below 3:1 (2.57 / 2.02 on `surface-2`): allowed because the 2 px outline carries the shape (rule above); everything is decorative.

## 2b. Child-drawn look (rev 2; PO: "looks like a child drew it")
Applies to all 18 types, both themes; colours stay on tokens (no new colour; crayon feel comes from the offset, not a new hue).
1. **Fill misregistered from the outline.** Each filled shape is two paths: a fill path (no stroke) and an outline path (stroke only, `fill: none`). The fill is the same shape shifted 2-4 units in a random direction (different per shape), scaled 100-107 percent about its centre, with its own 1.5 unit point jitter, so colour spills past the line on one side and leaves a gap on the other. Draw order: fill first, outline on top.
2. **Wobbly outlines.** No perfect circles, no straight edges. Author each shape as 6-10 points (ellipses 9), add a midpoint on every straight edge, move every point randomly by up to 1.2 units, join with smooth curves (Catmull-Rom to cubic). Outline starts at a random vertex, runs about 40 percent past its start (overshoot at the closing corner, ends 0-2 units off, never closes exactly). Line weight varies per path, 2 to 3.5 (caps round). Small lines (stripes, slices, pleats) are 3-point curves with a 2 unit bend.
3. **Uneven dots and doodles.** Dots (eyes, scallion, sprinkles, blush) differ in radius by 15 to 20 percent and sit 1 unit off their ideal spot. Every dish has 3 to 5 static doodles in the blob corners: a 4-point sparkle (3 to 7 units, `--illus-steam`), a small heart (3 to 4.5, `--illus-red`, no outline), a steam-colour squiggle (2 px, two bumps), a dot (1.5 to 2.5). Sizes never repeat within one drawing. Doodles are static (not animated) and never overlap the dish.
4. **Lopsided kawaii faces** on onigiri, egg, tofu, dumpling, fritter, sweet (not the others). Eyes `nori` dots: left r 2-3 at y, right r 2.8-4 about 1.5 to 3.5 units higher and 8-10 units right; mouth a 2 px open curve, 5-7 wide, 4-6 deep, one end 0-2 lower; blush two `pink` dots r 2-4, left 16 units out and 6 down, right 16 out and 3-5 down, different sizes.
5. **Steam** is a hand-drawn squiggle, three bumps with unequal amplitude (see preview `steam()`), 2.5 px.
6. **How the paths are made.** The preview generates the wobble with a seeded script (seed = dish index x 977 + 13, so each type always looks the same, light and dark, every render). **Production ships baked static path data, no runtime randomness:** the developer runs the same generator once at authoring time (script kept under `tools/`, not shipped), rounds coordinates to integers (stroke widths and dot radii to 0.1), commits the output, and may hand-tune any path. A dish may be redrawn by hand as long as it follows rules 1 to 5.
7. **No boil.** A boil effect (two outline variants swapped at about 4 fps) is not worth it: it needs a JS or stepped-CSS timer per drawing, doubles the path data (the budget is already tight), and repaints the whole SVG every 250 ms, which is exactly the battery cost the motion policy avoids. Not specified, not allowed. The wobbly feel comes from the static paths plus the existing slow loops (wobble, sway, steam squiggle).

## 3. Compositions and animations (coordinates are in the 120 box; the preview has working paths)
Common: draw order blob, ware, food, face, garnish, steam/sparkle; every shape per section 2b; coordinates below are the clean base points before wobble; each type's faces and doodles are as 2b rules 3-4 (the preview shows the placement). Animation notes use these shared keyframes; **at most 2 animated groups per illustration, transform and opacity only**:
`steam`: wisp = 2 s-curve strokes 2.5 px `--illus-steam`; 3.6 s `ease-in-out` infinite, wisp 2 delayed 1.8 s; 0% `opacity 0, translateY(5px)`, 40% opacity .9, 100% `opacity 0, translateY(-7px)`. `twk` (sparkle): 4-point star 10 px, 2.4 s ease-in-out, scale .4 to 1 with opacity 0 to 1 to 0, star 2 delayed 1.2 s, origin centre. Amplitudes: rotate max 3 degrees, translate max 3 px, scale 3 to 4 percent. `transform-box: fill-box` on every animated group.

| Type | Composition | Animation (group, transform, origin, timing) |
|---|---|---|
| onigiri | Rounded triangle of `rice`, apex 60,26, base 34 to 86 at y 88. Navy `nori` band across the lower third (45,70 to 75,88). Two nori dots as eyes (52,58 / 68,58), two `pink` cheeks (46,64 / 74,64). Blob warm. | Whole onigiri: rotate -2 to 2 deg, origin bottom centre, 3.2 s ease-in-out alternate-like infinite. |
| rice-bowl | `blue` half-round bowl (24 to 96, y 62 to 98). `rice` mound above (28 to 92, y 32 to 62). `egg` yolk circle r9 centre top, two `green` leaf strokes. | Steam, 2 wisps (x 46 and 66, y 34 up). |
| sandwich | Side view, 4 layers: `tan` top bread dome (y 36 to 56), `green` wavy lettuce, `red` tomato bar, `pink` ham bar, `tan` bottom bread (y 85 to 99). | Top bread: translateY 0 to -3 px, 3.6 s ease-in-out infinite (the only moving group; lettuce stays). |
| noodles | Blue bowl, `tan` noodle mound with two wavy outline strokes, `egg` half-egg (74,52), `nori` rectangle (42,44), steam. | Steam, 2 wisps. |
| egg | Tamagoyaki: `egg` rounded rectangle (24 to 96, y 42 to 84, r10), spiral-end stroke at the left, three slice lines (46, 60, 82). | Whole piece: rotate -2 to 2 deg, origin bottom centre, 3.2 s ease-in-out. |
| fried-chicken | Two nuggets, `orange` (centre 48,66) and `tan` (centre 78,72), small crumb ticks, `green` lettuce leaf lower left. | Two sparkles (upper right 88,40, upper left 32,44), `twk`. Sizzle feel. |
| meat-patty | `brown` oval patty (62,68, 32x22) with three diagonal grill lines, `red` sauce dab, `green` leaf at the left. | 1 steam wisp at x 48 to 68 (single wisp; wisp 2 omitted). |
| meat-roll | Two round slices (centres 40,58 / 80,64, r20), rings: `brown` outer, `pink` middle, `green` centre. | Both slices as one group: rotate -2 to 2 deg, origin centre-bottom, 3.2 s. |
| grilled-fish | `orange` fish body facing left (22 to 84, y 44 to 80), eye `nori` dot (38,58), three gill/stripe lines, `blue` tail (82 to 98), `green` garnish line below. | Tail: rotate -2 to 2 deg, origin tail joint (left edge of tail, 82,60), 3.4 s ease-in-out. |
| simmered | Blue bowl, `brown` glaze surface, pieces: `orange` carrot circle, `rice` daikon circle, small `orange`, `green` pea. | Steam, 2 wisps. |
| tofu | Isometric block of `rice` (30 to 90, y 44 to 88), edge lines, `green` scallion dots, one `brown` soy dot. | Block: scaleY 1 to .96, origin bottom centre, 3 s ease-in-out (a wobble). |
| salad | `blue` bowl (y 66 to 102), leaf mass of `green` above it, two `red` tomatoes, `egg` dot at the bowl. | Leaves group only: rotate -3 to 3 deg, origin bottom centre, 4 s ease-in-out (leaf sway). |
| soup | Blue bowl, `orange` broth ellipse at the rim, `rice` tofu cube, two `green` onion dots, steam. | Steam, 2 wisps. |
| vegetable-side | Plate (`surface-2`, ellipse bowl y 74 to 96), three `green` broccoli florets (r10 to 12) with stems, `orange` carrot stick at right. | Florets group: translateY 0 to -2 px, 3.6 s ease-in-out. |
| fritter | Rippled golden `tan` piece (24 to 94, y 44 to 80), `orange` crumb ticks, `red` dip dab (80,85). | Two sparkles, `twk` (as fried-chicken). |
| dumpling | Crescent gyoza of `rice` (20 to 100, y 38 to 84), 5 pleat lines on top, `green` garnish line below. | Dumpling: scale 1 to 1.03, origin bottom centre, 3.2 s ease-in-out (puff). |
| sweet | `tan` dome (24 to 96, y 48 to 76), `pink` icing with scalloped edge, `red` strawberry (60,44, r7). | Two sparkles at the corners, `twk` (sprinkle). |
| other | Bento box seen from above: `surface-2` rounded rectangle (22 to 98, y 40 to 92, r12), centre divider, `rice` half-dome left, `egg` circle, `green` and `red` dots right. | Box: translateY 0 to -2 px, 3.6 s ease-in-out (calm breath; the fallback must not look broken, so it moves like the others). |

## 4. Placement, loading, motion policy
| Where | Frame | Illustration |
|---|---|---|
| Recommendation card (`RecipeArt size="card"`) | full-width strip, 72 px high (below 768), 120 px (768+), `--surface-3`, stripe band 8 px kept | square drawing centred, height = frame height |
| Compact row / library row (`size="thumb"`) | 64 px wide, row-high (min 64) | centred, 64 px |
| Recipe page header (`size="hero"`) | 150 px high, radius 12, navy stripe kept | centred, 150 px; at 1280+ left column 400 px wide, same |
| Not-found, empty states | none | none |

- **Frames reserve their size in CSS today** (heights above), so there is no layout shift: the frame is painted first with an empty panel (`--surface-3`); the SVG fades in (opacity only, 120 ms, `--ease-enter`) when its lazy chunk arrives. No spinner. If the chunk fails to load, the empty panel with stripe stays (today's look); no error is shown, no retry UI.
- **Delivery.** Inline SVG React components in one lazy chunk `dish-art` (`React.lazy`, one module exporting the 18 components and a `DishArt({type,size})`), no `<img>`, no network request for images, no external files, SVG strings static. Own stylesheet of ~1.5 KB for the classes and keyframes (preview `<style>` is the reference), loaded with the chunk. Budget: the child-drawn paths are bigger. Measured on the preview data (18 drawings, integer coordinates, absolute commands, unminified): 42 KB raw, **13.8 KB gzip** (1-decimal coordinates would be 20 KB, so integers are required). Relative commands, dropping the doodles to 3 per drawing and merging identical classes should reach about 10 KB; **cap raised from 12 to 16 KB gzip** for the whole set. If the Orchestrator cannot give 16 KB, drop the doodles first (about 15 percent), then midpoints on straight edges. Orchestrator need: confirm the screens that render `RecipeArt` (recommendation cards, library, recipe) are already lazy chunks and that `dish-art` is a separate chunk loaded from them. The ~4 KB free in the 450 KB total is not enough for the main chunk, so if the recommendation cards are in the main chunk, raise the JS budget by 12 KB (to 462) instead of moving code.
- **Motion policy (decided for battery):**
  - **List cards and rows: static by default.** Animation plays only while the card is hovered (`@media (hover: hover)`), contains focus (`:focus-within`), or is pressed (`:active`). On touch it plays only during the press, so a scrolling list has zero running animations. One card animates at a time. Stops at once on leave (`animation-play-state: paused`, no snap back).
  - **Recipe page header: ambient, subtle, finite.** Starts at mount, runs **5 cycles** of its loop (about 16 to 18 s) and then rests at the first frame (`animation-iteration-count: 5`), so a page left open does not burn battery. Paused while the header is off-screen (`IntersectionObserver` toggles `data-paused`, `animation-play-state: paused`) and while the tab is hidden (the browser already pauses).
  - **Reduced motion** (`prefers-reduced-motion: reduce`): every illustration keyframe lives in `@media (prefers-reduced-motion: no-preference)`, so under `reduce` no animation exists (`getAnimations().length === 0`); the SVG shows its rest pose. Steam wisps and sparkles (opacity 0 at rest) are hidden by default and, under `reduce`, rendered at their static visible state (`opacity .9`, no transform) so the static drawing keeps its steam. The 120 ms fade-in is removed too.
  - Never more than 2 animated groups per drawing; no `filter`, no `will-change` except `transform` on the animated groups of the hero only; no JS animation (CSS keyframes only).

## 5. Fallbacks
- `dishType` missing, null, empty or not one of the 18: render `other` (the bento box). Never render nothing, never a broken-image icon, never throw.
- Chunk loading or render error: empty panel plus stripe (current look). Wrap in an error boundary that renders the empty panel.
- Recipes imported from a menu or added later with an unrecognised type behave the same; the type is never shown as text.

## 6. Accessibility
`aria-hidden="true" focusable="false"` on every SVG; no `<title>`, no `role="img"`, nothing read by screen readers. The illustration never conveys allergens, safety, diet or status: allergen and processed-food information stays in text (same rule as a11y-responsive.md: illustrations are decorative). No text inside SVG. Hover/focus animation on a card does not change focus, order or hit area. Dark mode uses the dark token set automatically (CSS variables, no JS).

## 7. Proposed story US-E17-01 (Orchestrator files it)
As a parent browsing recipes on my phone, I want each recipe to show a friendly picture of its dish type, so that the cards and the recipe page feel warm and I recognise dishes at a glance.
- AC1: Given any recipe with a dish type from the 18-type list, when its card (recommendation, library, compact row) or its page header is shown, then the matching illustration is displayed in the existing art frame (72/120 px card, 64 px thumb, 150 px hero).
- AC2: Given a recipe with no dish type or an unknown one, then the `other` illustration is shown and nothing breaks.
- AC3: Given any illustration, then the SVG has `aria-hidden="true"`, no accessible name, no text, and conveys no allergen or safety information.
- AC4: Given `prefers-reduced-motion: reduce`, then no illustration animation runs (`getAnimations()` is empty) and the drawing is in its rest pose.
- AC5: Given light or dark theme, then illustrations use the theme's illustration tokens (outline and fill as separate paths, fill offset from the outline), outlines reach 3:1 against the frame, and no pure white or black is used.
- AC6: Given the card frame, when the illustration loads, then the frame size is unchanged (cumulative layout shift 0 from the illustration) and the page is usable before the chunk arrives.
- AC7: Given a recipe list, then no illustration animates without hover, focus or press, and at most one card animates at a time; on the recipe page the header loop runs at most 5 cycles, pauses off-screen, and uses only transform and opacity, at most 2 animated groups, none faster than the durations in section 3.
- AC8: Given the app online or offline, then showing illustrations causes no network request for images, and the added JS plus CSS is at most 16 KB gzip, and no SVG filter element or CSS filter is used.
- Test hints: AC1 `data-dish-type` attribute on the frame and one SVG inside; AC3 axe + attribute check; AC4/AC7 `emulateMedia` and `getAnimations()`; AC6 bounding box before and after chunk load; AC8 `page.on('request')` filters image types, size from the build report. Developer needs a `dishType` field (enum of the 18) on `Recipe`: BA/Orchestrator to confirm whether it exists or is derived; existing recipes need a one-time mapping.

## 8. Known gaps
- Preview paths are rough sketches, not final art; PO reacts to style and palette first.
- Pixel review at 72 px (the card strip) is needed on a real phone.
- Stroke at 72 px renders thin (1.2 px); fix by raising stroke to 2.5 in the `card` size if the PO finds it faint (one CSS rule).
