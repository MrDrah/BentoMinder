# UI refresh 2026-11: ready-for-dev notes

> For the developer. Spec: `design/components.md` §17. Copy: `design/copy.md` §23. Flow: `design/flows.md` §23. Tokens: `design/tokens.json` / `tokens.css` (three cell-height values, nothing else). Before screenshots (current app, fake-auth e2e build, fixture `m2-november.json`, date 2026-11-02): `docs/dev/_scratch/ui-refresh/before/` (390 × 844 = `-sp`, 1280 × 800 = `-pc`; also `home-sp320`, `home-tab`). Script: `docs/dev/_scratch/ui-refresh/shoot.mjs` (re-run it after the build for the "after" set: `node docs/dev/_scratch/ui-refresh/shoot.mjs <outDir>` with `npm run preview` on :4173; the `review` shot falls back to import when no review is pending).
> **2026-11-10: the calendar day tile is redesigned (PO, PLAN §7 last row). Read §3a first: it supersedes the cell content and colour rules in §3 and in components §2.4 / §17.4 (the assessment glyph and the recipe name on the tile are gone). The Today card is below the calendar, as §3 already says.**
> Scope guard: **no rule, string meaning, state or test id changes.** Existing `data-testid`s stay; three are added (`about-toggle`, `about-panel`, `about-close`).

## 1. Order of work (each step ends in a green targeted test)
1. Tokens: take `design/tokens.css` values (`--cell-min-height` 80 px, new `--cell-min-height-md` 96 px, `--cell-min-height-lg` 104 px). Add the five rhythm aliases to `global.css` (§2).
2. Page container + cards: gap-based rhythm, `--card-pad`, `max-width: 36em` for text (all screens at once; low risk).
3. Calendar home: reorder, grid sizes, Today card compact, tools row, legend closed by default.
3a. Day tile (§3a): `TileIcon`, new `DayCell` content, the `.cell*` CSS, `cellLabel`, the legend rows, copy keys. Do it right after step 3 (one slice ending in green unit tests for icon / dash / changed / tomorrow / name).
4. Brand-info disclosure (new component, `Icon` needs a new `info` glyph).
5. Sticky action bar (import, onboarding, review, profile, day sheet primary).
6. Login and new-device layout, then settings/family spacing, recommend/recipe/library.
7. Run the e2e at 390 and 1280, axe, the 320 px no-horizontal-scroll check, update tests (§6).

## 2. Global CSS (`src/ui/styles/global.css`)
```css
:root {
  --page-gutter: var(--space-5);
  --rhythm-block: var(--space-6);
  --rhythm-section: var(--space-10);
  --rhythm-related: var(--space-3);
  --card-pad: var(--space-5);
}
@media (min-width: 768px) {
  :root { --page-gutter: var(--space-6); --rhythm-block: var(--space-8); --rhythm-section: var(--space-12); --card-pad: var(--space-6); }
}
@media (min-width: 1280px) {
  :root { --rhythm-block: var(--space-10); --rhythm-section: var(--space-16); --rhythm-related: var(--space-4); }
}
.page { display: grid; gap: var(--rhythm-block); padding: var(--space-6) var(--page-gutter) max(var(--space-10), env(safe-area-inset-bottom)); align-content: start; }
.card { padding: var(--card-pad); margin-bottom: 0; }          /* spacing now comes from .page gap */
.card__title { margin-bottom: var(--rhythm-related); }
.card__body, .note, .page p { max-width: 36em; }
@media (min-width: 768px) { .page { max-width: var(--content-max); } }
```
- `.page` currently stacks children with `.card { margin-bottom }`. Switching to `gap` means every screen that places cards directly inside `.page` is fixed at once; check screens that wrap cards in extra divs (settings, recommend, family) and give the wrapper the same `display: grid; gap`.
- Unchanged: `.appbar`, `.topbar` sizes, `--stripe-band`, safe-area top inset (`viewport-fit=cover` is already set in `index.html`; add `padding-top: env(safe-area-inset-top)` to `.appbar` and `.topbar`).
- Buttons stacked in `.import__actions, .text-actions, .footer-actions, .stack`: `gap: var(--space-3)` (was `--space-2`). Form fields (`.field` in `forms.css`): 20 px between fields.
- Never hide horizontal overflow to pass the 320 px check; if something overflows, fix the element (`min-width: 0`, wrap).

