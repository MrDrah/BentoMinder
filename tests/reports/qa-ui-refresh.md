# QA report: UI refresh 2026-11 (layout, day tile, allergen mark, buttons)

Independent pass, derived from the stories, design docs and copy named in the brief, not from the developer's reports or tests.
Commit under test: `7326ac4` (Button fix integration). Nothing in `src/`, `design/`, `docs/ba` or `PLAN.md` was changed.
No deploy, no real credentials. Ports 5173, 8787, 4173 and 8788 were free before and after every run (checked with `netstat`, LISTEN only);
every server started by a config was stopped by Playwright; nothing else was listening, so the e2e results are clean.

## Verdict for H4 (UI refresh scope)

**GO with conditions.** 0 open P1, 0 open P2. Two P3 and five P4 defects are open (below); none blocks the refresh. The tile oracle agrees
with the rendered tiles in every cell of the matrix (0 differences). Two existing QA suites were red because of stale or order-sensitive
tests, not product defects; they were fixed (listed under "Test changes"). One existing reflow test (`m1-targets`) stays red because it
found the real defect UIR-D08.

## Counts

| Suite | Command | Result |
|---|---|---|
| New QA unit (oracle vs 13 worked examples of a11y 6; 42 token pairs x 2 themes recomputed from tokens.json) | `npx vitest run tests/unit/qa/ui-refresh` | 101 passed |
| Whole unit suite (added to the default vitest include) | `npx vitest run` | 2873 passed, 2 expected-fail, 2 skipped (pre-existing), 147 files |
| New QA e2e (this pass) | `npx playwright test -c tests/e2e/qa/playwright.uir.config.ts --workers=3` | 380 passed, 2 skipped, 0 failed (22 of the passes are `test.fail` repros of open defects, see below); 4.3 min |
| Existing e2e (developer, tile slice, E15 family) | `npx playwright test` | 196 passed |
| Existing QA e2e M1/M2 etc. | `-c tests/e2e/qa/playwright.qa.config.ts` | first run 833 passed, 25 failed, 10 skipped, 12 did not run (triage below); after the test fixes the touched files e0-journey, m1-a11y-i18n re-run green, m1-targets red (UIR-D08) |
| H4 (e0 journey, perf) | `-c ...h4.config.ts` | 13 passed, 3 failed first run (e0 stale, now fixed; LCP approximation, pre-existing) |
| M3 | `-c ...m3.config.ts` | 56 passed |
| M4 + full journey | `-c ...m4.config.ts` | 74 tests: 5 failed first run; after `npm run build` (dist needed) and the helper fix: 72 passed, 2 failed (full-journey axe, see "Test changes", now fixed in the helper, not re-run in this config) |
| M5 | `-c ...m5.config.ts` | 84 passed |
| E13 | `-c ...e13.config.ts` | 146 passed |
| E15 family (QA) | `-c ...e15.config.ts` | 16 passed; the developer's `e15-family.spec.ts` is inside the 196 above: the family flow and the sync status still work |
| Lint, types | `npm run typecheck`, `npx eslint tests/e2e/qa tests/oracle tests/unit/qa/ui-refresh` | clean |
| Budgets | `node .claude/skills/quality-gate/scripts/validate.mjs budget` | JS 441.0 of 445 KB gzip (4 KB headroom), CSS 18.1 of 50, library 174.9 of 200 |

New files (all mine): `tests/oracle/ui-refresh-tile.ts` (naive oracle, shares no code with `src/`), `tests/unit/qa/ui-refresh/tile-oracle-and-contrast.test.ts`,
`tests/e2e/qa/ui-refresh-{common.ts,screens-data.ts,tile-oracle,layout,screens,a11y,buttons,shots}.spec.ts`, `tests/e2e/qa/playwright.uir.config.ts`.
`vitest.config.ts` got `tests/unit/qa/ui-refresh/**` in the domain project include; `playwright.qa.config.ts` ignores `ui-refresh-*` (own config).

## 1. Tile oracle (US-E5-01/AC1-AC4, AC9-AC16, AC14, US-E4-03/AC8, US-E5-03/AC2, US-E5-05/AC1, US-E6-06/AC1)

