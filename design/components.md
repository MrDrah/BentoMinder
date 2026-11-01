# BentoMinder: component specs v1.0

> Status: **H2 final**, 2026-10-24. Inputs: `design/direction.md` (accepted), `docs/PLAN.md` §3 and §7, `docs/ba/user-stories.md` (H1 final), `docs/ba/data-contract.md` (state names). Tokens: `design/tokens.css` (generated from `tokens.json`). Strings: `design/copy.md` (keys in `code`; never hard-code text). Accessibility details and the contrast audit: `design/a11y-responsive.md`. Visual reference: `design/preview/index.html`.
>
> **Revision 2026-10-25 (M2 prep):** §1.1, §1.2, §1.7 app bar and language toggle at 44 × 44 on the element box (D-M1-08); §6.3 food-picker results grouped by kind with headings (`picker.group.*`), chip pattern as built; §6.8 + new §6.9 date correction on review (US-E2-05/AC5, AC7–AC10; BA rule `review-date-correction`: taken dates are never chosen).

## 0. How to read this file

**Sizes.** Every component is specified at **390 px** (reference phone; it must also hold at 360 px) and **desktop** (≥ 1280 px). The 768–1279 px tablet layout is the mobile layout centred at `--content-max` (560 px) with sheets shown as centred dialogs; it is called out only where it differs.

**State vocabulary.** Every component lists these states; "n/a" means the state cannot occur, with the reason.

| State | Meaning | Default treatment (unless the component says otherwise) |
|---|---|---|
| default | Rest | As specified |
| hover | Pointer over it. Only under `@media (hover: hover)`; touch devices never show hover | Surfaces step one level (`surface-2` → `surface-1`, or `surface-3` behind ghost controls); borders `line-ui` → `ink-1` |
| focus-visible | Keyboard focus | `outline: 2px solid var(--focus-ring); outline-offset: 2px` plus a 2 px `--focus-halo` ring (set globally in `tokens.css`). Never removed |
| active | Pressed | Primary/destructive: `*-hover` fill; others: `surface-3`. No scale/translate transforms (nothing moves with reduced motion either) |
| disabled | Not available | Fill `surface-3`, text `ink-3` (4.65:1, still readable), border 2 px **dashed** `line-ui`, `cursor: not-allowed`, `aria-disabled="true"` (kept focusable when a hint explains why; the hint is linked with `aria-describedby`). Never opacity alone |
| loading | Waiting for work | Spinner (or static "…" with reduced motion) + busy label; `aria-busy="true"`; control disabled while busy |
| error | Invalid or failed | `danger` 2 px border + warning-triangle icon + message text below (`danger`), `aria-invalid="true"`, message linked by `aria-describedby` |
| empty | Nothing to show | Empty-state block (§1.14) with the specific copy key |
| selected | Chosen item | Navy fill (`navy-fill` + `ink-inverse`) **plus** a check icon; `aria-pressed`/`aria-checked`/`aria-selected` as per pattern |

Domain states (assessment, decision, overlays) are listed per component.

**Test ids.** `data-testid` values below are stable; QA uses them. Dates in ids are ISO (`2026-11-04`). Repeated items append an index or id (`rec-card-0`, `review-dish-2026-11-05-1`).

**Colour is never the only signal** (US-NF-02/AC3, BR-03): every state named here carries an icon shape, a text label, a border style or a fill, as stated.

---

## 1. Foundations

### 1.1 App bar (calendar home)
Anatomy: logo (36 px, decorative) · brand 「BentoMinder」 (`app.name`, `text-lg`, display font) · language segmented toggle (§1.7) · icon button レシピ (`nav.recipes`, book icon) · icon button 設定 (`nav.settings`, gear icon). Bottom edge: navy stripe band 8 px (`--stripe-band`, decorative). No tab bar (PLAN §7).

| | 390 | Desktop |
|---|---|---|
| Height | 56 px + 8 px stripe (icon buttons 44 px, toggle 48 px, centred) | 64 px + 8 px stripe |
| Layout | brand flex 1, `min-width: 0`; controls right; 4 px gaps; padding 16 px left, 8 px right | brand left; controls right; max width 1280 centred |
| Icon buttons | 44 × 44 box, 24 px icon, label visually hidden | 44 px high + visible text label after the icon |
| Language toggle | §1.7: 48 px high (44 px options + 2 px border), about 106 px wide | same |

**Width budget (D-M1-08, revised 2026-10-25).** Every control is **≥ 44 × 44 CSS px measured on the element's own box** at 360 px (no pseudo-element hit areas in the app bar; QA measures `getBoundingClientRect()`). Controls row = toggle 106 + 4 + 44 + 4 + 44 = **202 px**.

| Viewport | Padding | Logo | Brand text | Controls | Total | Fits |
|---|---|---|---|---|---|---|
| 320 | 24 | 36 | hidden | 202 + 4 gap | 266 | yes |
| 360 | 24 | 36 | hidden | 206 | 266 | yes |
| 390 | 24 | 36 | hidden | 206 | 266 | yes |
| 400–1279 | 24 | 36 + 8 gap | shown (about 115 px at `text-lg` display font) | 206 | about 393 | yes (brand box absorbs the rest) |
| ≥ 1280 | 24 | 36 + 8 | shown | 106 + labelled icon buttons (about 96 + 76) | < 400 | yes |

The brand text 「BentoMinder」 is **visually hidden below 400 px** (`@media (max-width: 399px)`, was 360 px): with the 44 px toggle the 390 px bar would need 389 px of 390, which any fallback font breaks. The logo keeps `app.name` as its accessible name, so nothing is lost for screen readers. Nothing in the bar ever truncates, wraps or overlaps; if the font is larger than expected (200 % text), the brand text is the only thing that gives way (`overflow: hidden` on the brand box, never on the controls).

States: default; hover (icon buttons `surface-3` circle); focus-visible (ring); active (`surface-3`); disabled n/a (always available); loading n/a; error n/a; empty n/a.
Test ids: `appbar`, `appbar-lang`, `appbar-recipes`, `appbar-settings`. Stories: US-E8-01/AC2 (toggle within 1 tap), US-E6-05, US-E7-04.