## 3. Calendar home
Files: `src/ui/screens/CalendarScreen.tsx`, `src/ui/styles/calendar.css`, `src/ui/calendar/Upcoming.tsx` (legend), `TodayCard.tsx`.

**Order in JSX** (replaces the current order): `<ReminderList/>`, storage banners, `card-menu-pending`, `menu-card-missing` inside one `<div className="cal-alerts">` (grid, gap 12 px, `margin-bottom: var(--space-4)`; renders nothing when empty) → `monthnav` → `.cal` → `<div className="cal-below">` containing `TodayCard`, `UpcomingSummaryCard`, `card-menu-next`, `.cal-tools` (share + legend toggle) and the legend body. `.cal-below { display: grid; gap: var(--rhythm-block); margin-top: var(--rhythm-section); }`. Keep the `ShareSheet` where it is (it renders the button; the tools row only needs it to be inline: give its wrapper `flex: 1 1 auto`).

**Grid** (`calendar.css`):
```css
.cal { margin: 0 calc(-1 * var(--space-4)); }           /* 20 px gutter -> 4 px at 390 */
.cal-grid, .cal-row, .cal-head { gap: 2px; }
.cell { min-height: var(--cell-min-height); }            /* 80 */
/* SUPERSEDED by §3a (day tile redesign): cell__btn padding, is-suggest / is-notConfirmed padding and cell__num. Use §3a. */
.cal-wd.is-today-col { box-shadow: inset 0 -2px 0 var(--accent); }                /* new, decorative */
@media (min-width: 768px)  { .cal { margin: 0; } .cal-grid, .cal-row, .cal-head { gap: 4px; } .cell { min-height: var(--cell-min-height-md); } .cell__num { font-size: var(--text-lg); } }
@media (min-width: 1280px) { .cal-grid, .cal-row, .cal-head { gap: 6px; } .cell { min-height: var(--cell-min-height-lg); } }
.cal-row.is-compact .cell, .cell--pad { min-height: var(--cell-row-compact); }     /* stays 44 */
```
Replace the hard-coded 88 px in `global.css` (`@media (min-width: 1280px) .cell`) with the token. Column template `minmax(44px, 0.62fr)` in `CalendarGrid.tsx` is unchanged. The `AGENDA_BELOW_PX` (340) fallback is unchanged. Today column header: add class `is-today-col` when today is in the shown month (`CalendarGrid` already knows `today`).
Page width: `.cal-layout > .page` at 768-1279 `max-width: 640px`; at 1280 `grid-template-columns: minmax(0, 1fr) var(--panel-width); max-width: 1280px`; `.sheet--panel`/`.sheet--empty` `box-shadow: var(--elevation-2)`, empty panel `border: 0; background: var(--surface-2)`.

**Month nav:** `.monthnav { margin: var(--space-2) 0 var(--space-2); flex-wrap: nowrap; }`, `.iconbtn` inside it 48 × 48, 「今日」 `margin-left: auto`; the h2 `flex: 1; text-align: center` from 768, left-aligned (after the prev chevron) on phones as now.

**Today card:** headline `--text-xl`; tile 40 px; at < 768 the `info` note (`day.reservation.note`) drops its fill: `.today .note { background: none; padding: 0; color: var(--ink-2); font-size: var(--text-sm); }` (check the actual class in `TodayCard.tsx`). **Upcoming:** rows `gap` 12 px.

**Legend:** in `Legend`, `expanded = open ?? false` (remove `!anyPlanned`; the `anyPlanned` prop can be deleted; the unit test that passes it needs updating). Move the `legend__toggle` button into `.cal-tools` next to the share button; the body (`#legend-body`) renders below the row as a `.card`. `aria-expanded`/`aria-controls` stay.

**What stays lazy / unchanged:** day sheet code (`DaySheet.tsx`), `ShareSheet` internals, `Agenda`, reminders logic, all domain code, i18n loading, the sync chunk. No new dependency. JS budget: the disclosure is about 1 KB; no budget issue.

## 3a. Day tile redesign (2026-11-10; supersedes every cell-content and cell-colour rule above and in components §2.4 / §17.4)