The oracle takes a description of each date (kind of day, stored decision incl. DEFER / SET_SCHOOL_LUNCH / MARK_RESERVATION / CONFIRM_RECIPE / CHANGE_RECIPE,
applied or dormant override, allergen alert) and "today", and returns the icon, top bar, dash, tomorrow/today/past, allergen mark and the accessible
name. It was first checked against the 13 worked examples of a11y section 6 and the BA's AC14 example (unit test), then compared with the rendered DOM.
Matrix: 22 November dates (school, bento day, closed, no-lunch, outside the menu, weekend, Saturday with lunch; planned, unsure, school-stored,
reserved, override, dormant record and dormant override; allergen alert, alert that does not match, alert on a planned day) x 9 values of today
(mid month, Saturday->Sunday, bento day is today twice, first of month, last of month -> 1 Dec, previous month -> 1 Nov, all past, all future) x ja and en x light and dark
x 390 and 1280. Per tile it compares: `data-*`, fill, border width and colour, number colour, icon colour and size, top bar colour and height (the `::before`),
dash colour and size, allergen mark fill/glyph/ring/size, row height (44 compact, 80/96/104), touch size, content budget (number, 1 icon, at most 1 mark and 1 dash, no other element,
visible text is only the number), against the colours of `design/tokens.json`. Names are read from Chrome's accessibility engine (CDP `Accessibility.getPartialAXTree`), not from `aria-label`.
**Result: 36 matrix tests pass, 0 differences**; a negative control (a tampered tile) proves the comparison can fail. Also verified: today is the only filled tile; month end (30 Nov today, border on 1 Dec when December is shown);
Tokyo date wins over a Paris and a Los Angeles device (00:30 JST); the fill moves at Tokyo midnight without a reload (clock install + runFor); an override set and cleared through the real UI adds and removes the red border;
a planned recipe missing from the library keeps the tile and the sheet shows the snapshot plus the missing-recipe line.
The en tile name uses the design table's date format ("Wed, Nov 4"); the BA's longer example ("Wednesday, November 4") would also have been accepted and was not needed.

## 2. Layout (components 17), no scroll, targets, text cap

- Home order (DOM order and vertical order at 390 / 768 / 1280): app bar, alerts, month row, grid, Today card, upcoming, next-month card, tools. Section gap 40/48/64, block gap 24/32/40, card padding 20/24/24, grid 640 centred at 768. With no alert the whole month is in view at 390x844 and starts at y < 200.
- About panel: closed on every load, `aria-expanded`/`aria-controls`/region/labelledby, ja and en copy exact, Enter opens without moving focus, 「閉じる」/Escape/trigger return focus to the trigger, navigation closes it, 44 px trigger, name hidden below 400 px, inline pull-down below 768 (pushes the page, outside tap does not close) and popover from 768 (360 px wide, non-modal, outside click closes), no animation under reduced motion, no overflow at 320. **Open: UIR-D01, UIR-O1.**
- Legend: closed on load (also with no plan), ten rows whose samples are the tile states (3 icons, dash, allergen mark, red bar, filled today, 2 px tomorrow frame, grey past) plus the weekend row, ja and en exact, no assessment glyph or recipe name, closed again after reload.
- Sticky action bars (import, review, profile edit; 320x568, 320x300, 390x844, 768, 1280): sticky only below 768, `env(safe-area-inset-bottom)` in the declared rule, never above 40 percent of the viewport (it unsticks at 320x300), never covers the last field (focused last control not covered). **Open: UIR-D02 (review footer stays sticky from 768).**
- Import focus order: the submit button is the last control. Login: brand in the top third and sign-in in the lower part on a phone, one centred 400 px column from 768, axe clean in both themes.
- Every screen (calendar, calendar with day sheet, calendar without a menu, import, review, onboarding, profile, settings, recipes, recipe detail, recommend, login, join, not-found) at 320 / 390 / 768 / 1280: no horizontal scroll, every control >= 44 x 44 (inline links in text exempt), prose never wider than 36 em from 768. Settings with the E15 family card (no family, consent notice, member with invite) and the sync status sheet at the four widths: pass. Negative control included (a 30 px button, a 900 px paragraph and a 2000 px box are detected). **Open: UIR-D08 (en, 320, month row with the Today pill), UIR-D03 (skip link 43 px).**

## 3. Accessibility (US-NF-02/AC1-AC4, US-E8-05/AC3)