### 1.2 Top bar (every other screen)
Anatomy: back button (44 × 44, chevron, accessible name `nav.backTo`) · screen title (`text-lg`, h1, flex 1, `min-width: 0`) · language toggle (right, §1.7, 48 px high with 44 px options). Onboarding adds the stepper (§1.15) below.
Width at 360 px: 24 padding + 44 back + 4 + title + 4 + 106 toggle → the title gets **178 px** (9 Japanese characters at 18 px per line). Longer titles (「11月の献立を確認」 fits; 「確認が必要な日」 fits; English "Check the November menu" does not) **wrap to a second line** and the bar grows (min-height 56 px); titles are never truncated or ellipsised.
**Onboarding top bar** (US-E1-01/AC6, D-M1-03 ruling, M2 prep): adds the 設定 icon button (`nav.settings`, gear, 44 × 44, same as the app bar's; test id `topbar-settings`) to the right of the language toggle, on every input step. Width at 360 px: step 1 (no back) 24 + title + 4 + 106 + 4 + 44 → title **178 px**; steps 2–3 (with back) 24 + 44 + 4 + title + 4 + 106 + 4 + 44 → title **134 px** (7 Japanese characters per line: 「お子さまのこと」 and 「献立の取り込み」 fit, 「献立の確認」 fits; anything longer wraps). Desktop shows the label after the icon as in the app bar.
States as 1.1. Test ids: `topbar-back`, `topbar-title`. Stories: US-E8-01/AC2 (toggle on every screen).

### 1.3 Buttons

| Variant | Fill / text / border | Use |
|---|---|---|
| primary | `accent-strong` / `ink-inverse` / none | One per screen or card: the next step (取り込む, この内容で確定, 手作りお弁当にする, この日に決定 on card 1) |
| secondary | `surface-2` / `ink-1` / 2 px `ink-1` | Alternatives (あとで決める, レシピを変更, PDFファイルを選ぶ, この日に決定 on cards 2–3) |
| text | none / `ink-1` underlined (4 px offset) / none | Low-emphasis (あとで取り込む, 手入力する, ほかのレシピ, 自動判定に戻す) |
| destructive | `danger-strong` / `ink-inverse` / none | Only inside confirm dialogs (削除する, 取り消す, 置き換える) |
| destructive-text | none / `danger` underlined | Entry points to destructive dialogs (給食に戻す on a planned day, 計画を取り消す, プロフィールを削除, すべてのデータを削除) |
| icon | none / `ink-1` / none, 44 px circle | Close, back, month chevrons, remove chip |

| | 390 | Desktop |
|---|---|---|
| Height | primary/secondary/destructive 52 px; text and icon 44 px | same |
| Width | block (100 %) in footers, sheets and cards; inline otherwise | inline, min 160 px; footers right-aligned |
| Label | `text-md`, display font 700, max 2 lines, `word-break: keep-all` | same |
| Icon | optional 20 px leading icon, 8 px gap | same |

| State | primary | secondary | text | destructive |
|---|---|---|---|---|
| default | as above | as above | as above | as above |
| hover | `accent-strong-hover` | fill `surface-3` | underline 2 px | `danger-strong-hover` |
| focus-visible | ring + halo | ring + halo | ring + halo | ring + halo |
| active | `accent-strong-hover` | `surface-3` | `surface-3` pill behind | `danger-strong-hover` |
| disabled | `surface-3` / `ink-3` / 2 px dashed `line-ui` + hint text below (e.g. `review.confirm.emptyManual`) | same | `ink-3`, no underline | same as primary disabled |
| loading | label replaced by spinner + busy label (e.g. `rec.saving`), width locked, `aria-busy` | same | n/a | same |
| error | n/a (errors show at the field or as a banner) | n/a | n/a | n/a |
| empty | n/a | n/a | n/a | n/a |

Test ids: per use (listed with each component). Stories: US-NF-02/AC3 (≥ 44 px).

### 1.4 Text input (URL, nickname, dish name, search, note)
Anatomy: label above (`text-sm` 700, + `common.optional`/`common.required`) · field (52 px, `radius-md`, 2 px `line-ui`, `surface-2`, `text-md`) · hint below (`ink-2`, `text-sm`) · error line below the hint (icon + `danger` text) · optional counter right-aligned (`ink-3`).
Textarea (note): min 3 lines, grows to 6, same states.

| State | Treatment |
|---|---|
| default | as above; placeholder `ink-3` |
| hover | border `ink-1` |
| focus-visible | border `ink-1` + focus ring |
| active | = focus |
| disabled | `surface-3`, dashed border, `ink-3` (used for the URL field while offline) |
| read-only | `surface-3`, solid `line-1` border, `ink-1` text, selectable (saved URL in settings) |
| loading | n/a on the field (the submit button carries loading) |
| error | 2 px `danger` border, icon + message (`aria-invalid`, `aria-describedby` = hint + error); error clears on the next valid input, not on every keystroke for URLs (validated on submit and on blur) |
| empty | placeholder only; required-empty errors appear on submit |
| limit | counter turns `danger` + text at the limit; input stops at the max (nickname 20, note 200, dish 40) |

| | 390 | Desktop |
|---|---|---|
| Width | 100 % of the content column | max 560 px |

Test ids: `input-<name>`, `input-<name>-error`. Stories: US-E1-02/AC5, US-E2-01/AC2–AC3, US-E3-02/AC4.

### 1.5 Select (month, weekday, hour, minute, prompt day, debug mode)
Native `<select>`, 52 px, same skin and states as 1.4 (custom chevron icon, `appearance: none`). Disabled = dashed. Error n/a (values are constrained). Test ids `select-<name>`.

### 1.6 Chip (choice chips: age, likes/dislikes, allergens, diet, themes; reason chips)

| Type | Default | Selected |
|---|---|---|
| choice (single, e.g. age) | `surface-2`, 2 px `line-ui` border, `ink-1` text, 44 px min height, `radius-pill` | `navy-fill` + `ink-inverse` + leading check icon; `role="radio"` `aria-checked="true"` |
| choice (multi, e.g. allergens) | same | same; `aria-pressed="true"` |
| selected food chip (picker result) | `navy-fill` + `ink-inverse` + trailing × icon button (44 px hit, `profile.foods.remove`) | n/a |
| tag (read-only: 苦手, 好き, 要確認, reasons) | `surface-3` / `ink-1`, 28 px, `text-sm`; variants: low `accent-soft`/`accent-ink`; warning `warning-soft`/`warning`; success `success-soft`/`success` | n/a |

| State | Treatment |
|---|---|
| hover | border `ink-1`; selected: fill `ink-2` |
| focus-visible | ring |
| active | `surface-3` |
| disabled | dashed border, `ink-3`, `surface-3` (4th theme when 3 are chosen: stays focusable, tap shows `theme.limit`) |
| loading / error / empty | n/a for a chip; the group carries the error (§1.9) |

Sizes: 390 wraps in rows, 8 px gaps; desktop same, max 560 px wide groups. Test ids: `chip-<group>-<id>` (e.g. `chip-age-age-4-5`, `chip-allergen-alg-egg`).

### 1.7 Segmented control (language 日本語 / EN; settings language; override control on desktop)
Anatomy: pill container 2 px `ink-1`, `overflow: hidden`; active option `ink-1` fill with `surface-2` text (13.99:1). **Each option is a button of at least 44 × 44 CSS px on its own box** at every width (revised 2026-10-25 for D-M1-08: the former 36 px visual + pseudo-element hit area was clipped by the container and measured 36 px high). Option padding 0 8 px (`space-2`), labels `text-sm` 700, `letter-spacing: 0`, `white-space: nowrap`. Widths: 「日本語」 about 58 px, 「EN」 44 px (the minimum), container about 106 × 48 px including its 2 px border. Options may differ in width (content width, min 44); equal width is not required.
The same component in settings (language) and on desktop (override control) uses the same 44 px height.
ARIA: `role="radiogroup"` with `aria-label` = `lang.toggle.aria`; options `role="radio"`; arrows move and select; the option label carries `lang` (`lang="ja"` on 日本語, `lang="en"` on EN).
States: default; hover (inactive option `surface-3`); focus-visible (ring on the group's checked option); active (`surface-3`); disabled n/a; loading n/a (switch is instant, no reload); error n/a; empty n/a; selected = filled side.
Test ids: `lang-toggle`, `lang-toggle-ja`, `lang-toggle-en`. Stories: US-E8-01/AC2–AC3, US-NF-02/AC3 (D-M1-08: `lang-toggle-ja` and `lang-toggle-en` each ≥ 44 × 44 at 360 px).

### 1.8 Checkbox and switch
- **Checkbox** (reservation record): 24 px box, 2 px `line-ui`, inside a 52 px row with the label; checked = `success` fill + `ink-inverse` check (5.84:1). Hint under the label.
- **Switch** (reminders on/off): `role="switch"`, 52 × 32 track; off = `surface-3` track + 2 px `line-ui` border + text `settings.switch.off`; on = `success` track + knob `ink-inverse` + text `settings.switch.on`. The state word is visible next to the switch (not colour only).

| State | Treatment |
|---|---|
| hover | border `ink-1` |
| focus-visible | ring around box / track |
| active | `surface-3` behind |
| disabled | dashed border, `ink-3` label (debug only) |
| loading / error / empty | n/a |

Test ids: `check-reservation`, `switch-weekly`, `switch-day-before`. Stories: US-E5-07/AC3, US-E7-04/AC4.

### 1.9 Radio group and choice cards
- **Radio group** (allergy status, week start, theme, no-lunch reason, ambiguity, override on mobile): fieldset + legend; each option a 52 px row, 22 px circle 2 px `line-ui`; checked = `ink-1` border + 10 px `ink-1` dot. Group error: legend gets the error line beneath (icon + text), `aria-invalid` on the group, focus moves to the first option.
- **Choice card** (onboarding, review choices): 64 px min row, icon tile 40 px, title + sub-line.
States: hover (row `surface-1`, border `ink-1`); focus-visible (ring on the row); active (`surface-3`); disabled (dashed, `ink-3`); loading n/a; error (group-level as above); empty n/a; selected (checked dot + `surface-1` row + 2 px `ink-1` border).
Test ids: `radio-<group>-<value>`. Stories: US-E1-03/AC3, US-E5-01/AC8, US-E8-05/AC2.

### 1.10 Banner (inline, page-level)
Anatomy: 12 px radius block, leading 20 px icon, title (700) + body, optional actions row, optional close.

| Variant | Background / title / icon | Icon shape | Used for |
|---|---|---|---|
| info | `info-soft` / `ink-1` / `info` | circle-i | disclaimer, web reminder limit, same-file, consent declined |
| warning | `warning-soft` / `warning` (title) `ink-1` (body) | triangle-! | unknown allergy, outdated/missing menu, uncertain summary, refresh conflict, review warnings, allergen notices, assessment changed |
| danger | `danger-soft` / `danger` / `danger` | octagon-! | import errors, storage unavailable, recipe-allergen conflict |
| success | `success-soft` / `success` / `success` | check | menu confirmed (inline variant of the toast) |

States: default; hover n/a (not interactive; actions inside have their own); focus-visible (only on inner actions; error banners receive programmatic focus via `tabindex="-1"` when they appear after submit); active n/a; disabled n/a; loading n/a; error = danger variant; empty n/a.
Live region: danger banners `role="alert"`; warning/info that appear after an action `role="status"`.
Sizes: 390 full width of the column; desktop max 760 px. Test ids: `banner-<key>` (e.g. `banner-allergy-unknown`, `banner-import-error`).

### 1.11 Toast
`navy-fill` + `ink-inverse` (13.20:1), `radius-md`, `elevation-2`, bottom-centre 16 px above the safe area; max 1 at a time; 4 s; `role="status"`. Never says "saved" unless the store write succeeded (US-E10-02/AC5). Reduced motion: appears/disappears without slide.
States: default; hover (pauses timer); focus-visible (if it contains an action); others n/a. Test id `toast`.

### 1.12 Bottom sheet / side panel (day sheet container)
| | 390 | 768–1279 | ≥ 1280 |
|---|---|---|---|
| Form | Bottom sheet, top at 64 px from the viewport top, `radius-xl` top corners, grab handle (decorative), `elevation-3`, scrim | Centred dialog, max 480 px, max-height 85 vh | Side panel 440 px right of the calendar, full height of the content area, no scrim, `elevation-4` |
| Header | date (h2, `text-xl`) + close (44 px) | same | same, close hidden (panel stays) |
| Body | scrolls; 20 px gutters | same | same |
| Motion | slide up `--duration-slow`, `--ease-enter`; with reduced motion: appears instantly | fade | none |

ARIA: mobile/tablet `role="dialog" aria-modal="true" aria-labelledby` header; focus goes to the header on open, returns to the cell on close; Esc closes; the sheet traps focus. Desktop panel: `role="region" aria-labelledby` header, not modal; focus moves to the header when a date is chosen.
States: default; loading (skeleton lines, ≤ 100 ms budget, US-NF-01/AC2); empty (desktop panel before a date is chosen: `day.panel.empty`); error n/a (content is local); hover/active/disabled n/a.
Test ids: `day-sheet`, `day-sheet-close`.

### 1.13 Dialog (confirm)
Anatomy: scrim · `surface-2` card `radius-xl`, max 480 px (`--dialog-max`), 24 px padding · title (h2, `text-lg`) · body (`text-md`) · actions: secondary (cancel) and primary or destructive. On 390 the actions stack full-width with the **safe action first** (キャンセル on top is wrong for thumb reach, so: destructive on top, キャンセル below, but initial focus on キャンセル). Desktop: actions in a row, right-aligned, cancel left of the confirm.
ARIA: `role="alertdialog"` for destructive confirms, `role="dialog"` otherwise; `aria-modal`, labelled + described; initial focus on the least destructive action; Esc = cancel; focus returns to the trigger.
States: default; loading (confirm button busy while the write runs); error (write failed: dialog stays, danger line `toast.saveFailed` inside); hover/focus/active per button; disabled n/a; empty n/a.
Catalogue of every confirm dialog: §11.

### 1.14 Empty state
Anatomy: 96 px illustration (bento outline, decorative) · title (`text-lg`) · body (`ink-2`) · 1 primary action, optional text action. Centred in its container.
Uses: no menu (`menuCard.missing.*`), no recipes (`rec.none`), no plannable days (`recipe.planPick.empty`), refresh list empty, library empty, debug table empty.

### 1.15 Stepper (onboarding)
Anatomy: 3 segments (6 px bars, 6 px gaps) + text `ob.stepper.label` + current step name. Done = `ink-1` bar + check in the text; current = `accent` bar + `aria-current="step"`; upcoming = `line-1` bar. The text carries the meaning (bars are decorative).
States: default only (not interactive; back navigation is the top-bar back button). Test id `stepper`. Stories: US-E1-01/AC1.

### 1.16 Loading indicators
- **Spinner**: 20 px ring, `ink-1`, rotates 800 ms linear; reduced motion: replaced by a static 「…」 and the busy text.
- **Skeleton**: `--skeleton` blocks with `--skeleton-highlight` shimmer over `--duration-shimmer`; reduced motion: static blocks. Each skeleton region has `aria-busy="true"` and a visually hidden `common.loading`.
- **Import progress screen**: §6.6.

---

## 2. Calendar home

### 2.1 Screen layout (order = focus order, see a11y §4)
1. App bar · 2. Reminder stack (§8) · 3. Storage/outdated banners · 4. Today card (§2.6) · 5. Menu cards (§2.7) · 6. Upcoming summary (§2.5) · 7. Month navigation (§2.2) · 8. Grid (§2.3–2.4) · 9. Legend (§2.8) · 10. Share button (§10).

| | 390 | 768–1279 | ≥ 1280 |
|---|---|---|---|
| Columns | one | one, max 560 centred | left column (items 2–10) max 760 px + right side panel 440 px (§1.12) |
| Grid gutter | 4 px each side (the grid bleeds past the 16 px page gutter) | 16 px | 0 inside the left column |

Loading: the store is read synchronously; if hydration takes > 100 ms show a grid skeleton. Error: storage banners (§12). Empty: no profile → onboarding (never this screen); no menu → menu card + numerals-only grid.
Test id `screen-calendar`. Stories: US-E5-01, US-E7-03, US-E3-06, US-E1-01/AC2, AC5.

### 2.2 Month navigation
Anatomy: 「前の月」 chevron (44 px) · month title (h2, `text-xl`, `fmt.month`) · 「次の月」 chevron · 「今日」 secondary small button (44 px), shown only when the visible month isn't the current Tokyo month.
States: default; hover (chevrons `surface-3`); focus-visible; active; disabled n/a (no month limit; any month renders, US-E5-01/AC5–AC6); loading n/a; error n/a; empty n/a (months without a menu still render).
Wrapper: `<nav aria-label>` = `cal.nav.label` (M2 prep: the M1 build reuses `cal.grid.label` here, which gives the nav and the grid the same name; the grid keeps `cal.grid.label`).
After navigation: `live.monthChanged` in a polite live region; focus stays on the pressed chevron.
Test ids: `cal-prev`, `cal-next`, `cal-today`, `cal-title`. Stories: US-E5-01/AC5, AC6.

### 2.3 Calendar grid
- Weekday header: `wd.short.*`, `text-xs` 700; Saturday `saturday`, Sunday `sunday`, others `ink-2`. Order from `settings.weekStartsOn`: Monday start 月火水木金土日 (default, US-E5-01/AC2), Sunday start 日月火水木金土 (AC8).
- Columns: weekdays `minmax(0, 1fr)`; Saturday and Sunday columns `minmax(44px, 0.62fr)` **wherever they sit** (last two columns for Monday start; first and last for Sunday start). Gap 2 px.
- Rows: school-week rows `min-height: var(--cell-min-height)` (68 px; 88 px at ≥ 1280); a row with only weekend/empty/outside cells is compact: 44 px.
- Leading/trailing days of other months: empty, non-interactive, `aria-hidden`.
- ARIA: `role="grid"` labelled `cal.grid.label`; rows `role="row"`; header cells `role="columnheader"` with the long weekday as `aria-label`; day cells `role="gridcell"` containing one `button` (roving tabindex: only one cell is tabbable; arrows move by day/week, Home/End to row start/end, PageUp/PageDown change month; a11y §5).
- **Agenda layout**: when the grid's container is narrower than 340 px or a weekday cell can't fit 4 characters at the current text size (container query `@container cal (max-width: 340px)`, plus `min-inline-size: 4em + 2px` check), the grid is replaced by a list: one row per date of the month (school days, no-lunch days and holidays; plain weekends collapsed into a single 「土・日」 line), each row showing the date, the assessment chip with its word, and the decision word/recipe name. Same tap targets and test ids. Heading `cal.agenda.label`. This is the 200 % text and 320 px reflow path (a11y §6).
Test ids: `cal-grid`, `cal-agenda`.

### 2.4 Calendar cell (the core component)

**Anatomy (school day):**
```
┌───────────┐  top row: numeral (24 px circle box) .... assessment mark (14–16 px)
│ 18     (?)│            numeral: display font 700, 15 px (17 px desktop), tabular
│    [▣]    │  middle:   decision icon (16 px) — only for planned / not-confirmed / bento day
│ くまさん  │  bottom:   decision word or recipe short name, text-xs 700, ≤ 2 lines × 4 chars,
│ おにぎり  │            split at a phrase boundary (a11y-responsive.md §9), letter-spacing 0
└───────────┘  badges:   bottom-right 16 px badge (needs review / allergen conflict)
```
Cell box: `radius-cell` (10 px), 1 px `line-1` border (decorative, see a11y §2 note), `surface-2`, padding 3 px. The whole cell is the button (≥ 44 × 68 px at 360 px). Long-press does nothing special.

**Layer 1: day type** (decides what can show)

| Day type (data) | Box | Numeral colour | Content | Tappable → sheet content |
|---|---|---|---|---|
| School day (≥ 1 non-snack item, BR-25) | box | `ink-1` (Sat `saturday`, Sun/holiday `sunday`) | assessment mark + decision (layers 2–3) | yes → full sheet |
| No-lunch day, reason `no-lunch` / `closed` / `unknown` | box + `--hatch` | as above | word `cell.word.noLunch` on a `surface-2` pill (or `cell.word.holiday` if it's a public holiday) | yes → `day.noLunch.body`, no actions |
| No-lunch day, reason `bento-day`, not planned | box + hatch | as above | outline bento icon on a `surface-2` badge + `cell.word.bentoDay` (2 lines: お弁当 / の日) | yes → `day.action.planBentoDay` |
| Bento day, planned | as "planned" in layer 3 (no hatch) | | | yes |
| Outside the menu: weekend, unlisted weekday, weekday of a month with no confirmed menu, snack-only date, date removed by a refresh (dormant records) | **no box** (transparent, no border) | Sat/Sun/holiday colours; else `ink-1` | numeral only; public holiday adds `cell.word.holiday` in `sunday` | yes → `day.outside` / `day.noMenu` / `day.snackOnly`, no actions |
| Padding day (other month) | none | none | none | no |

Holidays (US-E8-04): numeral `sunday` **and** the text 「祝」 (`cell.word.holiday`); the holiday name is in the accessible name. A holiday that the menu lists with lunch is a school day (US-E8-04/AC2): red numeral, 「祝」 shown as a 10 px-high superscript next to the numeral (text-xs), normal school-day content.

**Layer 2: assessment mark** (school days only; top-right)

| `state` (data) | Mark | Colour | Label (sheet chip, aria) |
|---|---|---|---|
| `likely-enjoyable` | ○ circle | `ink-2` | `state.likely` たのしめそう |
| `mixed-uncertain` | △ triangle | `ink-2` | `state.mixed` どちらとも |
| `low-preference` | dashed circle with ? (16 px) | `accent-ink` | `state.low` 苦手かも |
| `not-assessed` | — dash | `ink-2` | `state.notAssessed` 未判定 |
| `no-school-lunch` | none (no-lunch days have no mark) | | `state.noLunch` |
| override present (any of the first three) | the override state's mark **with a 2 px bar under it** (same colour) | | label + `assess.override` 手動で変更 |

**Layer 3: decision** (body + box style)

| Displayed decision | Box style | Icon | Word | Colours |
|---|---|---|---|---|
| `school-lunch-planned`, assessment ≠ low | plain box | none | `cell.word.school` 給食 | `ink-2` word |
| `school-lunch-planned`, assessment = low (the suggestion) | **2 px dashed `accent` border** | none | 給食 (unchanged: low preference never creates a plan, US-E5-04) | `ink-2` word |
| `not-confirmed` | **2 px solid `ink-1` border** | outline bento (16 px) | `cell.word.notConfirmed` 未定 | `ink-1` |
| `homemade-bento-planned` | **solid `navy-fill`**, 3 px `planned-edge` top edge (inset shadow), no border | filled bento (16 px) | recipe `shortNameJa` / `shortNameEn` (≤ 8 chars, 2 lines × 4; never truncated mechanically; missing recipe → `recipeShortNameSnapshot`) | `ink-inverse` for numeral, mark, icon and text |
| `no-school-lunch` (displayed) | per layer 1 | | | |

Only `homemade-bento-planned` is solid-filled, in both themes (US-E8-05/AC3). Suggested (dashed) vs planned (fill + icon + recipe name) differ in border style, fill, icon and text (US-E5-01/AC4, BR-03).

**Layer 4: overlays**

| Overlay | Treatment | Combines with |
|---|---|---|
| Today | numeral inside a filled 24 px circle: `ink-1` circle + `surface-2` numeral; on a planned cell the circle inverts (`ink-inverse` circle + `navy-fill` numeral, 13.20:1); `aria-current="date"` | all |
| Past (before today, Asia/Tokyo) | box background becomes transparent (border kept), numeral `ink-3`; planned cells keep their fill (decided stays decided) but lose the hover state; sheet is read-only (US-E5-02/AC3) | all |
| Weekend column | narrow column; when the weekend date is a school day or no-lunch day in the menu it gets the full box like any school day | all |
| Needs review: refresh conflict (B7), override on a changed day (US-E3-05/AC3), re-applied override (AC8) | 16 px badge bottom-right: `warning-soft` circle, 1.5 px `warning` border, `warning` "!" glyph; on a planned cell the badge keeps its own `warning-soft` fill (12.62:1 against navy); stays after KEEP_PLAN (the marker remains, US-E3-05/AC7) | planned, school |
| Planned recipe contains a registered allergen (US-E1-05/AC2) | same badge shape in `danger-soft` / `danger` with "!" ; takes the badge slot (priority over needs-review; both are named in the accessible name) | planned |
| Dormant override / dormant not-confirmed / school-lunch record (US-E3-05/AC8, AC11, AC12) | **nothing shown**: the cell renders by its current day type (no-lunch or outside), without the override bar | — |
| Missing recipe (US-E6-06) | planned cell with the snapshot short name; no badge (the sheet explains) | planned |
| Selected (desktop, the date shown in the side panel) | inset 3 px ring `ink-1` (on a planned cell: `ink-inverse`) + `aria-selected="true"` on the gridcell | all |

**Interaction states**

| State | Treatment |
|---|---|
| default | as layers above |
| hover | border `line-ui` (boxed cells); boxless cells get a `surface-3` rounded background; planned: 1 px inset `ink-inverse` ring. None on past cells |
| focus-visible | ring + halo (the halo keeps the ring visible on navy cells and in the 2 px gaps) |
| active | boxed cells `surface-3` background (planned: no change) |
| disabled | n/a: every date is tappable (read-only content for past/outside) |
| loading | skeleton cell (`--skeleton` box) during hydration only |
| error | n/a (data errors surface as banners) |
| empty | outside-menu/padding rules above |
| selected | desktop only, above |

**Accessible name** (button `aria-label`, built from `copy.md` §8 keys, full sentence, never colour words):
- School day: `[今日、]{date}[、{holidayName}]、{assessment}、{decision}[、手動で変更][、献立が変わりました][、アレルゲン注意][、過去の日]` → 「11月4日（水）、苦手かも、給食」 (matches US-NF-02/AC4), 「今日、11月18日（水）、苦手かも、手作りお弁当：くまさんおにぎり弁当、手動で変更」.
- Planned uses the **full** recipe name (US-E5-01/AC4).
- No-lunch: 「11月27日（金）、給食なし（午前保育（給食なし））」; bento day: 「11月20日（金）、お弁当の日、未計画」.
- Outside: 「11月7日（土）、献立に記載なし」; holiday: 「11月3日（火）、文化の日、献立に記載なし」; no-menu month: 「12月1日（火）、献立未取り込み」.

**Sizes**

| | 360 | 390 | ≥ 1280 |
|---|---|---|---|
| Weekday cell width | ≈ 50 px | ≈ 56 px | ≈ 92 px |
| Weekend cell width | 44 px (min) | 44 px | ≈ 57 px |
| Row height | 68 px | 68 px | 88 px |
| Recipe short name | 2 lines × 4 chars, 12 px | same | same chars, 13 px, 1–2 lines |

Test ids: `cal-cell-<date>`; data attributes for QA (not for styling): `data-assessment`, `data-decision`, `data-today`, `data-past`, `data-flag` (`changed`/`allergen`), `data-override`. Stories: US-E5-01/AC1–AC4, AC8, US-E5-04, US-E5-05/AC1, US-E5-08, US-E4-03/AC1, US-E3-05/AC2, AC3, AC6–AC8, AC11, AC12, US-E6-06, US-E8-04, US-E8-05/AC3, US-NF-02/AC3–AC4, BR-03.

### 2.5 Upcoming summary (「これからの手作りお弁当」)
Anatomy: heading (h2 with red dot, `upcoming.title`) · card list. Rows (48 px min, full-row button → day sheet):
1. Up to 3 next `homemade-bento-planned` days from today: date (`fmt.date` compact: 「11/18 水」 visually, full date in the accessible name), mini planned swatch (navy square + bento icon), recipe name (1 line, ellipsis allowed here because the full name is in the accessible name), sub-line `upcoming.today` / `upcoming.tomorrow` / `upcoming.inDays`.
2. Refresh conflicts not yet acknowledged: warning mini-badge + `upcoming.conflict` (US-E3-05/AC2).
3. Not-confirmed days within 7 days: outline-bento swatch + `upcoming.notConfirmed` (US-E5-05/AC2).
4. Attention row (only when n ≥ 1): dashed-? swatch + `upcoming.lowCount` + `upcoming.lowCount.sub`, `accent-soft` background; tap → the first such day's sheet.
States: default; hover (row `surface-1`); focus-visible (row ring); active (`surface-3`); disabled n/a; loading (2 skeleton rows); error n/a; empty: `upcoming.empty` as a plain line in the card (no rows), the attention row may still appear below it.
Sizes: 390 full width; desktop same column. Test ids: `upcoming`, `upcoming-row-<date>`, `upcoming-low`, `upcoming-empty`. Stories: US-E5-01/AC7, US-E5-05/AC2, US-E3-05/AC2, AC7, US-E0-01/AC1.

### 2.6 Today card
Anatomy: eyebrow `today.label` · status row: 44 px icon tile (bento / school bowl / outline bento / no-lunch) + headline (h2, `text-xl`, display font) · optional assessment chip (school days) · action or note:

| Today's displayed decision | Headline | Below |
|---|---|---|
| `homemade-bento-planned` | `today.planned` | `today.cta.recipe` primary (→ recipe detail); if the recipe has a registered allergen: danger row `day.recipeAllergen` |
| `school-lunch-planned` | `today.school` | `day.reservation.note` (info note) + reservation checkbox (US-E5-07/AC3) |
| `not-confirmed` | `today.notConfirmed` | `today.cta.plan` secondary (→ day sheet) |
| `no-school-lunch` (incl. bento day not planned) | `today.noLunch` | bento day not planned: `day.action.planBentoDay` |
| Today not a school day (weekend, outside menu) | `today.next` with the next school day's date and decision | none; tap the card → that day's sheet |
| No upcoming school day known | `today.nextUnknown` | `menuCard.import` text button |

The card re-renders when the Tokyo date changes (checked at least once a minute, US-E7-03/AC3); no animation.
States: default; hover (only when the whole card is a link: `surface-1`); focus-visible; active; disabled n/a; loading (skeleton headline); error n/a; empty = the last row of the table.
Sizes: 390 full width, 16 px padding; desktop same column, headline `text-2xl`. Test ids: `today-card`, `today-headline`, `today-cta`. Stories: US-E7-03/AC1–AC3, US-E5-07/AC1, AC3, US-E7-02/AC5.

### 2.7 Menu cards (calendar)
Warning-banner style cards with one action:
- **Missing menu** (`menuCard.missing.current` when no menu has ever been confirmed and the visible month is the current month, i.e. onboarding was skipped; otherwise `menuCard.missing.month`) + `menuCard.missing.body` + `menuCard.import` primary. Shown for the visible month when it has no confirmed menu **and** it is the current or a future month (US-E3-06/AC3: never for past months).
- **Pending review** `menuCard.pending` + `menuCard.pending.action` (US-E3-03/AC3).
- **Next month** `menuCard.nextMonth` + `menuCard.import` + `menuCard.dismiss` (from `nextMonthPromptFromDay`; once per day, US-E3-06/AC2).
States: default; focus/hover on actions; others n/a; empty = not rendered. Test ids: `card-menu-missing`, `card-menu-pending`, `card-menu-next`. Stories: US-E1-01/AC5, US-E3-06/AC1–AC3, US-E3-03/AC3.

### 2.8 Legend (「表示の見かた」)
Disclosure (button with chevron, `aria-expanded`), **expanded by default until the first bento is planned**, then collapsed (state remembered). Content: `legend.rule` + 2-column list of swatches (28 px) with labels: planned, not confirmed, suggestion, ○ たのしめそう, △ どちらとも, — 未判定, no-lunch hatch, bento day, needs review badge, override bar, weekend/holiday numerals. Labels use the same copy as the cells.
States: default; hover/focus/active on the disclosure; others n/a. Test id `legend`. Stories: US-E5-01/AC3, US-NF-02/AC3.

---

## 3. Day sheet

### 3.1 Structure
Header: `fmt.date` (h2) · holiday sub-title `day.holiday` when applicable · close.
Sections, in order, each only when it applies:
1. **Conflict / changed banner** (warning): `day.conflict.flag` + `day.conflict.nowNoLunch` or `day.conflict.removed`; after KEEP_PLAN also `day.conflict.kept`. Or `assess.changed` for an overridden day whose dishes changed (US-E3-05/AC3, AC8).
2. **Recipe allergen conflict** (danger): `day.recipeAllergen` + `day.action.changeRecipe` (US-E1-05/AC2).
3. **Menu** (`day.menu.heading`): list of items as imported (ja). Disliked items: wavy `accent` underline **and** tag 「苦手」; liked: tag 「好き」. Snack items under `day.menu.snack`. Allergen line `day.menu.allergens`; for a child with known allergies: `day.allergen.match` (warning row) or `day.allergen.notDeclared` (info row). No-lunch day: `day.noLunch.body`; outside: `day.outside`; no-menu month: `day.noMenu` + `menuCard.import`.
4. **Assessment** (`day.assess.heading`, §3.2) — school days only.
5. **Plan** (`day.decision.heading`, §3.3).
6. **Read-only note** `day.past` for past days (actions not rendered at all, US-E5-02/AC3).

| | 390 | ≥ 1280 |
|---|---|---|
| Container | bottom sheet (§1.12) | side panel 440 px |
| Section spacing | 20 px | 24 px |

States: default; loading (skeleton, only if > 100 ms); empty (`day.panel.empty`, desktop); error n/a; hover/focus/active per inner control; disabled = past/outside (no controls rendered, explanatory note instead).
Test ids: `day-sheet`, `day-menu`, `day-assessment`, `day-plan`, `day-banner-conflict`, `day-banner-allergen`, `day-past-note`, `day-outside-note`. Stories: US-E5-02/AC1–AC3, US-E4-01/AC9–AC10, US-E4-05, US-E3-05.

### 3.2 Assessment block and override control
Anatomy: `accent-soft` block when low preference, `surface-3` otherwise · state chip (mark icon + `state.*`; low uses dashed ? and `accent-ink` on `surface-2`) · optional `assess.override` tag with pencil icon · explanation sentence (`text-md` 700) from `explanationKey` + params (§9 of copy) · when overridden: `assess.override.calc` + the calculated explanation · footnote `assess.basis` (`text-sm`, `ink-2`) · `override.button` text button.
Override control (expands inline below the button, not a new dialog): radio group `override.legend` with three options (たのしめそう / どちらとも / 苦手かも, each with its mark icon), current state checked; `override.note`; `override.reset` text button when an override exists. Selecting an option saves immediately (`override.saved` in a polite live region); the cell updates behind the sheet.
Desktop: the three options render as a segmented control (§1.7) instead of radio rows.

| State | Treatment |
|---|---|
| default | as above |
| hover / focus-visible / active | per control |
| disabled | not rendered on past days, no-lunch days, outside days (US-E4-03/AC4, BR-27) |
| loading | n/a (local) |
| error | write failed → toast `toast.saveFailed`, selection reverts |
| empty | `assess.notAssessed` + `assess.notAssessed.action` link when the profile has no likes/dislikes or no profile exists |
| selected | checked radio / filled segment |

Test ids: `assess-chip`, `assess-explanation`, `assess-override-tag`, `override-open`, `override-option-<state>`, `override-reset`. Stories: US-E4-02/AC1–AC4, US-E4-03/AC1–AC5, US-E4-04, BR-01, BR-05.

### 3.3 Plan section (decision actions per state)
Status line `day.decision.current` with the decision word and its cell icon (same shapes as the calendar). Actions render **only** when allowed by the state machine (US-E5-02/AC1); everything else is absent, not disabled.

| Displayed state / context | Shown | Actions (order; variant) |
|---|---|---|
| `school-lunch-planned`, school day, today or later | status 給食; `day.reservation.note`; checkbox `day.reservation.check` + hint | `day.action.bento` (primary, sub `day.action.bento.sub`) · `day.action.later` (secondary, sub) |
| `not-confirmed`, school day | status 未定 | `day.action.bento` (primary) · `day.action.backToSchool` (secondary, no dialog) |
| `homemade-bento-planned`, school day | planned recipe card: navy banner `recipe.plannedFor`, recipe name (full), minutes, illustration | `day.action.viewRecipe` (primary) · `day.action.changeRecipe` (secondary) · `day.action.later` (secondary) · `day.action.backToSchool` (destructive-text → dialog `day.cancel.*`) |
| bento day (`no-school-lunch`, reason `bento-day`), not planned | `day.bentoDay.body` | `day.action.planBentoDay` (primary) |
| `homemade-bento-planned` on a bento day | recipe card | `day.action.viewRecipe` · `day.action.changeRecipe` · `day.action.clearPlan` (destructive-text → dialog `day.clear.*`). Never 給食に戻す / あとで決める (US-E5-08/AC3) |
| Refresh conflict (planned; date now no-lunch ≠ bento-day, or removed) | conflict banner (§3.1); recipe card with the recipe name as a link to the detail | `day.action.keep` (secondary) · `day.action.clearPlan` (destructive-text → dialog). Nothing else (US-E3-05/AC2, AC6) |
| Same, after このまま (KEEP_PLAN) | banner stays + `day.conflict.kept` | same two actions (US-E3-05/AC7) |
| Planned, recipe missing from the library | recipe card with `recipeNameSnapshot`; warning row `day.recipeMissing` | `day.recipeMissing.action` (primary, = change recipe) · `day.action.later` · `day.action.backToSchool` (US-E6-06) |
| No-lunch (other reasons), outside, snack-only, no-menu month, dormant | explanatory body | none |
| Past day (any state) | status line + recipe card if planned; checkbox state as text if recorded | none; `day.past` |

Action buttons: 52 px, full width on 390, stacked with 8 px gaps; desktop: full width of the 440 px panel. Each action with a sub-line is a choice card (§1.9 visuals, `button` semantics).
States: default; hover; focus-visible; active; disabled n/a (absent instead); loading (pressed button busy while the store write runs; others disabled); error (write failed → `toast.saveFailed`, state unchanged; the sheet stays open); empty n/a; selected n/a (the status line shows the current state).
After a successful change: toast `day.saved.*`; the sheet stays open and re-renders (except 手作りお弁当にする, which navigates to recommendations without writing, US-E5-03/AC1).
Test ids: `day-status`, `day-action-bento`, `day-action-later`, `day-action-school`, `day-action-view-recipe`, `day-action-change-recipe`, `day-action-plan-bento-day`, `day-action-clear-plan`, `day-action-keep`, `check-reservation`. Stories: US-E5-02–US-E5-08, US-E3-05/AC2, AC6, AC7, US-E6-06, US-E7-02/AC6, BR-02, BR-27.

---

## 4. Recommendations

### 4.1 Screen
Top bar (back = leave without change, US-E5-03/AC3) · title `rec.title` · lead `rec.lead` · `allergy.unknown.banner` (warning) **above the cards** when allergy status is `unknown` (US-E1-03/AC5) · `rec.fewer` note when 1–2 pass · up to 3 cards · `rec.more` text button → expands the full ranked list (§4.3) · `allergy.disclaimer` info box (always, US-E6-03/AC1).

| | 390 | ≥ 1280 |
|---|---|---|
| Cards | one column, 16 px gaps | three columns (equal), max 1200 px |
| Disclaimer | below the list | below the list, full width |

States: default; loading (3 skeleton cards; `rec.loading` for screen readers; ≤ 100 ms budget); empty (§1.14: `rec.none`, `rec.none.body`, links `rec.none.profile`, `rec.none.library`; the decision is unchanged, US-E6-01/AC5); error n/a (local); hover/focus/active per card; disabled n/a.
Live region: `live.recCount` once on load. Test ids: `screen-recs`, `recs-fewer`, `recs-empty`, `recs-more`, `disclaimer`, `banner-allergy-unknown`. Stories: US-E6-01, US-E6-02, US-E6-03, US-E5-03, US-E1-03/AC5, US-E0-01/AC1.

### 4.2 Recommendation card
Anatomy: illustration panel 112 px (`surface-3`, red stripe band at its bottom, decorative) with rank badge `rec.rank` (navy pill, text) · name (h3, `text-lg`, ja; en name below in `ink-3` when language = ja and an en name exists, and vice versa) · meta: clock icon + `fmt.minutes` · reason chips (≤ 2: `rec.reason.liked`, `rec.reason.theme`, `rec.reason.quick`, success tags with check icons) · allergen line `rec.allergens` (dictionary labels) or `rec.allergensNone` · compact processed-food notice `warn.processed.card` (§5.4; replaces the retired `rec.mayContain`, `rec.variesByProduct`, `rec.incomplete`) · actions: `rec.confirm` (primary on card 1, secondary on 2–3) and `rec.details` link.

Domain states:

| State | Treatment |
|---|---|
| complete allergen data | as above |
| processed ingredient and child with a registered allergen | compact notice `warn.processed.card` (§5.4), placed under the allergen line, above the actions; otherwise absent (US-E6-02/AC11, AC12). Incomplete data and brand-label data change nothing (retired, AC13) |
| current recipe (change-recipe mode) | tag `rec.current`; its `rec.confirm` disabled with that tag as the reason |

Interaction states: default; hover (card `elevation-2`, the card itself is not a link: only its buttons/links are); focus-visible (on the buttons); active; disabled (current recipe only); loading (pressed `rec.confirm` shows `rec.saving`, other cards' buttons disabled); error (write failed → `toast.saveFailed`, stay on screen); empty n/a.
On success: decision written (CONFIRM_RECIPE or CHANGE_RECIPE), navigate back to the calendar with the day sheet open, toast `day.saved.bento`.
Test ids: `rec-card-<i>`, `rec-card-<i>-confirm`, `rec-card-<i>-processed`. Stories: US-E6-01/AC1–AC3, US-E6-02/AC9–AC12, US-E6-03/AC3, US-E5-03/AC2, US-E5-06/AC1.

### 4.3 「ほかのレシピ」 list
Same card in a compact row form (64 px illustration thumb, name, minutes, allergen line, `warn.processed.card`, `rec.confirm` secondary). Contains only recipes that pass the hard filters, in rank order (US-E6-01/AC6). States as 4.2. Test id `recs-more-list`.

---

## 5. Recipe detail, library, plan-date picker

### 5.1 Recipe detail
Anatomy: top bar · hero illustration 150 px with navy stripe band · planned banner (`navy-fill`, `planned-edge` left edge, `recipe.plannedFor`) when this recipe is planned on the date in context · name (h1) + other-language name · meta row: `recipe.time`, `recipe.yield`, `recipe.theme` · badges: allergens (`rec.allergens` / `rec.allergensNone`), diet badges `recipe.diet` (only for diets the child selected) · warning rows: `allergy.unknown.banner` (above everything else when status unknown), `day.recipeAllergen` (planned + conflicting) · `warn.processed.recipe` notice (§5.4, once, directly above the ingredients) · `recipe.ingredients` table (label left, quantity + unit right, tabular numerals; processed rows carry the `warn.processed.item` marker under the label, §5.4) · `recipe.steps` numbered list (navy step circles, `leading-relaxed`) · `recipe.storage` with the recipe's storage notes + `recipe.safety.cool`, `recipe.safety.carry`, `recipe.safety.credit` (linked) · `recipe.adapted` note · `recipe.sources` list (publisher, title, link with `common.newWindow`, `recipe.source.accessed`) · `allergy.disclaimer` info box (always) · sticky footer with the context action:

| Context | Footer |
|---|---|
| From recommendations (date in context, not yet planned) | `rec.confirm` primary |
| Planned on the date in context (school day) | `day.action.changeRecipe` secondary · `day.action.backToSchool` destructive-text |
| Planned on a bento day | `day.action.changeRecipe` · `day.action.clearPlan` |
| From the library | `recipe.planPick` primary (disabled with `library.conflict.cantPlan` + reason when the recipe conflicts) |
| From a reminder (US-E7-02/AC2) | as "planned" |
| Past date in context | none |

| | 390 | ≥ 1280 |
|---|---|---|
| Layout | single column, footer sticky | two columns: left (hero, meta, badges, ingredients) 400 px; right (steps, storage, sources); footer inline at the top right |

States: default; loading (skeleton); error/empty: unknown id → not-found block `recipe.notFound` + `recipe.notFound.back` (US-E6-04/AC3); hover/focus/active on links and buttons; disabled (library conflict, above).
Test ids: `screen-recipe`, `recipe-planned-banner`, `recipe-ingredients`, `recipe-processed-notice`, `recipe-ingredient-<id>-processed`, `recipe-steps`, `recipe-safety`, `recipe-sources`, `disclaimer`, `recipe-footer-action`, `recipe-not-found`. Stories: US-E6-04/AC1–AC5, US-E6-03/AC1, AC3, AC4, US-E1-03/AC5, US-E6-02/AC11–AC12, US-E7-02/AC2, US-E0-01/AC1.

### 5.2 Recipe library
List of every recipe, plannable ones first (rank-free order: by name), then conflicting ones **greyed** (`surface-3` row, `ink-3` meta, name stays `ink-1` for legibility) with the reason line (`library.conflict.*`, warning icon) and `rec.confirm`/`recipe.planPick` disabled (US-E6-02/AC1, AC6, AC8, US-E6-05/AC1). Lead `library.lead`.
Row: 72 px thumb, name, minutes, allergen line, reason (if any), chevron → detail.
States: default; hover (row `surface-1`); focus-visible; active; disabled (conflict rows: still focusable and openable, the plan action inside is disabled); loading (skeleton rows); error n/a; empty `library.empty`.
390: single column; desktop: 2-column grid of rows. Test ids: `screen-library`, `library-row-<recipeId>`, `library-row-<recipeId>-reason`.

### 5.3 Plan-date picker (library → 「日付を選んで計画」)
Bottom sheet (dialog on tablet/desktop): `recipe.planPick.title`, `recipe.planPick.lead`, radio list of plannable dates from today (school days + bento days of confirmed menus; option `recipe.planPick.option`), primary `rec.confirm`. Choosing a date then applies the same confirm as US-E5-03/AC2.
States: default; selected (radio); loading (confirm busy); error (`toast.saveFailed`); empty `recipe.planPick.empty`; disabled confirm until a date is chosen (hint: the lead). Test ids: `plan-pick`, `plan-pick-option-<date>`, `plan-pick-confirm`. Stories: US-E6-05/AC2.

---

### 5.4 Processed-food warning (marker, recipe notice, compact notice) (PO 2026-11-01; US-E6-02/AC9–AC14, US-E6-03/AC4–AC5, US-E6-04/AC4–AC6, US-E1-03/AC7)
**Trigger (all three parts).** Shown only when the child's `knownAllergenIds` is non-empty and the recipe passes the filters; trigger = the ingredient's dictionary `info = varies`, never the recipe's `allergenInfo` or `allergenDataComplete`. With an empty list (none-known, unknown, or only excluded foods) none of the three is rendered (no empty space, no hidden node). `allergy.unknown.banner` is independent and keeps its place. Excluded recipes (F1') show no warning: they show the reason `library.conflict.allergen`. Nothing here ever says or implies safety.

**A. Ingredient marker (`warn.processed.item`, detail only).**
- Anatomy: inline tag under the ingredient label inside the label cell: 16 px package-box icon (outline, `aria-hidden`) + text `warn.processed.item`, `text-sm` (14 px), weight 600, colour `warning`, no fill, no border. The text is always visible, so the meaning never relies on colour or the icon.
- Placement: label cell, second line, 4 px above the quantity baseline; quantity stays right-aligned. Rows of non-processed foods have no marker and the same row height as before.
- Wrapping: the text wraps inside the label cell (no truncation, no ellipsis); on 390 px at most 2 lines.
- Surface: page (`surface-1`) or card (`surface-2`); both audited (W1, W2).
- States: default; hover, active, disabled, loading, error, empty n/a (not interactive, no tap target needed, not focusable); focus-visible n/a; dark mode via tokens (`warning` becomes the gold).
- Screen reader: part of the row text, read after the label and before the quantity: 「<label>、市販品。表示を確認、<quantity>」. No extra role.

**B. Recipe notice (`warn.processed.recipe`, detail only, once).**
- Anatomy: the warning banner of §1.10 without title and without close: `warning-soft` fill, 12 px radius, 20 px triangle-! icon (`warning`, `aria-hidden`), body text `text-md` in `ink-1`, `leading-relaxed`. A visually hidden `warn.processed.prefix` precedes the body for screen readers. The whole sentence is one paragraph; the allergen names are part of it (the same weight, no chips).
- Placement: in the left column on desktop, directly above the `recipe.ingredients` heading (after the badges and `allergy.unknown.banner`, before the ingredient table), full width of the column (max 760 px). Not sticky.
- Allergen list: the child's full list in the order of `knownAllergenIds`, never truncated, summarised or collapsed (the full list is the safety information). It wraps like any text (`overflow-wrap: anywhere`; ja breaks after 「、」). With 29 allergens the notice is about 6 lines at 390 px; accepted.
- States: default; hover/active/disabled/loading/error/empty n/a (static text; loading = absent until the profile and recipe are loaded, no layout jump because the notice sits above the table in a skeleton slot); focus-visible only on links inside (none). No `role`: it is present on load, so it is read in DOM order and not announced as a live update. If the profile changes while the screen is open, the notice appears with `role="status"`.
- Dark mode: `warning-soft` fill, `ink-1` text, `warning` icon (all audited, W3, W4).
- Test ids: `recipe-processed-notice`, `recipe-ingredient-<id>-processed`.

**C. Compact notice (`warn.processed.card`; recommendation card, 「ほかのレシピ」 row, plannable library row, plan-date picker header).**
- Anatomy: one line, 16 px triangle-! icon + text `warn.processed.card`, `text-sm` weight 600, colour `warning`, no fill (cards are already dense). It does not list allergens, so nothing to truncate.
- Placement: card: under the allergen line, above the actions. Compact row: after the allergen line. Library: plannable rows only, in the reason line position; greyed (conflict) rows show only their reason. Plan-date picker: under the recipe name in the sheet header, above `recipe.planPick.title` options.
- Surfaces: `surface-2` (card, sheet) or `surface-1` (page rows); both audited (W1, W2). Not used on `surface-3` greyed rows.
- Wrapping: wraps to 2 lines on a 320 px column; never truncated.
- States and a11y as A: static, not focusable, no tap target; read in DOM order with the card text; icon `aria-hidden`.
- Test id: `rec-card-<i>-processed`, `library-row-<recipeId>-processed`.

---

## 6. Onboarding and import

### 6.1 Onboarding frame
Top bar (no back on step 1; 設定 on every step, §1.2, US-E1-01/AC6) · stepper (§1.15) · content · sticky footer (primary action; text actions above it). Desktop: centred card max 640 px on `surface-1` with the stripe band above it. Steps: 1 `ob.step1.name`, 2 `ob.step2.name`, 3 `ob.step3.name`; then the calendar (not a step, US-E1-01/AC1). Reload resumes the step with saved answers (US-E1-01/AC3–AC4).
Test ids: `screen-onboarding`, `ob-step-<n>`.

### 6.2 Step 1: profile (also the profile-edit screen)
Fields in order: `profile.nickname.label` (text) · `profile.age.label` (single-choice chips, required) · `profile.likes.label` and `profile.dislikes.label` (food pickers, §6.3) · `allergy` (radio group with three options, none preselected, required, §6.4) · `diet` (multi chips) · `theme` (multi chips, max 3) · `profile.note.label` (textarea) · `ob.privacy.local` note · footer `common.next`.
No birthdate, gender, height, weight, photo, real name or school field (US-E1-02/AC6, BR-20).
Validation on 「次へ」: age missing → `profile.age.error`; allergy status missing → `allergy.status.error`; has-known with nothing → `allergy.pick.error`. Errors show inline at each group; an error summary is announced (`live.formErrors`, assertive) and **focus moves to the first invalid group** (US-E1-02/AC4).
Profile edit (from settings): same fields, title `profileEdit.title`, note `profileEdit.keepsPlans`, footer `profileEdit.save` + `profileEdit.cancel`; leaving with changes → dialog `profileEdit.discard.*`.

| State | Treatment |
|---|---|
| default | empty fields, no option preselected |
| hover/focus/active | per control |
| disabled | 「次へ」 is never disabled (it validates on press, so errors are discoverable) |
| loading | `common.next` busy while saving (instant) |
| error | per group as above |
| empty | food pickers show `profile.foods.empty` |

390: single column; desktop: centred 640 px card, chips wrap wider. Test ids: `input-nickname`, `group-age`, `picker-likes`, `picker-dislikes`, `group-allergy`, `picker-allergens`, `picker-other-foods`, `group-diet`, `group-theme`, `input-note`, `ob-next`. Stories: US-E1-02/AC1–AC7, US-E1-03/AC1–AC4, AC6, US-E1-04/AC1–AC4, US-E1-05/AC1, AC3.

### 6.3 Food picker (likes / dislikes / other foods)
Anatomy (revised 2026-10-25 to match the M1 build, which passed axe and the keyboard journey): legend + hint · selected chips (navy, removable) · search input (`profile.foods.search`, `type="search"`) · **results as toggle chips grouped by kind** while the search has text · `profile.foods.popular` chips (12 common ids, not grouped) while the search is empty. The earlier combobox + listbox pattern is retired: chips with `aria-pressed` are simpler, work with touch and need no `aria-activedescendant`.

**Result groups** (dictionary `kind`; US-E1-02/AC8: every result shows exactly one kind label, here as the group heading, never by colour or icon alone):

| Order | Kind | Heading key | ja (US-E1-02/AC8, exact) | en (US-E1-02/AC8, exact) | Shown in |
|---|---|---|---|---|---|
| 1 | `ingredient` | `picker.group.ingredient` | 食材 | Ingredient | likes, dislikes, other foods (allergy) |
| 2 | `dish` | `picker.group.dish` | 料理 | Dish | likes, dislikes (the allergy "other foods" picker searches ingredients and categories only) |
| 3 | `category` | `picker.group.category` | 種類 | Food group | likes, dislikes, other foods (allergy) |

- Each group: heading (`text-xs` 700, `ink-2` on `surface-1`/`surface-2`, P04/P05; a `<p>` with an id, **not** an `h*` element, so the form's heading outline stays flat) followed by a `ul` of chips with `aria-labelledby` = the heading id. Group order is fixed (食材 → 料理 → 種類, US-E1-02/AC8), matches keep the search's ranking inside each group.
- A group with no match is **not rendered** (no empty heading). If only one group has matches, its heading still shows (it tells the parent what kind of thing the chip is, e.g. that 「さかな」 is a whole group).
- The 12-result cap applies to the total across groups, as built (`searchFoods(…, 12, kinds)`).
- **Result chip accessible name includes the kind** (AC8): `aria-label` = `picker.withKind` 「{food}（{kind}）」, e.g. 「鶏肉（種類）」 / "Chicken (Food group)"; the visible text stays the label (the heading shows the kind). The list also has `aria-labelledby` = heading, so screen readers announce 「種類、リスト、2項目」 on entering a group.
- **Popular chips** (empty search, not grouped): visible label + kind in the accessible name the same way.
- **Selected chips**: accessible name always `picker.withKind`; the **visible** text adds the kind (「鶏肉（種類）」) only when another selected chip in the same picker has the same label (AC8, e.g. 鶏肉 the ingredient and 鶏肉 the group). The remove button name `profile.foods.remove` uses the same `{food}` string (with kind).
- 16 px space between groups, 8 px between heading and chips.

Behaviour: selecting an id that is in the other list moves it and announces `profile.foods.moved.*` (polite, US-E1-02/AC3); 31st item refused with `profile.foods.limit`.
States: default; hover (chip border `ink-1`); focus-visible (ring on the chip); active (`surface-3`); selected (navy + check, `aria-pressed="true"`); disabled (all unselected chips when 30 are chosen, with the limit text); loading n/a (local dictionary); error (limit notice, polite); empty (search no match: `profile.foods.searchEmpty`, no group headings; no selection: `profile.foods.empty`).
390: groups stack, chips wrap; desktop: same, max 560 px wide.
Test ids: `picker-<name>-search`, `picker-<name>-group-<kind>` (the `ul`), `picker-<name>-option-<id>`, `picker-<name>-chip-<id>`. Stories: US-E1-02/AC2–AC3, AC8, US-E1-03/AC2 (other foods).

### 6.4 Allergy status and allergen picker
Radio group `allergy.label` + `allergy.helper` (always visible, US-E1-03/AC6) with `allergy.status.none`, `allergy.status.has`, `allergy.status.unknown` (none preselected).
- `has`: reveals the allergen picker: `allergy.pick.mandatory` (9 multi chips) and `allergy.pick.recommended` (20 multi chips), then `allergy.pick.other` food search (§6.3, writes `excludedIngredientIds`) with `allergy.pick.otherHint`. Switching away from `has` keeps the picks hidden but discards them on save (contract rule `profile-allergy-status`).
- `unknown`: reveals the warning banner `allergy.unknown.banner` inline as a preview of what recipe screens will show.
- `none`: nothing more.
States: default (no selection); selected; hover/focus/active per radio/chip; error (`allergy.status.error` / `allergy.pick.error`); disabled n/a; loading n/a; empty = no selection.
Test ids: `radio-allergy-none-known`, `radio-allergy-has-known`, `radio-allergy-unknown`, `chip-allergen-<id>`, `allergy-error`.

### 6.5 Step 2: menu source (also 「献立を取り込む」 from the calendar or settings)
Anatomy: title `import.title` · lead · `import.month.label` select (default: current Tokyo month; from `nextMonthPromptFromDay` on, the next month) · URL input (`import.url.*`, prefilled with the saved URL, US-E2-01/AC4) · primary `import.submit` · divider `import.or` · secondary `import.upload` (file input `accept="application/pdf"`, visually a button; selected file name `import.upload.selected`) · privacy box `import.privacy.title` + `import.privacy.body` + `import.privacy.more` · text buttons `import.manual` and (onboarding only) `import.later`.

| State | Treatment |
|---|---|
| default | as above |
| hover / focus-visible / active | per control |
| disabled | offline: URL field and both import buttons disabled + danger banner `import.err.offline`; `import.manual` and `import.later` stay enabled (US-E10-01/AC3) |
| loading | after 取り込む: button busy (`import.progress.fetching`) then the progress screen (§6.6) |
| error | see the error panel table below |
| empty | URL empty + 取り込む → `import.url.error` |

**Error panel** (danger banner directly under the URL field; `role="alert"`; focus moves to it; the URL stays in the field, US-E2-02/AC1; the upload button becomes **primary** and 取り込む secondary):

| Failure (adapter / validation) | Message key | Actions shown | Story |
|---|---|---|---|
| URL not https / port ≠ 443 / not a URL / > 2048 chars (client, before any request) | `import.url.error` (inline field error, not the panel) | fix the field | US-E2-01/AC2, AC3 |
| network error / timeout 15 s | `import.err.network` + `import.err.urlKept` | `import.upload` | US-E2-02/AC1 |
| HTTP 404 | `import.err.notFound` + `import.err.urlKept` | `import.upload` | US-E2-02/AC1 |
| HTTP 403, CORS-type block, private/loopback address, > 3 redirects | `import.err.blocked` + `import.err.urlKept` | `import.upload` | US-E2-02/AC1, AC3 |
| response is HTML, not PDF | `import.err.notPdfUrl` | `import.upload` | US-E2-02/AC1 |
| server download > 10 MB | `import.err.tooLarge` | `import.upload` | US-E2-02/AC3 |
| uploaded file not a PDF (`%PDF-` check) | `import.err.notPdfFile` | `import.upload` (pick again) | US-E2-03/AC2 |
| uploaded file > 10,485,760 bytes | `import.err.tooLarge` | `import.upload` | US-E2-03/AC3 |
| 0-byte or encrypted PDF (`unreadable-pdf`) | `import.err.unreadable` | `import.upload` | US-E2-03/AC4 |
| AI malformed twice (repair retry failed) | `import.err.malformed` | `common.retry` (primary) · `import.upload` · `import.manual` | US-E2-05/AC2 |
| AI unavailable on both models / HTTP 400, 403, 404 from the provider | `import.err.unavailable` | `common.retry` · `import.upload` · `import.manual` | US-E2-06/AC2, AC7 |
| rate-limited on both models / proxy cap | `import.err.busy` | `common.retry` disabled for `retryAfterSeconds` (default 60) showing `common.retryIn` countdown (updated every second visually, announced only at start and when enabled) · `import.upload` · `import.manual` | US-E2-06/AC6, AC8 |
| adapter not configured | `import.err.notConfigured` (+ dev hint `import.err.notConfigured.dev` in dev builds) | `import.manual` only (upload also needs the adapter, so it is not offered) | US-E2-06/AC4 |
| offline | `import.err.offline` | `import.manual` | US-E10-01/AC3 |
| same sha256 as a stored extraction | not an error: review opens with info banner `import.sameFile` + `import.sameFile.sub` | — | US-E2-07/AC1 |

The import failure never touches stored menus or plans (US-E2-06/AC3); the panel for AI failures adds the reassurance already contained in `import.err.unavailable`.
Test ids: `import-month`, `input-url`, `input-url-error`, `import-submit`, `import-upload`, `import-manual`, `import-later`, `import-error`, `import-error-retry`. Stories: US-E2-01–US-E2-07, US-E1-01/AC3, AC5, US-E3-04/AC1, US-E10-01/AC3.

### 6.6 Import progress screen
Full screen (replaces step content; stepper stays at 2): bento illustration, stripe band, headline `import.progress` (h1, `role="status"`), sub-line `import.progress.sub`, indeterminate bar (3 px, `ink-1` on `line-1`; reduced motion: static bar at 40 % + text only), `import.progress.cancel` text button (returns to step 2; for a refresh the previous menu stays active, US-E3-05/AC5).
States: default (loading by definition); focus on the headline when shown; hover/active on cancel; error → back to step 2 with the error panel; empty/disabled n/a.
Test ids: `import-progress`, `import-cancel`.

### 6.7 Consent dialog (AI notice)
`role="dialog"`, not dismissible by scrim tap (explicit choice required; Esc = 同意しない). Title `consent.title`; paragraphs `consent.p1`–`consent.p4` (all six facts, US-E2-08/AC4); link `consent.link`; actions `consent.accept` (primary) and `consent.decline` (secondary). Body scrolls inside the dialog at 390 (max-height 80 vh) with the actions always visible.
After decline: dialog closes, info banner `consent.declined` + `import.manual` primary on step 2 (US-E2-08/AC2).
States: default; hover/focus/active on actions; loading (accept → progress screen); disabled/error/empty n/a.
Test ids: `consent-dialog`, `consent-accept`, `consent-decline`. Stories: US-E2-08/AC1–AC4.

### 6.8 Step 3: review table (menu review)
Anatomy:
- Title `review.title` (or `review.manual.title`) · lead · `import.sameFile` banner (if applicable) · `review.warn.*` warning banners (one per `warnings[]` value).
- **Summary bar** (sticky under the top bar): `review.uncertain.summary` with warning icon (or `review.uncertain.none` with check icon) + `review.uncertain.next` secondary small button + `review.openPdf` text button.
- `review.day.weekendNote`.
- **Day rows**, one per Mon–Fri date of the month in order (plus listed weekend dates), each a `fieldset` with legend `fmt.date`:
  - lunch day: dish fields (editable text inputs, one per item; snack items carry the `review.dish.snack` tag), remove buttons, `review.dish.add` (disabled at 12 with `review.dish.addLimit`), ingredients line (`review.ingredients*`), allergen line (`review.allergens*`), notes as printed, `review.noLunch.toggle`.
  - no-lunch day: `review.day.noLunch` label + reason radio (`review.noLunch.reason` with 4 options) + `review.noLunch.text` input + `review.noLunch.restore` + `review.noLunch.hiddenDishes` when dishes were hidden.
  - weekday without entry: `review.day.empty` + `review.dish.add` + `review.noLunch.toggle`.
- `review.outOfMonth.title` disclosure (collapsed) listing out-of-month entries, read-only.
- Sticky footer: `review.confirm` primary.

**Uncertain field** (any field or day whose `verification.status = uncertain`):

| Part | Treatment |
|---|---|
| Field | `warning-soft` fill, 2 px `warning` border (7.08:1), value in `ink-1` |
| Tag | `review.uncertain.tag` 「要確認」 tag with triangle icon, before the field (icon + text: not colour only, US-E3-01/AC2) |
| Reason | line under the field: `review.reason.*` (weekday mismatch shows the printed weekday) |
| Actions | edit the value (→ `parent-edited`, the flag clears) or press the `review.accept` text button (→ `uncertain-accepted`). Either way the tag and the warning styling disappear and the summary count drops by 1 |
| Ambiguity | for `ambiguous-term`: chooser `amb.title` with radio options (`amb.curry.*`, dictionary labels for other groups, `amb.unsure`) |
| Day-level (weekday mismatch, duplicate date) | the whole day row gets the warning border and the tag next to the legend |
| Weekday mismatch: two answers | the reason line `review.reason.weekdayMismatch` is followed by **two** actions in one row (wrapping at 360 px): secondary small button `review.dateFix.open` 「日付を直す」 (opens §6.9) and text button `review.accept` 「このままにする」 (the date is right, the printed weekday was the mistake). Both clear the flag; together they satisfy "confirm or correct the date" (US-E2-05/AC5). Only rows flagged `weekday-mismatch` (and rows already corrected, AC10) get 「日付を直す」; no-lunch days and unflagged days never do (AC7) |
| Corrected day (after §6.9) | no warning styling (`parent-edited`); `ink-2` line under the legend `review.dateFix.printed` 「献立表の表記：4日（木）」 (US-E2-05/AC9) + 「日付を直す」 still offered (AC10) |
| a11y | field `aria-describedby` = reason id; `aria-invalid` is **not** used (it isn't an error) |

| State (row / field) | Treatment |
|---|---|
| default | `surface-2` rows, 1 px `line-1` separators |
| hover / focus-visible / active | per input/button |
| disabled | 料理を追加 at 12 items (dashed + hint); 確定 when manual and empty (`review.confirm.emptyManual`) or with dish errors (`review.confirm.hasErrors`) |
| loading | confirm busy while writing |
| error | dish 0 or > 40 chars: field error `review.dish.error` (US-E3-02/AC4) |
| empty | manual entry: every Mon–Fri date with `review.day.empty` (US-E3-04/AC1) |
| uncertain | above |
| parent-edited | no marker (the parent's own value); screen readers get nothing extra |

Confirm with uncertain fields left → dialog `review.uncertainDialog.*` (§11). Confirm success → toast `review.done`; first menu → calendar of that month; refresh → needs-review list (§7) if non-empty, else the calendar.
Leaving the review (back) → dialog `review.leave.*`; the extraction stays pending (`menuCard.pending`).

| | 390 | ≥ 1280 |
|---|---|---|
| Rows | stacked cards, dish inputs full width | table-like rows: date column 140 px, dishes column, side column (ingredients, allergens, notes) 320 px |
| PDF | `review.openPdf` opens a new view/tab | opens in a split view (PDF left 50 %, review right) when space allows |

Test ids: `screen-review`, `review-summary`, `review-next-uncertain`, `review-open-pdf`, `review-day-<date>`, `review-dish-<date>-<i>`, `review-dish-<date>-<i>-uncertain`, `review-accept-<fieldId>`, `review-fixdate-<date>`, `review-printed-<date>`, `review-add-<date>`, `review-nolunch-<date>`, `review-out-of-month`, `review-confirm`. Stories: US-E3-01/AC1–AC3, US-E3-02/AC1–AC5, US-E3-03/AC1–AC3, US-E3-04/AC1–AC2, US-E2-04/AC2–AC5, US-E2-05/AC4–AC6, US-E2-07/AC1, US-E4-01/AC6.

### 6.9 Date-correction picker (review → 「日付を直す」)
Added 2026-10-25 (M2 prep) for US-E2-05/AC5, AC7–AC10 and contract §3.3 rule `review-date-correction`. Works on the **review draft only**: nothing is stored until 「この内容で確定」; 「中断する」 discards corrections with every other edit (AC10).
**Rule (BA):** offered only on a lunch day whose day-level flag is `uncertain` / `weekday-mismatch`, or on a day already corrected this way (AC10: it can be corrected again). The new date is any **free** date of the target month: a date that shows no dish and is not marked 給食なし on the review at that moment. **A taken date is shown but cannot be chosen; nothing is ever overwritten, merged or swapped** (AC8). No-lunch days and unflagged days have no 「日付を直す」 (AC7).

**Container**

| | 390 (and < 768) | 768–1279 | ≥ 1280 |
|---|---|---|---|
| Form | bottom sheet (§1.12), height = content (max: top at `--sheet-offset`), `surface-2` | centred dialog, max 400 px | **popover** anchored under the 「日付を直す」 button, 344 px wide, `surface-2`, `radius-lg`, `elevation-3`, no scrim; flips above the button when there are < 480 px below it |
| Gutters | 16 px, so 7 columns of 44 px fit at 360 px: (360 − 32 − 6 × 2 gaps) / 7 = 45.1 | 20 px | 16 px |

ARIA: `role="dialog"`, `aria-modal="true"` in every form (the popover too: focus is trapped, a click outside = cancel), `aria-labelledby` = title, `aria-describedby` = context line.

**Anatomy**, top to bottom:
1. Header: title `review.dateFix.title` (h2, `text-lg`) + close icon button (44 px, `common.close`).
2. Context line (`text-sm`, `ink-2`): `review.dateFix.context` 「献立表では「4日（木）」です。いまは11月4日（水）になっています。」; when `printedDateText` is null, `review.dateFix.contextWeekday` (printed weekday only). Printed text carries `lang="ja"` in EN.
3. Month caption `fmt.month` (`text-md` 700, centred, `aria-hidden`: the grid label says it). **No month navigation**: only dates of the target month can be chosen (AC7; other months are never imported, AC4). Past dates of the month are offered (AC7 note, OQ-28).
4. Mini-grid (below), `aria-label` = `review.dateFix.gridLabel`.
5. Legend, visible text (`text-xs`, `ink-2`), each item drawn with its marker: bar + `review.dateFix.cell.match` 「曜日が一致」 · dot + `review.dateFix.cell.taken` 「ほかの献立があります」 · dashed box + `review.dateFix.cell.current` 「いまの日付」.
6. Status line (`role="status"`, polite, `text-sm` 700), the visible text of the last cell activated:
   - free date selected: `review.dateFix.selected` 「11月5日（木）に移します」, plus, if its weekday is not the printed one, an info line (info icon + `review.dateFix.otherWeekday`): allowed, it is the parent's call (AC7: other free dates can be chosen).
   - taken or current date activated: `review.dateFix.cantChoose` 「11月12日（木）は選べません：ほかの献立があります」 (reason = the cell's `taken` or `current` text). Selection does not change.
   - no free date in the month: `review.dateFix.noFree` 「移せる日がありません」 shown on open, grid still shown (every cell disabled), apply hidden, only 「閉じる」/`common.cancel`; 「このままにする」 stays on the row (AC8).
7. Footer: secondary `common.cancel` · primary `review.dateFix.apply` 「この日にする」 (stacked full width at 390, primary on top; inline right-aligned on desktop). `aria-disabled` until a free date is selected, hint `review.dateFix.applyHint` linked by `aria-describedby`.

**Mini-grid cell** (one per date; leading/trailing pad cells are empty `gridcell`s with `aria-hidden`):

| Part / state | Treatment | Non-colour signal |
|---|---|---|
| Box | 44 × 44 at ≥ 360 px viewport (40 × 40 allowed below 360, still ≥ 24 px WCAG 2.2), `radius-sm`, `surface-2`, no border; numeral `text-md` 700 tabular, centred; Sat `saturday`, Sun/holiday `sunday`, else `ink-1` | — |
| Weekday header | `wd.short.*`, `text-xs` 700, order from the store field `settings.weekStartsOn` (as the calendar, §2.3); `columnheader` with the long weekday as `aria-label`, so every date is announced with its weekday (AC7) | — |
| **match** (weekday = printed weekday; free or taken) | 3 × 16 px bar under the numeral, `ink-1` (U04) | bar + 「曜日が一致」 in the accessible name and legend |
| **taken** (the review shows ≥ 1 dish or 給食なし on that date) | 6 px dot top-right `ink-2` (U19) + numeral `ink-3` (P08), `aria-disabled="true"`, focusable; activation only updates the status line | dot + 「ほかの献立があります」 in the accessible name, legend and status line |
| **current** (the day's date now) | 2 px dashed `line-ui` border (U02), numeral `ink-3` (P08), `aria-disabled="true"`, focusable | dashed border + 「いまの日付」 in the accessible name, legend and status line |
| hover | `surface-3` fill (free cells only) | — |
| focus-visible | ring + halo (global), on every cell including disabled ones | ring |
| active | `surface-3` (free cells) | — |
| **selected** | `navy-fill` + `ink-inverse` numeral and bar (P10), `aria-selected="true"`; only free cells can be selected | fill + status line text |
| disabled | taken and current (above); all cells when no date is free | as above |
| loading / error / empty | n/a: local draft data, nothing can fail before apply; "empty" = no free date (status line `review.dateFix.noFree`) | — |

Accessible name of a cell button = `fmt.date` + suffixes in the order match, taken, current, joined with 「、」 / ", " (e.g. 「11月12日（木）、曜日が一致、ほかの献立があります」). Matches are never preselected (AC7).

Initial focus: the **nearest free match cell** to the current date (the likely answer, e.g. 4 (Wed) → 5 (Thu)); else the nearest free cell; else (no free date) the status line's `noFree` text (`tabindex="-1"`).

Keyboard (ARIA APG date-picker grid, one month): ←/→ previous/next day; ↑/↓ same weekday previous/next week; Home/End first/last day of the row; PageUp/PageDown do nothing; arrows stop at the first/last date of the month; Enter/Space select a free cell (does not apply) or announce why a disabled one can't be chosen; Tab: close → grid (one tab stop, roving tabindex) → cancel → apply; Esc = cancel. Closing without choosing changes nothing (AC10); focus returns to the 「日付を直す」 button.

**Apply:** the container closes; the whole day (dishes, ingredients, allergen line, notes) moves to the chosen date and the rows re-sort into date order; the old date shows `review.day.empty` (weekday) or disappears (unlisted weekend). The day becomes `parent-edited`, loses the 「要確認」 tag and warning styling, and the summary count drops by 1; field-level flags inside the day (e.g. low legibility on a dish) stay (AC7). Focus moves to the moved row's legend (`tabindex="-1"`); polite live `review.dateFix.moved`.

**Corrected row (review screen, after apply):** no warning styling; under the legend a `ink-2` line `review.dateFix.printed` 「献立表の表記：4日（木）」 (`lang="ja"` on the printed text in EN; AC9) and the secondary small button `review.dateFix.open` still offered, so the parent can move it again, including back to its original date (AC10: the flag does not come back). There is no separate undo.

**Chained shifts.** Because taken dates can't be chosen, a whole week printed one day off is fixed from its free end (e.g. move Friday to the free Saturday/next free weekday first). The legend makes this discoverable; the BA's rule accepts it (no swap).

**States summary (container):** default (nothing selected); hover/focus-visible/active per control; disabled (apply until a free date is selected; taken and current cells); loading n/a (synchronous draft edit); error n/a (nothing is written here; a failed write can only happen on 「この内容で確定」, which keeps `toast.saveFailed`); empty = no free date (`review.dateFix.noFree`).

Test ids: `datefix-sheet` (also on the popover), `datefix-close`, `datefix-cell-<date>`, `datefix-status`, `datefix-apply`, `datefix-cancel`, `datefix-nofree`; on the review row `review-fixdate-<date>`, `review-printed-<date>`. Stories: US-E2-05/AC5, AC7, AC8, AC9, AC10; US-E3-01/AC1–AC2 (rows in date order, summary count); US-E3-03/AC4–AC5; US-NF-02/AC3.

---

## 7. Refresh review list (「確認が必要な日」)
Shown after confirming a replacement menu when the list is non-empty. **Reachable again while any listed date still has an open needs-review flag** (Orchestrator ruling, M2 prep: derived from stored data, **no new stored field**; a date is open while its calendar cell would show the needs-review badge, §2.4 layer 4): settings 献立表 section shows the link `settings.menu.needsReview` 「確認が必要な日（2件）」 (count = open dates) and the calendar's needs-review badges stay. When every listed date is resolved the link disappears and the route redirects to the calendar. Anatomy: title `refresh.review.title` · lead `refresh.review.lead` · list rows (64 px): date, reason (`refresh.review.item.planned` / `.notConfirmed` / `.override`), sub-line (`refresh.review.item.removed` / `.nowNoLunch`, or nothing when only the dishes changed), button `refresh.review.open` (name `refresh.review.openDay`) → that day's sheet over the calendar · footer `refresh.review.done`.
Which dates are listed (US-E3-05/AC9, AC11, AC12; contract `changedDatesSincePrevious`): changed dates that carry an override, a stored `homemade-bento-planned` or a stored `not-confirmed` decision; never school-lunch records. A row whose date is no longer open is marked resolved (check icon + `refresh.review.visited` as visually hidden text) and stays in the list until the list is closed; the list is computed from the latest refresh's `changedDatesSincePrevious` and the current decisions/overrides each time it opens (nothing remembers "opened").
States: default; hover (row `surface-1`); focus-visible; active; disabled n/a; loading n/a; error n/a; empty `refresh.review.empty` (normally not shown: the screen is skipped when empty).
390 list; desktop list max 760 px with the side panel opening to the right. Test ids: `refresh-review`, `refresh-review-row-<date>`. Stories: US-E3-05/AC2, AC6, AC8, AC9, AC11, AC12, BR-13.

---

## 8. Reminders

### 8.1 Reminder banner
Anatomy: card `surface-2`, 2 px `accent` border, 6 px red stripe on the left edge (decorative), bell icon tile (`accent-soft` / `accent-ink`), body, close button (44 px, `reminder.dismissName`). Optional label `reminder.missedAt` (+ `common.japanTime` when the device isn't in Tokyo) for missed or repeated reminders (US-E7-05/AC2, AC4). Debug-triggered banners carry the dev tag `debug.reminders.debugTag`.

| Type | Content | Actions |
|---|---|---|
| Day-before | title `reminder.dayBefore` · recipe name (`reminder.dayBefore.recipe`) · if the planned recipe now conflicts with an allergy: danger row `day.recipeAllergen` (US-E1-05/AC2) | `reminder.dayBefore.cta` (primary small) → recipe detail; missing recipe → day sheet (US-E7-02/AC2) |
| Weekly | title `reminder.weekly.title` · item list: `reminder.weekly.low` + `reminder.weekly.plan`, `reminder.weekly.notConfirmed` + plan, `reminder.weekly.planned`; or `reminder.weekly.none`; `reminder.weekly.noMenuMonth` line for uncovered month days; or `reminder.weekly.noMenu` + `reminder.weekly.import` | `reminder.weekly.plan` per item → day sheet (US-E7-01/AC2) |

States: default; hover (close and actions); focus-visible; active; disabled n/a; loading n/a; error n/a; empty n/a (a banner exists only when a reminder is due). Appears with a 200 ms fade (none with reduced motion); `role="status"` (polite) so it is announced once when it appears; never steals focus.
Dismiss: stores `dismissedAt`; the banner collapses; focus moves to the next banner or the today card heading.
| | 390 | ≥ 1280 |
|---|---|---|
| Width | full column width | left column width (max 760 px) |
Test ids: `reminder-day-before-<date>`, `reminder-weekly-<firstDate>`, `reminder-dismiss`, `reminder-cta`, `reminder-weekly-plan-<date>`. Stories: US-E7-01/AC1–AC5, US-E7-02/AC1–AC2, US-E7-05/AC1–AC4, US-E0-01/AC1, BR-18.

### 8.2 Reminder list (stack)
Region `reminder.region` at the top of the calendar holding all due, undismissed, unexpired reminders, newest first: day-before reminders before the weekly one. Shows the first banner fully; the rest collapse under a disclosure `reminder.more` (`aria-expanded`). Only the most recent unexpired weekly reminder is ever present (US-E7-05/AC3).
States: default (1 shown); expanded; empty (region not rendered); hover/focus/active on the disclosure. Test ids: `reminder-list`, `reminder-more`.

---

## 9. Settings
Screen: top bar (title `settings.title`) · sections as cards with h2:

| Section | Rows | Story |
|---|---|---|
| `settings.reminders` | Row `settings.weekly`: switch + value; when on: `settings.weekly.day` select (日〜土, `wd.long.*`) and time (§9.1); hint `settings.weekly.hint` · Row `settings.dayBefore`: switch + time + hint · times show `common.japanTime` when the device isn't in Tokyo · info box `settings.webLimit` (web build, always visible) | US-E7-04/AC1–AC4, US-E7-06/AC1, US-E7-07/AC2 |
| `settings.display` | `settings.language` segmented 日本語 / English · `settings.weekStart` radio (月曜日 default / 日曜日) · `settings.theme` radio (自動 + hint / ライト / ダーク) | US-E8-01/AC2, US-E5-01/AC8, US-E8-05/AC1–AC2 |
| `settings.menu` | `settings.menu.url` read-only (or `settings.menu.urlNone`) · `settings.menu.import` secondary · `settings.menu.review` secondary · `settings.menu.promptDay` select (1–28, `settings.menu.promptDay.value`) | US-E2-01/AC4, US-E3-05, US-E3-06/AC2 |
| `settings.profile` | `settings.profile.edit` secondary · `settings.profile.delete` destructive-text | US-E1-05, US-E1-06/AC1 |
| `settings.data` | note `settings.data.where` · `data.export` secondary (disabled with `data.export.empty` when nothing is stored) · `data.import` text (Could) · `data.deleteAll` destructive-text | US-E10-03, US-E10-04 |
| `settings.about` | `settings.about.consent` link · `settings.about.version` | US-E2-08 |

Every change saves immediately (no save button) and announces `settings.saved` (polite). Changing reminder times never re-shows a reminder already shown (US-E7-04/AC2).

### 9.1 Time picker (15-minute steps)
Fieldset `settings.time.group` with two selects: `settings.time.hour` (00–23) and `settings.time.minute` (00, 15, 30, 45). Displayed value `HH:MM`. No free typing, so 「24:00」 or 「17:31」 can't be entered (US-E7-04/AC3; stored invalid values are replaced by the default by validation). When the row's switch is off, the selects are disabled (dashed) and the value stays visible.
States: default; hover/focus/active per select; disabled (switch off); loading n/a; error n/a (constrained); empty n/a (always a value).

| | 390 | ≥ 1280 |
|---|---|---|
| Layout | one column of cards; selects side by side (hour, minute) | two columns of cards (reminders + display left; menu, profile, data, about right), max 1040 px |

Screen states: default; loading n/a; error (storage write fails → danger banner `storage.unavailable`, the control reverts); empty n/a.
Test ids: `screen-settings`, `switch-weekly`, `select-weekly-day`, `select-weekly-hour`, `select-weekly-minute`, `switch-day-before`, `select-day-before-hour`, `select-day-before-minute`, `settings-web-limit`, `settings-language`, `radio-week-start-monday`, `radio-week-start-sunday`, `radio-theme-auto|light|dark`, `settings-menu-url`, `settings-menu-import`, `settings-menu-review`, `select-prompt-day`, `settings-profile-edit`, `settings-profile-delete`, `data-export`, `data-import`, `data-delete-all`.

---

## 10. Share sheet
Trigger: `share.button` (secondary, block, share icon) under the calendar legend. Opens a bottom sheet (dialog on desktop): title `share.sheet.title` · label `share.sheet.preview` · read-only preview of the exact text (monospace-free: body font, `surface-3` box, `white-space: pre-wrap`, selectable) · notes `share.sheet.note` (US-E9-02/AC2) and `share.sheet.privacy` · actions `share.sheet.share` (primary; hidden when `navigator.share` doesn't exist) and `share.sheet.copy` (secondary).
Behaviour: share → OS sheet; if rejected/unavailable → copy → toast `share.copied` (US-E9-01/AC2); if the clipboard is blocked → `share.copyFailed` inline and the preview text is selected for manual copy.
The text is built only from dates, decision labels, recipe names and fixed lines (`share.text.*`, BR-21); the week is the 7 days from tomorrow (same as US-E9-01/AC1 example), independent of `weekStartsOn` (US-E5-01/AC8).
States: default; hover/focus/active on buttons; loading n/a; disabled n/a; error (`share.copyFailed`); empty (text uses `share.text.empty`, US-E9-01/AC3).
Test ids: `share-button`, `share-sheet`, `share-preview`, `share-native`, `share-copy`. Stories: US-E9-01/AC1–AC3, US-E9-02/AC1–AC2.

---

## 11. Confirm dialogs (catalogue)

| Dialog | Trigger | Title / body keys | Actions (initial focus first) | Role | Story |
|---|---|---|---|---|---|
| Back to school lunch | 給食に戻す on a planned school day | `day.cancel.title` / `day.cancel.body` | `common.cancel` · `day.cancel.confirm` (destructive) | alertdialog | US-E5-06/AC2–AC3 |
| Remove plan | 計画を取り消す (bento day, refresh conflict) | `day.clear.title` / `day.clear.body` | `common.cancel` · `day.clear.confirm` | alertdialog | US-E5-08/AC3, US-E3-05/AC7 |
| Uncertain fields left | この内容で確定 with uncertain fields | `review.uncertainDialog.title` | `review.uncertainDialog.back` · `review.uncertainDialog.confirm` (primary) | dialog | US-E3-03/AC2 |
| Leave review | back from review | `review.leave.title` / `review.leave.body` | `review.leave.stay` · `review.leave.confirm` | dialog | US-E3-05/AC5 |
| Replace menu | import for a month that has a confirmed menu | `import.replace.title` / `import.replace.body` | `common.cancel` · `import.replace.confirm` (primary) | dialog | US-E3-05/AC4 |
| AI consent | first import / new notice version | §6.7 | `consent.decline` · `consent.accept` | dialog | US-E2-08 |
| Discard profile edits | leaving edit with changes | `profileEdit.discard.title` | `profileEdit.discard.stay` · `profileEdit.discard.confirm` | alertdialog | US-E1-05/AC3 |
| Delete profile | プロフィールを削除 | `profileDelete.title` / `profileDelete.body` | `profileDelete.cancel` · `profileDelete.confirm` | alertdialog | US-E1-06/AC1 |
| **Delete all data** | すべてのデータを削除 | `data.deleteAll.title` / `data.deleteAll.body` | `data.deleteAll.cancel` · `data.deleteAll.confirm` (destructive; one confirmation, BR-22) | alertdialog | US-E10-04/AC1–AC2 |
| Import data (Could) | データを読み込む after a file is chosen | `data.import.title` / `data.import.body` | `common.cancel` · `data.import.confirm` | alertdialog | US-E10-03/AC3 |
| Start over (corrupt store) | 初期化する | `storage.corrupt.resetTitle` / `storage.corrupt.resetBody` | `common.cancel` · `storage.corrupt.reset` | alertdialog | US-E10-02/AC4 |
| Clear test data (dev) | テストデータを消去 | `debug.data.clearConfirm` | `common.cancel` · `debug.data.clearYes` | alertdialog (debug skin) | US-E11-03/AC3 |

States for all: as §1.13. On 「削除する」 for delete-all: every BentoMinder key is removed and the app returns to onboarding step 1 in Japanese (US-E10-04/AC1). Test ids: `dialog-<name>`, `dialog-<name>-confirm`, `dialog-<name>-cancel` with names `cancel-plan`, `clear-plan`, `uncertain`, `leave-review`, `replace-menu`, `discard-profile`, `delete-profile`, `delete-all`, `import-data`, `reset-store`, `debug-clear`.

---

## 12. Recovery and system states
- **Storage unavailable banner** (danger, persistent at the top of every screen until a write succeeds): `storage.unavailable` + `storage.unavailable.body`. Any "saved" toast is suppressed (US-E10-02/AC5).
- **Newer data screen** (full screen, no app bar actions except the language toggle): `storage.newer` + `storage.newer.body` + `data.export` primary. Writes nothing (US-E10-02/AC3).
- **Corrupt store screen**: `storage.corrupt.title` + `storage.corrupt.body` + `storage.corrupt.export` (primary) + `storage.corrupt.reset` (destructive-text → dialog) (US-E10-02/AC4).
- **Migrated** toast `storage.migrated` once (US-E10-02/AC2).
- **Not found** page: `notFound.title` + `notFound.back` (also `/debug` in production, US-E11-01/AC2).
States: default; hover/focus/active on actions; others n/a. Test ids: `banner-storage`, `screen-newer-data`, `screen-corrupt-data`, `screen-not-found`.

---

## 13. Debug panel (development builds only)
Must look unmistakably **not** like the product (US-E11-01, BR-24):
- Entry: 「Debug」 pill (`debug.open`) fixed bottom-left, 44 px, `debug-accent` fill with `debug-surface` text (9.39:1), monospace font, `z-debug`.
- Panel: right-side drawer 360 px (full screen on 390), `debug-surface` background, `debug-ink` text, **diagonal `--debug-hatch` band** 8 px along its top and left edge, monospace, square corners (no `radius-*`), title `debug.title`, `data-marker="BM_DEBUG_PANEL"`.
- Sections: `debug.clock` (status `debug.clock.now` + `debug.clock.simulated` badge, datetime-local input, `debug.clock.set`, `+1分`, `+1時間`, `+1日`, `debug.clock.real`) · `debug.reminders` (`debug.reminders.weekly`, `debug.reminders.dayBefore`, `debug.reminders.force`) · `debug.samples` (`debug.samples.profile`, `debug.samples.menu`) · `debug.ai` select (`debug.ai.off` + the 6 mode ids) + `debug.ai.usage` · `debug.data` (tables `debug.data.decisions`, `debug.data.overrides`, read-only; `debug.data.empty`; `debug.data.clear` → dialog).
- Controls inside use `debug-accent` 2 px borders on `debug-surface`, focus ring `debug-accent` 2 px (9.39:1).
States: default; hover (control fill `debug-accent` at full, text `debug-surface`); focus-visible; active; disabled (dashed `debug-accent`); loading n/a; error (invalid datetime: text line in `debug-ink` with "!" prefix); empty (`debug.data.empty`).
Never rendered, imported or present as strings in production builds (the module and its `debug` catalog are excluded at build time).
Test ids: `debug-open`, `debug-panel`, `debug-clock-input`, `debug-clock-set`, `debug-clock-plus-minute`, `debug-clock-real`, `debug-trigger-weekly`, `debug-trigger-day-before`, `debug-force`, `debug-sample-profile`, `debug-sample-menu`, `debug-ai-mode`, `debug-ai-usage`, `debug-decisions`, `debug-overrides`, `debug-clear`. Stories: US-E11-01/AC1–AC2, US-E11-02/AC1–AC3, US-E11-03/AC1–AC3, US-E2-07/AC3, US-E7-05/AC1.

---

## 14. Coverage summary

| Group | Components | Each with the 8 base states + selected where applicable |
|---|---|---|
| Foundations | 16 (app bar, top bar, buttons ×6 variants, text input, select, chip, segmented, checkbox/switch, radio/choice card, banner ×4, toast, sheet/panel, dialog, empty state, stepper, loading) | yes |
| Calendar | 8 (layout, month nav, grid/agenda, cell, upcoming, today card, menu cards, legend) | yes; cell: 5 assessment × 4 decision × 9 overlays |
| Day sheet | 3 (structure, assessment + override, plan actions: 11 state rows) | yes |
| Recommendations | 3 (screen, card with 4 domain states, more list) | yes |
| Recipes | 3 (detail with 6 contexts, library, plan-date picker) | yes |
| Onboarding / import | 9 (frame, profile, food picker with kind groups, allergy, menu source + 15-row error table, progress, consent, review with uncertain states, date-correction picker) | yes |
| Refresh review | 1 | yes |
| Reminders | 2 (banner ×2 types, list) | yes |
| Settings | 2 (screen, time picker) | yes |
| Share | 1 | yes |
| Dialogs | 12 confirm dialogs | yes |
| System | 5 (storage banner, newer, corrupt, migrated, not found) | yes |
| Debug | 2 (pill, panel) | yes |