> Spec: `design/components.md` §18. Copy: `design/copy.md` §24. A11y and contrast: `design/a11y-responsive.md` §6, §12.2. Rules: BA `docs/ba/user-stories.md` US-E5-01/AC3-AC4, AC9-AC15 (PLAN §7 last row). Preview: `design/preview/index.html` slot (h). Screens: `docs/dev/_scratch/ui-refresh/after-design/`.
> **Superseded in this file:** the `.cell__btn` padding, the `.cell.is-suggest` / `.cell.is-notConfirmed` padding and the `.cell__num` lines of the §3 grid block (tiles use the padding below). The older assessment-mark and recipe-short-name content of the cell lives in components §2.4 and §17.4, both marked superseded. The home order (Today card and everything else below the calendar), row heights, gaps and the month nav of §3 stand.

**Component changes** (`src/ui/calendar/CalendarGrid.tsx`, `src/ui/components/Marks.tsx`, `src/ui/calendar/cell-label.ts`, `CellName.tsx`):
1. Add `TileIcon({ name: 'lunchbox' | 'home-bento' | 'bento-unsure', size })` with the markup of components §18.1 (aria-hidden, `currentColor`).
2. `DayCell` renders, inside the existing `button.cell__btn`: `CellName` (the accessible-name sentence, same mechanism), `span.cell__num` (+ `span.cell__hol` for 「祝」 / 「Hol」), `TileIcon` when the day has one, `span.cell__dash` when the red dash applies. Remove `AssessMark`, `FlagBadge`, `ShortName`, `.cell__body`, `.cell__word`, `.cell__pill`, `.cell__mark` and `BentoIcon` from the tile.
3. Derive from `DayView` (no new domain data except "tomorrow" = today + 1 calendar day in Asia/Tokyo): icon `school` when `displayed.state === 'school-lunch-planned'` on a school day; `home` when `homemade-bento-planned` (with a record) or `type === 'bento-day'` with no stored decision; `unsure` when `not-confirmed` (no conflict); otherwise none. `dash` = `type === 'bento-day'`, no stored decision, `date >= today`. `changed` = an applied override or any stored decision record (BA AC10; dormant cases show nothing).
4. Classes: `has-icon`, `is-today`, `is-tomorrow`, `is-past`, `is-changed`, `has-dash`, `is-selected`, `is-holiday` (existing `is-today`, `is-past`, `is-selected` stay). Data attributes: keep `data-assessment`, `data-decision`, `data-today`, `data-past`, `data-override`; add `data-icon` (`school|home|unsure|none`), `data-dash`, `data-changed`, `data-tomorrow`; drop `data-flag`.
5. `cellLabel` builds the name from copy §24: `cell.aria.tile`, then `cell.aria.allergen` (when the mark shows), then `cell.aria.override`, then one of `cell.aria.isToday | isTomorrow | past`, then `cell.aria.dash`; no-lunch, outside and no-menu keep their existing sentences plus the same suffixes. Delete the assessment and recipe parts.
6. Legend (`Upcoming.tsx` `Legend`): replace the item list with the rows of components §18.7; swatches are `.cell__btn` look-alikes in a `div` (aria-hidden), 40 x 44. Keys in copy §24.2.
7. Today card and upcoming swatches: `TileIcon` instead of `BentoIcon` (components §18.8) unless the PO says otherwise.

**Allergen mark** (components §18.12; BA US-E5-01/AC16): inside `button.cell__btn`, after the icon, render `span.cell__allergen[aria-hidden]` containing the character `!` when the day is displayed school-lunch-planned AND the existing day-sheet allergen predicate (`day-banner-allergen`, US-E1-05/AC2) is true; add class `has-allergen` and `data-allergen="true"`. `FlagBadge` may be reused for it (restyled with the CSS below); needs-review and refresh-conflict stay off the tile. Content budget: a tile contains the number, optional 「祝」, at most one icon, at most one `.cell__allergen`, at most one `.cell__dash`; nothing else.
```css
.cell__allergen { position: absolute; right: 3px; bottom: 3px; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; background: var(--danger-soft); color: var(--danger); border: 1.5px solid var(--danger); display: grid; place-items: center; font-size: var(--text-xs); font-weight: var(--weight-bold); line-height: 1; pointer-events: none; }
@media (min-width: 768px) { .cell__allergen { width: 20px; height: 20px; right: 4px; bottom: 4px; font-size: 13px; } }
```
No state overrides: the mark keeps its colours on today, tomorrow, past, hover, selected (it paints above the ring). Legend sample (40 x 56): 16 px mark, 12 px glyph, `right: 2px; bottom: 2px`.