- axe, 0 serious or critical: every touched screen at 390 and 1280, light and dark (ja); the tile matrix for six different todays with legend and about panel open, ja and en, both themes, both widths; the Sunday reminder banner (ja/en, light/dark); the 320 px agenda fallback.
- Contrast recomputed twice, never from `design/_scratch`: (a) 42 token pairs (tile, button, about badge) from `tokens.json` in both themes (unit test, 84 checks); (b) the RENDERED colours of every mark on every tile for four values of today, both themes, 390 and 1280: numbers >= 4.5, icons, bars, dash, frames, today fill, allergen glyph/ring >= 3. 0 failures.
- Keyboard-only: Tab order (brand, nav, grid as ONE tab stop, rest), roving tabindex starts on today, arrows / Home / End, Enter opens the sheet, Escape returns to the tile, PageDown changes month. The focus ring (solid, 2 px, `focus-ring` colour, halo) on ten kinds of tile in light and dark at 390 and 1280 is visible and not clipped by any ancestor.
- Reduced motion: nothing on tiles, sheets, legend or about panel animates or transitions.
- Screen-reader structure: grid/row/gridcell roles, long weekday names on column headers, `aria-current="date"` on today only, icons/mark/dash/number `aria-hidden`, names unique per date and containing the visible number.
- Not verifiable here: real screen readers (NVDA, VoiceOver, TalkBack): names are verified in Chrome's accessibility tree only.

## 4. Buttons (components 1.3)

- Every real `.btn` / `.iconbtn` on every touched screen, both dialogs of settings, the consent dialog, four day sheets, the family card (none, consent notice, member, invite) and the sync sheet, light and dark, 390 and 1280: 210 buttons seen per sweep; fill, colour, border, height (52, or 44 for text and small), 16 px / 700 label, `word-break: keep-all`, underline and 4 px offset, label contrast >= 4.5, icon buttons >= 44 and square. All variants were seen.
- Sandbox: every variant (primary, secondary, text, destructive, destructive-text) x state (default, hover, active, focus-visible, disabled, busy) on the page and inside a card, both themes, with a real pointer: fills per tokens, disabled = `surface-3` / `ink-3` / 2 px dashed `line-ui` / no underline / `not-allowed`, focus ring plus halo, no layout shift on hover. The hover tests are skipped on the touch ("mobile") project because it has `hover: none`; the desktop project runs them (2 skips, reason in the test).
- The two small buttons (今日, 来週の予定…) are secondary; chevrons 48 px; the primary decision on the day sheet is pinned in the sheet bar on a phone.
- **Open: UIR-D05, UIR-D06, UIR-D07.** Observation UIR-O3.

## 5. Regression and retired behaviour

