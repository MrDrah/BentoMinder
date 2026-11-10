# BentoMinder: design direction v0.1

> For the product owner's direction review, 2026-10-24. Preview: `design/preview/index.html` (open in a browser; `?lang=en` and `?theme=dark` also work). Tokens: `design/tokens.json` and `design/tokens.css`. Flows: `design/flows.md`. Copy: `design/copy-draft.md`.
> Not yet included (they follow approval and final stories, per gate H2): `components.md` with every state, `a11y-responsive.md`, the full `copy.md`.

## 1. Mood

**Like a well-kept nursery bag: cream cotton, navy thread, one red button.** Soft and warm, playful in small doses, and always practical. The screen answers three questions in this order: **What day? School lunch or homemade bento? What recipe?** Decoration is a frame around that answer and never sits on top of it.

- Cream backgrounds, navy type, a soft red that marks one thing per screen.
- Rounded shapes (rounded type, 12–24 px radii, pill buttons). No sharp corners, no drop-shadow drama.
- Playfulness lives in the illustrations (bear onigiri, star hamburgers) and in a few thin stripes, never in the controls.

## 2. Palette

Roles, not raw colours. The app's CSS uses only the variables in `tokens.css`.

| Role | Light | Dark | Use |
|---|---|---|---|
| surface-1 | `#FFFFFF` white (PO 2026-10-24: no yellow tint) | `#141B2B` | Page |
| surface-2 | `#FFFDF8` | `#1C2539` | Cards, sheets, school-day cells |
| surface-3 | `#F2EADB` | `#253049` | Sunken areas, chips, illustration panels |
| line-1 | `#E4DAC8` | `#2F3A54` | Decorative dividers only |
| line-ui | `#8C8574` | `#7D7A72` | Input and control borders |
| ink-1 | `#1B2A4A` navy | `#F6EFE2` | Primary text |
| ink-2 | `#3F4B66` | `#CDC6B8` | Secondary text |
| ink-3 | `#5F6880` | `#A7A398` | Hints, assessment marks |
| ink-inverse | `#FBF6EC` | `#141B2B` | Text on navy-fill / accent-strong |
| accent | `#D2574F` soft red | `#F08A80` | Borders, icons, stripes, suggestion outline. **Never text, never under text** |
| accent-strong | `#B8443C` | `#F08A80` | Primary button fill |
| accent-ink | `#A83A33` | `#F4A097` | Red text (Sunday/holiday numerals, 苦手 tag) |
| accent-soft | `#F8E1DC` | `#3A2429` | Tint behind the assessment block |
| navy-fill | `#1B2A4A` | `#F6EFE2` | Confirmed bento (inverts in dark mode: still the strongest solid) |
| saturday | `#2F5C9A` | `#8FB4F0` | Saturday numerals |
| sunday | `#A83A33` | `#F4A097` | Sunday and holiday numerals |
| info / info-soft | `#2F5C9A` / `#E3ECF8` | `#8FB4F0` / `#22314F` | Notes, disclaimers |
| success / success-soft | `#2F6B4F` / `#E1F0E6` | `#8FD3AE` / `#1D3A30` | Saved, reasons ticks |
| warning / warning-soft | `#7A4E00` / `#FFF0D1` | `#F2C66D` / `#3A3020` | Outdated menu, unknown allergen |
| danger / danger-soft | `#A3271F` / `#FBE3E0` | `#FF9C92` / `#40242A` | Errors, destructive actions |
| focus-ring | `#1F5FBF` | `#8FB4F0` | 2 px outline, 2 px offset |
| illus-* | rice `#FFFFFF`, egg `#F2C14E`, green `#7FA86A`, brown `#9A6544`, pink `#F4B6AE` | rice/nori swap | Illustrations only; never carry text |

Soft red `#D2574F` is only 3.96:1 under cream text, so it never fills a button. Buttons use the deeper `accent-strong` instead.

### Contrast audit (computed with the WCAG 2.1 formula, 2026-10-24)

Thresholds: 4.5:1 text, 3:1 large text and UI parts (borders, icons, indicators). **Every pair used in the preview passes.**