**CSS** (`src/ui/styles/calendar.css`; replaces the `.cell*` block, keeps the sizes of §3):
```css
.cell { --tile-red: var(--accent); --tile-ink: var(--ink-2); }
.cell__btn { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; min-height: inherit;
  padding: 4px; border: 1px solid transparent; border-radius: var(--radius-cell); background: transparent; color: var(--ink-1);
  font: inherit; text-align: center; cursor: pointer; touch-action: manipulation; }
.cell.has-icon .cell__btn { background: var(--surface-2); border-color: var(--line-1); padding: 5px; }
.cell__top { display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; gap: 2px; min-height: 22px; }
.cell__num { font-family: var(--font-display); font-weight: var(--weight-bold); font-size: var(--text-md); line-height: 22px; font-variant-numeric: tabular-nums; }
.cell.wd-6 .cell__num { color: var(--saturday); }
.cell.wd-0 .cell__num, .cell.is-holiday .cell__num, .cell__hol { color: var(--sunday); }
.cell__hol { font-size: var(--text-xs); font-weight: var(--weight-bold); line-height: 1; }
.cell__icon { width: 24px; height: 24px; margin-top: 8px; color: var(--tile-ink); flex: none; }
.cell.wd-6 .cell__icon, .cell.wd-0 .cell__icon { width: 20px; height: 20px; }            /* the narrow weekend columns */
.cell__dash { position: absolute; left: 50%; bottom: 8px; width: 18px; height: 4px; margin-left: -9px; border-radius: 2px; background: var(--tile-red); }
.cell.wd-6 .cell__dash, .cell.wd-0 .cell__dash { width: 14px; margin-left: -7px; }
.cell.is-changed .cell__btn::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--tile-red); }   /* top bar, clipped by the radius */
.cell.is-past .cell__btn { background: transparent; }                                    /* keeps its 1px line-1 border when it has an icon */
.cell.is-past .cell__num { color: var(--ink-3); }
.cell.is-past.wd-6 .cell__num { color: var(--saturday); }
.cell.is-past.wd-0 .cell__num, .cell.is-past.is-holiday .cell__num { color: var(--sunday); }
.cell.is-past { --tile-ink: var(--ink-3); }
.cell.is-tomorrow .cell__btn { background: var(--surface-2); border: 2px solid var(--ink-1); padding: 4px; }
.cell.is-today { --tile-red: var(--planned-edge); --tile-ink: var(--ink-inverse); }
.cell.is-today .cell__btn { background: var(--navy-fill); border-color: var(--navy-fill); color: var(--ink-inverse); padding: 5px; }
.cell.is-today .cell__num, .cell.is-today .cell__hol { color: var(--ink-inverse); }       /* beats the Sat / Sun / holiday colours */
.cell.is-selected .cell__btn { box-shadow: inset 0 0 0 3px var(--ink-1); }
.cell.is-selected.is-today .cell__btn { box-shadow: inset 0 0 0 3px var(--ink-inverse); }
.cell.is-selected.is-tomorrow .cell__btn { box-shadow: inset 0 0 0 1px var(--surface-2), inset 0 0 0 4px var(--ink-1); }
@media (hover: hover) {
  .cell:not(.is-past):not(.is-today) .cell__btn:hover { background: var(--surface-3); }
  .cell.has-icon:not(.is-past):not(.is-today):not(.is-tomorrow) .cell__btn:hover { border-color: var(--line-ui); }
  .cell.is-today .cell__btn:hover { box-shadow: inset 0 0 0 2px var(--ink-inverse); }
}
.cell:not(.is-past):not(.is-today) .cell__btn:active { background: var(--surface-3); }
@media (min-width: 768px) { .cell__num { font-size: var(--text-lg); } .cell.has-icon .cell__btn { padding: 6px; } .cell.is-tomorrow .cell__btn { padding: 5px; } .cell__dash { width: 24px; margin-left: -12px; } }
@media (min-width: 1280px) { .cell__icon { width: 28px; height: 28px; } .cell.wd-6 .cell__icon, .cell.wd-0 .cell__icon { width: 24px; height: 24px; } .cell__dash { width: 28px; margin-left: -14px; } .cell.is-changed .cell__btn::before { height: 4px; } }
```
Notes. (a) The `::before` top bar and the dash paint above the selected ring (children paint above the box-shadow). (b) A tile without an icon that is neither today nor tomorrow has no fill and no border (number only). (c) `wd-6` / `wd-0` are the existing narrow-column classes; they follow the week-start setting. (d) `overflow: hidden` on the button is only for the top-bar clip; the focus ring must not be clipped: if it is, draw the ring on the parent `.cell` (`outline` with a positive offset) instead. (e) Tomorrow comes from the Tokyo date; the existing midnight check that moves "today" also moves "tomorrow".