- Existing suites: see Counts. Failures of the first QA-config run and their cause (all triaged):
  - `e0-journey` (x2 projects) asserted the recipe short name on the tile, a behaviour the BA retired (US-E5-01/AC4). **Fixed in the test**: now asserts the home icon and that the name is absent.
  - `m1-a11y-i18n` (4 combos x 2): "untranslated English in ja mode" on the E13 account card (`Test Parent`, the signed-in person's own name, data not UI text). Pre-existing since E13, not the refresh. **Fixed in the test** (account name, e-mail and avatar excluded).
  - `full-journey` (m4 config and qa config): axe `color-contrast` on `.btn--primary` of the day-before reminder banner, read while the banner fades in (the QA helper did not wait for animations, the developer's helper does). My settled checks of the Sunday banner pass in four combinations. **Fixed in `tests/e2e/qa/helpers.ts`** (animations settled first). Not re-run inside the m4 config after the change; the helper change is the only edit.
  - `m4-edge` 239 and 339 (x projects): need `dist/` (`npm run build`); pass in the m4 config after a build. `m4-edge` 232 (tokyo-ja only): expects 「日本時間」, only shown to a non-Tokyo browser; passes in the m4 config; the qa config runs it in a Tokyo project (config scope, pre-existing).
  - `m1-proxy` (promptVersion=3 accepted), `m1-import-failures` (fallback model id), `nf01-perf` (LCP 2.9 to 3.3 s): not caused by the refresh. `server/` and `src/adapters/` have no change since the commit before the refresh (`e24bb6a`); the perf test was run against `e24bb6a` as well: LCP 2900 / 2888 ms there, 3288 / 2856 ms now, so the approximation was already over 2.5 s. The cause is bundle size at 1.6 Mbps (FCP equals LCP), not layout. **Open, pre-existing, owner Orchestrator/developer: US-NF-01/AC1 not met by the approximation** (real Lighthouse not run).
  - `m1-targets` reflow at 320 px: real defect UIR-D08, left red on purpose.
- Retired US-E5-01 behaviours: searched `tests/` for the retired marks (short name on the tile, assessment marker, 「給食」 text label on the tile, hatch/dashed suggestion, flag badge). The only active assertion was in `e0-journey` (fixed). The developer's unit tests assert absence only. Data-contract tests of `shortName*` stay (the BA keeps them as data).
- Privacy (US-NF-03): the refreshed home, about panel, consent text, legend and day sheet make no request outside the app origin and no write request.

## 6. Visual evidence and assessment

Screenshots (QA matrix, today = 17 Nov): `docs/dev/_scratch/ui-refresh/qa/home-{390,768,1280}-{light,dark}{,-full,-legend,-about}.png` (24 files).

Against the PO's goals (my reading of the screenshots and measurements, not a user test):
- **Calmer**: yes. A tile is a number and one outline icon; no words, no assessment glyphs, no recipe names; red is used only for the top bar, the dash and the allergen mark. The legend and the about text are behind buttons. The Sunday weekly reminder (288 px at 390, grid starts at y=432) is the one thing that still pushes the calendar down; it is an alert and allowed by the design, but it is the biggest remaining source of density (observation UIR-O5).
- **Calendar in focus**: yes. With no alert the whole month is visible at 390x844 starting at y < 200; the Today card, upcoming and next-month card come after it; at 1280 the calendar and the day panel share the first screen.
- **More whitespace**: yes, measured: 40/48/64 section gaps, 24/32/40 block gaps, 80/96/104 px rows, 20 px gutters. Rows without an icon, today or tomorrow tile collapse to 44 px, which makes the grid look uneven when the matrix has many empty days; that is by design (components 18.4).
- **SP first**: yes. 320 to 390 is the designed case, targets >= 44, sticky bars with safe-area rule, login thumb layout, pull-down instead of popover. One failure at 320 in English (UIR-D08). The state icons are small (24 px, 20 px in the narrow weekend column); readable in the screenshots, but real-phone legibility at arm's length is not verifiable here.
- Logo: the brand mark in the app bar renders as an empty rounded square (placeholder); not part of this brief.

## Defects (open)

| ID | Sev | AC / design | Summary | Repro | Test |
|---|---|---|---|---|---|
| UIR-D01 | P3 | components 17.2, a11y 12 (keyboard map) | After opening the about panel the next Tab does not enter it: the panel sits after the whole app bar in the DOM, so Tab goes language toggle, library, settings, then the panel's consent button. Spec: next Tab enters the panel, Tab past 閉じる continues to the language toggle. | Home, focus the brand button, Enter, press Tab 4 times (sequence: lang-toggle-ja, appbar-recipes, appbar-settings, about-consent, about-close). | `ui-refresh-layout.spec.ts` "UIR-D01" (test.fail) |
| UIR-D08 | P3 | US-NF-02/AC1 (reflow at 320), a11y 10 | English, 320 px wide, a month other than the current one (the 「Today」 pill appears): the month row is 37 px wider than the viewport, page scrolls horizontally. ja at 320 and en at 360/390 are fine. The existing `m1-targets.spec.ts` "NF-02 reflow" fails on it. | 320x700, EN, tap next month. | `ui-refresh-screens.spec.ts` "UIR-D08" (en 320, test.fail) |
| UIR-D02 | P4 | components 17.6 ("not sticky from 768") | The review footer (`.sticky-footer.action-bar`) stays `position: sticky` at 768 and 1280. | `#/review/2026-11` with a pending extraction at 768. | `ui-refresh-layout.spec.ts` sticky bar, review 768/1280 (test.fail) |
| UIR-D05 | P4 | components 1.9, 3.3 (choice card active = surface-3) | Day-sheet decision actions (`.plan-action`) have no hover or pressed rule; pressing changes nothing. | Open `#/day/2026-11-18` at 1280, press and hold a decision button. | `ui-refresh-buttons.spec.ts` "UIR-D05" (test.fail) |
| UIR-D06 | P4 | components 1.3, 3.3 (給食に戻す = destructive-text) | The destructive entry point on a planned day is an outlined card with a danger border (`.plan-action--danger`), not underlined destructive text. | Same sheet, the last action. | "UIR-D06" (test.fail) |
| UIR-D07 | P4 | components 1.3 (six variants) | The 「カレンダーに戻る」 link on not-found, join and recipe-not-found is a bare `.btn` with no variant class (looks like a secondary button on `surface-1`, hover differs). | `#/nope/nothing`, `#/join/ABCDEFGHJK`, `#/recipe/rcp-does-not-exist`. | "UIR-D07" x3 (test.fail) |
| UIR-D03 | P4 | US-NF-02/AC3 (44 px) | The skip link is 43 px high when focused (padding 8 + line height). Probably older than the refresh; not asserted by a test (excluded from the target sweep with a comment). | Tab once from the page top, measure `.skip-link`. | none |

The `test.fail` repros turn red when a defect is fixed, which is the signal to delete the annotation. Owners: UIR-D01, D02, D05, D06, D07, D08 developer; D03 developer (with the designer if the skip link is meant to be 44 px).

Observations for the Orchestrator (not defects, no test fails on them):
- UIR-O1: the desktop about popover is `position: fixed` (spec: absolute). Equivalent under the sticky app bar.
- UIR-O2: `aria-selected` is set on the gridcell of the open day (components 18.6 says none). Valid ARIA. A `test.fail` documents it (`UIR-O2`). Decide: change the design text or remove the attribute.
- UIR-O3: `.btn--small` renders its label at 14 px; components 1.3 lists 16 px and does not define a small variant.
- UIR-O4: holidays (US-E8-04) are deferred by PLAN 2026-10-31, so no holiday numerals or 「祝」 are drawn; the AC2 holiday sentence is not verified.
- UIR-O5: the Sunday weekly reminder banner is 288 px high at 390 (grid starts at y=432).
- JS bundle headroom is 4 KB (441.0 of 445).

## ACs: verified, partly, not verifiable

- Verified: US-E5-01/AC1, AC2 (header, Monday first, Sat/Sun numerals; holiday sentence not applicable), AC3, AC4, AC9, AC10, AC11, AC12, AC13, AC14, AC15, AC16; US-E4-03/AC8; US-E5-03/AC2 and US-E5-05/AC1 (the tile for stored CONFIRM_RECIPE/CHANGE_RECIPE and DEFER decisions is verified from stored data; the parent actions themselves were not driven through the UI in this pass, except the override); US-E6-06/AC1; US-E7-03/AC1 (placement below the calendar; the card text was not re-verified); US-E8-05/AC3; US-NF-02/AC1 to AC4 (axe, keyboard, 44 px, names) for the touched screens; US-NF-03 for the refreshed home; the Conventions bullet on tile content (budget test on all 31 tile kinds in the matrix).
- Partly: US-NF-01 (budgets pass; LCP approximation over 2.5 s, pre-existing; AC2 interaction times pass in the H4 run: months, sheet and 3 recommendations <= 100 ms); US-E5-01/AC5-AC8 only as far as month navigation and the weekday header (not re-tested: leap February, Sunday start).
- Not verifiable here: real phones (safe-area inset values, touch accuracy of 20 px weekend icons, thumb reach), the on-screen keyboard (only the keyboard-height viewport 320x300 was simulated), real screen readers, real Lighthouse, visual taste.

## Test changes to existing QA files (mine to change; tests only)

`tests/e2e/qa/e0-journey.spec.ts` (retired short name on the tile), `tests/e2e/qa/helpers.ts` (`axeSerious` settles animations first), `tests/e2e/qa/m1-a11y-i18n.spec.ts` (account name is data), `tests/e2e/qa/playwright.qa.config.ts` (ignore `ui-refresh-*`), `vitest.config.ts` (include `tests/unit/qa/ui-refresh`).
Run artefacts: several git-tracked files under `tests/_scratch/` are rewritten by the existing configs (Playwright output, `qa-e13-prod-dist`); they were restored and are not part of the commit.