| Pair (foreground on background) | Light | Dark | Needs |
|---|---|---|---|
| ink-1 on surface-1 / -2 / -3 | 14.22 / 13.99 / 11.90 | 15.03 / 13.37 / 11.49 | 4.5 |
| ink-2 on surface-1 / -2 / -3 | 8.71 / 8.57 / 7.29 | 10.12 / 9.01 / – | 4.5 |
| ink-3 on surface-1 / -2 / -3 | 5.56 / 5.47 / 4.65 | 6.82 / 6.07 / 5.22 | 4.5 |
| ink-inverse on accent-strong (primary CTA) | 4.96 | 7.08 | 4.5 |
| ink-inverse on accent-strong-hover | 6.11 | 8.45 | 4.5 |
| ink-inverse on navy-fill (confirmed bento cell, banner) | 13.20 | 15.03 | 4.5 |
| surface-2 on ink-1 (today numeral) | 13.99 | – (same pair inverted) | 4.5 |
| accent-ink on surface-1 / -2 / -3 | 6.33 / 6.23 / 5.29 | – / 7.52 / 6.46 | 4.5 |
| accent-ink on accent-soft (苦手 tag, chip) | 5.06 | 7.05 | 4.5 |
| ink-1 on accent-soft (assessment sentence) | 11.37 | 12.54 | 4.5 |
| ink-2 on accent-soft | 6.97 | 8.44 | 4.5 |
| sunday on surface-1 | 6.33 | 8.45 | 4.5 |
| saturday on surface-1 / -3 | 6.73 / 5.63 | 8.15 / 6.23 | 4.5 |
| info on surface-1 | 6.73 | – | 4.5 |
| ink-1 on info-soft | 11.93 | 11.33 | 4.5 |
| success on success-soft / surface-2 | 5.34 / 6.19 | 7.12 / 8.81 | 4.5 |
| warning on warning-soft | 6.39 | 8.05 | 4.5 |
| danger on surface-2 / danger-soft | 7.20 / 5.99 | 7.59 / – | 4.5 |
| ink-2 on line-1 (label over hatch; label also sits on a surface-2 pill) | 6.29 | – | 4.5 |
| accent (dashed suggestion border) on surface-1 / -2 | 4.03 / 3.96 | 7.08 / 6.30 | 3 |
| accent on surface-3 (stripes on illustration panel) | 3.37 | 5.42 | 3 (decorative anyway) |
| line-ui (input border) on surface-1 / -2 | 3.67 / 3.61 | 4.01 / 3.57 | 3 |
| focus-ring on surface-1 / -2 | 6.09 / – | 8.15 / 7.25 | 3 |

**Rejected pair:** cream text on soft red `#D2574F` (3.96). This is why `accent-strong` exists.

## 3. Typography

| Role | Stack | Why |
|---|---|---|
| Display: headings, calendar numerals, buttons, brand | **Zen Maru Gothic** 500/700 (Google Fonts) → Hiragino Maru Gothic → BIZ UDPGothic → system | A rounded, gentle Japanese face that gives the warmth of the direction without being childish. Its kana stay open and legible at 15 px. It has only two weights, so the download is small. |
| Body: running text, lists, inputs | System Japanese: Hiragino Sans → BIZ UDPGothic → Yu Gothic UI → Noto Sans JP → Meiryo | Zero download, and native rendering is the most legible option for long text on each OS. BIZ UDPGothic is a universal-design font shipped with Windows 10+. |

**Rejected options.** Noto Sans JP as a web font for everything: heavy (every weight is a separate set of slices) and visually neutral, adding nothing over system fonts. M PLUS Rounded 1c: comparable to Zen Maru Gothic, but its weights read slightly mechanical next to cream and stripes; it stays as a fallback candidate if Zen Maru rendering disappoints on Android.

**Performance.** Google Fonts serves Japanese faces in unicode-range slices, so a screen downloads only the glyph slices it uses (typically a few hundred KB for two weights). `display=swap`: text shows immediately in the fallback. For the Android build we self-host the two weights so the app renders offline (developer to confirm the budget in the ADR).

| Token | Size | Line-height | Use |
|---|---|---|---|
| text-xs | 12 px | 1.35 | Calendar cell labels, legend. **Minimum size for any Japanese text** |
| text-sm | 14 px | 1.6 | Secondary text, chips |
| text-md | 16 px | 1.7 | Body, inputs (16 px also prevents iOS zoom on focus) |
| text-lg | 18 px | 1.35 | Card titles |
| text-xl | 22 px | 1.35–1.4 | Screen titles, day sheet date |
| text-2xl | 28 px | 1.35 | Today headline (desktop) |
| text-3xl | 34 px | 1.3 | Onboarding hero |

Japanese body text uses line-height 1.7 and 0.02 em tracking (kanji need the air). Headings use 0.04 em, and recipe steps 1.85. English uses 0 tracking. No italics: Japanese has no true italic, so emphasis is weight or the red dot.

## 4. Spacing, radius, elevation, motion