**Tile content rules** (components §18.3): `school-lunch-planned` is `lunchbox`; `homemade-bento-planned` is `home-bento`; a bento day with no decision is `home-bento` plus the dash (today or later); `not-confirmed` is `bento-unsure`; everything else is number only.

**Test impact of the tile change** (additions to §6; the BA's ACs changed, so these assertions must be rewritten against them):
- Unit tests of `CalendarGrid`, `cellLabel`, `Marks` (`AssessMark`, `BentoIcon`, `FlagBadge`), `labels.ts` short names, `calendar.test.tsx`, `Legend`: assertions on assessment marks, `cell__word`, recipe short names, `data-flag`, the old name (「苦手かも、給食」) and the old legend rows are obsolete. New: icon per state (`data-icon`); `data-dash` only for a bento day with no decision, today or later; `data-changed` for an override or a stored decision, not for dormant ones; today and tomorrow (next calendar date, across a month end, on a Saturday); name pattern and suffix order from copy §24 in ja and en; a tile contains only the number, 「祝」, one icon, and at most one allergen mark and one dash (content budget, components §18.2). New for AC16: mark present only on a school-lunch day with the alert (name gains 「アレルギーに注意」 / "allergen alert" right after the state; no mark on home, unsure, bento-day, number-only, needs-review or refresh-conflict days); present on past, today and tomorrow tiles; mark and red dash never together; `data-allergen`; the legend has the `legend.allergen` row.
- E2E (`m2-calendar`, the M2/M3 journeys, `m4-reminders`, `e13-*`, `e15-*`): steps that read cell text (「給食」, a recipe name, 「未定」), `data-assessment` as a visual, a badge, or open the legend and read items. Cells are still reached by `cal-cell-<date>`; test ids are unchanged. The greyscale check in `m1-a11y-i18n` should assert icon presence and the name, not mark glyphs.
- `copy-catalog.test.ts`: remove the 18 rows marked SUPERSEDED in copy §8; add the new keys of copy §24 (9 in §24.1 incl. `cell.aria.allergen`; 10 legend keys in §24.2 incl. `legend.allergen`: `legend.intro`, `school`, `home`, `unsure`, `dash`, `allergen`, `changedEdge`, `today`, `tomorrow`, `past`).
- Axe on the home screen in light and dark with the legend open and with a today, tomorrow, changed and dash tile present; target size (`m1-targets`) for the 44 px weekend tile; re-run `docs/dev/_scratch/ui-refresh/shoot.mjs` and compare with `after-design/`; axe with an allergen tile present in light and dark; contrast pairs T27-T31 (`tile-contrast.mjs`, 0 failures).
- Budgets: three inline icons and about 60 lines of CSS replace the mark, badge, word and pill code; net size about neutral.

## 4. Brand-info disclosure
Files: `src/ui/components/Bars.tsx` (AppBar), `src/ui/components/Icon.tsx` (add `info`: path of a circle with an "i", same 24 px grid and stroke style as the others), new `src/ui/components/AboutPanel.tsx` (state `open`, `useId`, Esc handler with `keydown` on the wrapper, click-outside for ≥ 768 via `pointerdown` on `document` only while open, `matchMedia('(min-width: 768px)')` is **not** needed: the same DOM; CSS decides). Props: none (reads `useApp().t`). The consent link reuses the existing consent dialog opener (`SettingsScreen` opens it with `setDialog('consent')`; lift or reuse the same dialog component; if the dialog needs the settings state, link to `#/settings` instead and say so in the report: acceptable fallback). Version string: the same source as `settings.about.version`.
```css
.brand-btn { display: inline-flex; align-items: center; gap: var(--space-2); position: relative; min-width: var(--touch-min); min-height: var(--touch-min); padding: 0 var(--space-1); border: 0; background: none; color: var(--ink-1); font: inherit; cursor: pointer; border-radius: var(--radius-pill); }
.brand-btn__badge { position: absolute; width: 16px; height: 16px; right: 0; bottom: 2px; border-radius: 50%; background: var(--surface-1); color: var(--ink-1); }
.brand-btn[aria-expanded='true'] .brand-btn__badge { background: var(--ink-1); color: var(--ink-inverse); }
@media (min-width: 400px) { .brand-btn__badge { position: static; width: 20px; height: 20px; } }
.about { padding: var(--space-5) var(--page-gutter); background: var(--surface-2); border-bottom: 1px solid var(--line-1); }   /* phones: in flow, pushes the page */
.about[hidden] { display: none; }
@media (min-width: 768px) {
  .about { position: fixed; top: 80px; left: max(var(--space-4), calc((100vw - 1280px) / 2 + var(--space-4))); width: 360px; padding: var(--space-6); background: var(--surface-1); border: 1px solid var(--line-1); border-radius: var(--radius-lg); box-shadow: var(--elevation-2); z-index: calc(var(--z-appbar) + 1); }
}
@media (prefers-reduced-motion: no-preference) { .about:not([hidden]) { animation: about-in 200ms ease-out; } }
```
Structure: `AppBar` returns a fragment: `<header class="appbar">…<button class="brand-btn">…</header><section id="about-panel" class="about" role="region">…</section>`. The panel is a **sibling after the sticky header**, so on phones it sits in the normal flow under the stripe, pushes the grid down and scrolls away with the page; at ≥ 768 the same element is `position: fixed` under the bar (the bar is sticky, so the popover stays attached to it). Fixed positioning is only an approximation of the brand position when the page is scrolled horizontally or zoomed; acceptable. `about-in` is a 200 ms opacity + `max-height` fade; with reduced motion there is no animation at all.
Tests to add: `about-toggle` toggles `aria-expanded`; Esc closes and returns focus; closed on load; 320 px no horizontal scroll; target ≥ 44 × 44; axe on open state.

## 5. Sticky action bar and per-screen notes (all < 768)
```css
.action-bar { position: sticky; bottom: 0; z-index: var(--z-base); display: grid; gap: var(--space-2); padding: var(--space-3) var(--page-gutter) max(var(--space-3), env(safe-area-inset-bottom)); background: var(--surface-1); border-top: 1px solid var(--line-1); }
@media (min-width: 768px) { .action-bar { position: static; padding: 0; border: 0; background: none; } }
```
Wrap the existing `.import__actions / .footer-actions` primary + text buttons in `.action-bar`; the screen container needs `min-height: 100dvh; display: flex; flex-direction: column` with the form `flex: 1`, so a short page still pins the bar to the bottom. Day sheet: `.sheet__body` scrolls, the primary decision button's wrapper is `.action-bar` inside the sheet (`position: sticky; bottom: 0` within the scrolling body).

| Screen (route) | Change at 390 | 768 | 1280 |
|---|---|---|---|
| Home `#/calendar` | §3 | grid 640 px, cells 96 | cells 104, panel 440, empty panel calmer |
| Day sheet `#/day/<date>` | sections 24 px apart, primary decision pinned, `max-height: 85dvh`, header close stays in view | centred dialog as now | side panel `elevation-2`, sections 32 px |
| Import `#/import`, onboarding step 2 | fields 20 px apart, buttons 12 px, `取り込む` in `.action-bar`, AI notice card `--rhythm-block` above | as now at 560 | as now |
| Review `#/review/<YYYY-MM>` | day rows 12 px apart; 「この内容で確定」 in `.action-bar` | as now | as now |
| Onboarding 1 and 3, Profile `#/profile` | fields 20 px; 次へ / 保存 in `.action-bar`; stepper keeps 16 px under the bar | as now | as now |
| Settings `#/settings` (incl. 「アカウント」, 「家族」, sync rows) | cards 24 px apart, fields 20 px, switch rows 56 px, destructive entries separated by 20 px + divider; no sticky bar | cards 32 px apart | centred 560 px (settings does not use the panel layout) |
| Recommend `#/recommend/<date>` | cards 24 px apart, image band 72 px, buttons 12 px | band 120 px | as 768 |
| Recipe `#/recipe/<id>` | sections 24 px; 「この日に決定」 in `.action-bar` when opened with a date | as now | as now |
| Library `#/recipes` | rows 12 px apart, padding 16 | as now | as now |
| Login (signed out) | brand in the top third, button and privacy line pinned to the lower third (`min-height: 100dvh`, `justify-content: space-between`) | centred column 400 px | centred column 400 px, vertically centred |
| Join `#/join`, new-device | same pattern as login (brand top, actions bottom) | centred | centred |
| Refresh review, share sheet, dialogs, recovery screens | spacing aliases only | as now | as now |

## 6. Impact on existing tests (likely updates; none is a behaviour change)
- `tests/e2e/m2-calendar.spec.ts` line ~39: clicks `legend-toggle` before the axe run. With the legend always closed, the click now **opens** it in every fixture (before: only when a bento was planned). Check the assertion that follows; the intent (axe with the legend open) is preserved.
- **(Tile change: the longer list is at the end of §3a.)** Unit `tests/unit/ui/calendar.test.tsx` and `shell.test.tsx`: any assertion that relies on the DOM order inside `main` (Today card before the month nav), `anyPlanned` on `Legend`, or the legend being expanded when nothing is planned.
- `tests/e2e/m4-share-debug.spec.ts` (~line 187): share button `box.x < 40` still holds only if the share button is the first item of the tools row at 390 (it is by design); the test may also scroll to it differently because the button now sits closer to the grid.
- `tests/e2e/qa/m1-targets.spec.ts` and `m1-a11y-i18n.spec.ts` (target sizes, horizontal scroll at 320): re-run; they will also cover the new `about-toggle` (44 × 44) and the sticky bars. `expectNoSeriousAxe` on the home screen with the about panel open is a new check.
- Any test that reads `role="img"` named `BentoMinder` in the app bar (the current logo `span`): the logo becomes decorative inside the new button (`aria-hidden`), the name moves to the button (`about.open`). The unit and e2e greps found none, but QA's selectors in `tests/e2e/qa/*` should be re-checked.
- Tests that click the first visible Today-card control by position or use `scrollIntoViewIfNeeded` assumptions on the home screen (e.g. `e13-*`, `e15-family*`, `m4-reminders`): they use test ids, so they should pass; positional/visual assumptions (`toBeInViewport`) may differ because the grid now fills the first screen and the Today card is lower. Reminders banners are unchanged and still above the grid.
- No snapshot or screenshot tests exist (no `toMatchSnapshot` in `tests/`); `tests/unit/domain/qa/copy-catalog.test.ts` compares the catalog with `copy.md`: add the new `about.*` keys to the catalog in the same change.
- Budgets: CSS/JS budgets in `quality-gate.json` (JS 445 KB gz): the change adds well under 2 KB.
- Cell height token consumers: `grep cell-min-height src/` shows only `calendar.css`; the 88 px literal in `global.css` is replaced by the token.

## 7. Risks
1. **Whole month visible at 390 × 844 depends on the row count.** A 6-row month (week starting Monday, 31 days starting Saturday or Sunday) is 5 × 80 + 44 weekend-only top row + one more row: about 700 px, still above the fold on 844 but not on a 667 px phone (iPhone SE class): there the last row scrolls. Acceptable; the grid is still above everything else.
2. **Weekday cells do not get wider** (the 44 px weekend floor plus 7 columns leaves about 56 px per weekday at 390). Height, type size and padding give the enlargement; width cannot grow without dropping the touch floor.
3. **Today card below the grid** moves the "this morning's plan" a screen lower (Decision D4).
4. **Popover is `position: fixed`** at ≥ 768 (§4); it follows the sticky bar. Check it at 200 % zoom (it must stay inside the viewport: `max-width: calc(100vw - 2 * var(--space-4))`).
5. **Sticky bars + the on-screen keyboard** differ between iOS Safari and Chrome Android; `position: sticky` (not `fixed`) was chosen to keep inputs visible. QA must check at least a real iPhone-size viewport in Playwright with `isMobile` and a manual pass on the PO's phone.
6. The `.page` gap rewrite touches every screen; do step 2 of §1 first and look at all `before/` screens at 390 before moving on.
