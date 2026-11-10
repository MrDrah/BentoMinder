# UI refresh 2026-11: ready-for-dev notes

> For the developer. Spec: `design/components.md` §17. Copy: `design/copy.md` §23. Flow: `design/flows.md` §23. Tokens: `design/tokens.json` / `tokens.css` (three cell-height values, nothing else). Before screenshots (current app, fake-auth e2e build, fixture `m2-november.json`, date 2026-11-02): `docs/dev/_scratch/ui-refresh/before/` (390 × 844 = `-sp`, 1280 × 800 = `-pc`; also `home-sp320`, `home-tab`). Script: `docs/dev/_scratch/ui-refresh/shoot.mjs` (re-run it after the build for the "after" set: `node docs/dev/_scratch/ui-refresh/shoot.mjs <outDir>` with `npm run preview` on :4173; the `review` shot falls back to import when no review is pending).
> Scope guard: **no rule, string meaning, state or test id changes.** Existing `data-testid`s stay; three are added (`about-toggle`, `about-panel`, `about-close`).

## 1. Order of work (each step ends in a green targeted test)
1. Tokens: take `design/tokens.css` values (`--cell-min-height` 80 px, new `--cell-min-height-md` 96 px, `--cell-min-height-lg` 104 px). Add the five rhythm aliases to `global.css` (§2).
2. Page container + cards: gap-based rhythm, `--card-pad`, `max-width: 36em` for text (all screens at once; low risk).
3. Calendar home: reorder, grid sizes, Today card compact, tools row, legend closed by default.
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
.cell__btn { padding: 6px; }
.cell.is-suggest .cell__btn, .cell.is-notConfirmed .cell__btn { padding: 4px; }   /* border is 2px: keep the content box identical */
.cell__num { font-size: var(--text-md); font-weight: var(--weight-bold); }
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
- Unit `tests/unit/ui/calendar.test.tsx` and `shell.test.tsx`: any assertion that relies on the DOM order inside `main` (Today card before the month nav), `anyPlanned` on `Legend`, or the legend being expanded when nothing is planned.
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