- Spacing: 4 px scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Screen gutters are 16 px and sheet gutters 20 px.
- Touch: **every control ≥ 44 × 44 px**. Primary buttons and calendar day cells are ≥ 52 px wide or tall (day cells are 68 px tall).
- Radius: 8 (chips), 12 (inputs, choice cards), 18 (cards), 24 (sheets), pill (buttons).
- Elevation: three soft navy-tinted shadows. Sheets use the upward shadow (`elevation-3`).
- Motion: 120 / 200 / 320 ms, standard ease. Sheets slide up 320 ms. With `prefers-reduced-motion` every duration is 0 and sheets simply appear. No confetti or bounce.

## 5. Stripe motif rules

The stripes are a Breton-style reference, used sparingly:

1. **Horizontal and thin** (2 px stripes, 3 px gaps, at most 3–4 stripes). Navy (`stripe-a`) or soft red (`stripe-b`).
2. **Allowed only at edges:** the bottom of the app bar, the bottom of illustration panels, the left edge of the reminder banner, and page dividers in documents.
3. **Never behind text, never inside a calendar cell, never on a control.**
4. **Diagonal hatching is a different thing.** It is functional and means only "no school lunch" (holidays, half days, the school's お弁当の日). Diagonal lines keep it from reading as decoration.

## 6. Iconography

- 24 px grid, 2 px rounded stroke, `currentColor`. Hand-drawn feel through round caps, not wobbly lines.
- Set: calendar, today (sun), recipes (book), settings, bento box (compartments plus an umeboshi dot), school lunch (bowl with steam), **tile state icons (2026-11-10, components §18.1): `lunchbox` (school lunch), `home-bento` (crossed spoon and spatula), `bento-unsure` (crossed spoon and spatula with ?)**, the assessment marks ○ △, the dashed "?" circle, — (not assessed), ⌀ (no lunch), check, bell, info, warning, upload, lock, clock, theme icons (paw, star…), chevrons, close.
- Illustrations are simple flat bentos seen from above, with navy outlines and the `illus-*` fills. One per recipe, with an optional theme motif.
- No emoji in the UI: rendering differs by OS and screen readers read the emoji's name aloud.

## 7. Calendar indicator system (the core of this direction)

Aligned with US-E5-01/AC3–AC4: every school-day cell shows **two separate indicators**, and neither relies on colour alone.

```
┌───────────┐   top row: date numeral ......... assessment mark (○ △ ? —)
│ 18     (?)│            = what the app thinks of the lunch
│    [▣]    │   body:    decision word + cell shape
│ くまさん  │            = what the family planned
│ おにぎり  │
└───────────┘
```

The legend states the rule for parents: 「右上の記号＝給食の相性（アプリの見立て）。下の文字と枠＝家族の予定。」

| Decision state (data) | Cell shape | Body (icon + word) | Colour |
|---|---|---|---|
| homemade-bento-planned | **Solid fill**, red 3 px top edge | Bento icon + recipe name, 2 lines × 4 chars, truncated to 8 (US-E5-01/AC4) | navy-fill + ink-inverse |
| not-confirmed (「あとで決める」, US-E5-05) | **Solid 2 px outline** | Outline bento icon + 「未定」 | ink-1 |
| school-lunch-planned **and** low preference | **Dashed 2 px outline** (the suggestion) | 「給食」 | accent border, ink-2 word |
| school-lunch-planned (any other assessment) | Plain | 「給食」 | ink-2 |
| no-school-lunch (holiday, 午前保育…) | Diagonal hatch | 「給食なし」 or 「祝」 | ink-2 / sunday |
| no-school-lunch with reason bento-day (US-E5-08), not yet planned | Diagonal hatch | Bento icon + 「お弁当の日」 | ink-1 |
| bento-day, planned | Same as homemade-bento-planned | | |
| Weekend / outside the menu | No box, narrow column | Numeral only. Tappable: the sheet says 「この日は献立に記載がありません」 (US-E5-02/AC2) | saturday / sunday |

| Assessment (data) | Mark (top-right, 14–16 px) | Colour |
|---|---|---|
| likely enjoyable | ○ | ink-2 |
| mixed / uncertain | △ | ink-2 |
| low preference | Dashed circle with "?" | accent-ink |
| not assessed | — | ink-2 |
| (no-school-lunch days) | no mark | |

| Overlay | Treatment |
|---|---|
| Today | Numeral in a filled navy circle (a shape cue) + `aria-current="date"`. The today card above the calendar names the date (US-E7-03) |
| Past day | Numeral in ink-3 (holidays and weekends keep their colour). The sheet is read-only (US-E5-02/AC3) |
| Manual override | Same mark as the overridden value; the sheet shows 「手動で変更済み」 |
| Accessible name | Every cell has a full sentence, e.g. 「11月18日（水）、判定：苦手かも。予定：手作りお弁当「くまさんおにぎり弁当」」 |

**Suggested vs confirmed is unmistakable.** The progression is pencil to pen:

1. **Dashed** outline: the app's suggestion. The plan still reads 「給食」.
2. **Solid outline** with 「未定」: the family will decide later.
3. **Solid fill** with the recipe name: planned.

Only planned days are filled, and only they carry text on dark. Decision and assessment differ in position, icon and words, not only colour (US-E5-01/AC4). The same solid navy marks "planned" on the recipe screen and in the upcoming summary, so filled always means decided.

**Low preference never looks like a plan** (US-E5-04). The dashed day still says 「給食」 in its body, and the ? mark is small.

**Narrow weekend columns.** Saturday and Sunday columns are 0.62× the width of weekday columns, which leaves room for 4 full-width characters per line at 390 px. A row with only weekend or empty cells is compact (34 px).

### Weekend colours: decision

**Use Saturday blue and Sunday/holiday red, on numerals and weekday headers only** (this also matches US-E5-01/AC2). Japanese parents read calendars with this convention instinctively. The clash with our red accent is managed in three ways:

1. Weekend and holiday cells never carry a dashed red outline.
2. Our red means "attention" only as a dashed outline or a tag, never as coloured numerals.
3. Holidays also carry 「祝」 and the hatch, and their names are available to screen readers (US-E8-04).

### Week start: conflicts with US-E5-01/AC2, PO to decide

**Design recommendation: Monday start, with a setting for Sunday.** Kindergarten menus are printed as Monday–Friday rows, so a Monday-start calendar mirrors the paper the parent already knows. It keeps the school week on one row and the weekend together at the end, which is what makes narrow weekend columns work. The Sunday 14:00 weekly reminder also reads naturally as "the next row".

**The story says Sunday.** US-E5-01/AC2 specifies 日 月 火 水 木 金 土, the default of most Japanese wall calendars and calendar apps. That is a fair familiarity argument. The preview shows Monday so the PO can judge it.

- (a) *Monday default + Sunday setting* (recommended): change AC2 to "starts on the user's setting, default Monday".
- (b) Sunday default + Monday setting: AC2 stays. The design still works, with the narrow Sunday column on the left.
- (c) Sunday only: AC2 stays, no setting.

## 8. Layout and responsiveness (summary; full spec in `a11y-responsive.md` later)

- 360–767 px: single column, with **no tab bar**. The calendar is the only home screen and the today card sits at its top (US-E7-03). The app bar holds the 「日本語 / EN」 segmented toggle (US-E8-01/AC2), レシピ and 設定.
- 768–1023 px: same, with content max 480 px centred.
- ≥ 1024 px: calendar on the left; the day sheet becomes a side panel on the right instead of a bottom sheet.

## 9. Dark mode approach

- A deep navy night surface, not black, so the brand still reads.
- Roles invert: cream ink on navy. **The confirmed bento becomes a cream solid with navy text**, so it is still the only solid-filled cell.
- The soft red brightens to `#F08A80`. It can then carry a button fill with dark text (7.08:1).
- Illustrations keep their colours. Rice turns cream so it doesn't glare.
- The theme follows the OS by default, with an override in Settings (自動 / ライト / ダーク).

## 10. Why this identity is original

The brief asks for inspiration from French children's fashion, not copying. What we took is generic to the genre: cream, navy, a red accent, and thin stripes as a nautical-cotton cue. What we did **not** use:

- No brand name, wordmark, logo or typeface from any existing brand. Our wordmark is set in Zen Maru Gothic (SIL OFL).
- **No boats, anchors, sailor collars or other nautical icons.** Our brand mark is a top-down bento box with an umeboshi, a purely Japanese food motif.
- Stripes are reduced to thin edge bands, with rules about where they may appear. No full-bleed striped fields.
- The palette values are our own, chosen for contrast, not sampled from any brand.

## 11. Open questions for the PO (recommended default first)

1. **Week start** (conflicts with US-E5-01/AC2). *Monday default + Sunday setting* / Sunday default + Monday setting / Sunday only.
2. **Weekend colours.** *Keep Sat blue / Sun and holidays red, on numerals only* (matches AC2) / all-navy numerals.
3. **Planned-bento colour.** *Navy fill with a red top edge* / red fill (warmer, but red would then mean both "attention" and "done").
4. **Font.** *Zen Maru Gothic for display + system fonts for body* / M PLUS Rounded 1c / system fonts only (fastest, plainer).
5. **Recipe names in cells.** *A curated `shortName` (≤ 8 chars) per recipe* / mechanical truncation to 8 chars per US-E5-01/AC4, which cuts words (the preview shows 「星のミニハンバー…」). A shortName needs a data-contract field (BA).
6. **Navigation.** *No tab bar: calendar home + app-bar icons for recipes and settings* / a 3-tab bar (more discoverable, but adds a separate "today" screen the stories don't need).
