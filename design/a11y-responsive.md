# BentoMinder: accessibility and responsive spec v1.0

> Status: **H2 final**, 2026-10-24. Target: **WCAG 2.1 AA** on every MVP screen in ja and en, light and dark (US-NF-02, US-E8-05/AC3), verified later by axe in e2e (0 serious/critical) and the keyboard-only E0 journey. **Revision 2026-10-25 (M2 prep):** app-bar targets on the element box (§7, D-M1-08), date-correction grid (§3, §5, contrast usages). Components: `design/components.md`. Strings: `design/copy.md`. Tokens: `design/tokens.json` (source) / `design/tokens.css` (generated).

## 1. Principles that decide disputes
1. **Meaning never rides on colour alone** (§3). Every state has a shape, an icon or a word.
2. **One focus style everywhere**, never removed (§4).
3. **Everything the journey needs works with a keyboard and a screen reader** (§5, §7), including the calendar.
4. **Japanese text is set as Japanese** (§9): no mechanical truncation, kinsoku rules on, 12 px minimum.
5. **Small screens and big text get a different layout, not a broken one** (§6): the calendar becomes a list.

## 2. Contrast audit

Computed with the WCAG 2.1 relative-luminance formula from the hex values in `design/tokens.json` by `design/_scratch/contrast.mjs` (re-run after any token change; it exits non-zero on a failure). `surface-1` is pure white `#FFFFFF` (PO 2026-10-24). Thresholds: **4.5:1** for text (all our text is treated as normal size, even headings), **3:1** for UI parts, icons that carry meaning and focus indicators.

W1–W4 (added 2026-11-01) re-use the values of P35–P38 for the processed-food warning; no new colour pair.

**Result: 68 pairs × 2 themes = 136 checks, 0 failures.**
- Lowest text pair: **P09 `ink-3` on `surface-3` = 4.65:1** (light; disabled text). Next: P13 `ink-inverse` on `accent-strong` = 4.96:1 (primary button).
- Lowest UI pair: **U03 `line-ui` on `surface-3` = 3.07:1** (light; dashed border of a disabled control).
- Dark theme: `line-ui` changed from the direction's `#7D7A72` to **`#8A877E`** so control borders pass on `surface-3` (3.66:1); `planned-edge` added (light `#D2574F`, dark `#B8443C`) because the soft red top edge on the cream planned cell was 2.12:1 in dark.

| # | Foreground on background | Light | Dark | Needs | Used for |
|---|---|---|---|---|---|
| P01 | `ink-1` on `surface-1` | 14.22 | 15.03 | 4.5 | Body text on page |
| P02 | `ink-1` on `surface-2` | 13.99 | 13.37 | 4.5 | Text on cards, sheets, cells; date-correction grid numerals |
| P03 | `ink-1` on `surface-3` | 11.90 | 11.49 | 4.5 | Chip text, read-only input, illustration panel caption |
| P04 | `ink-2` on `surface-1` | 8.71 | 10.12 | 4.5 | Secondary text on page; food-picker group headings |
| P05 | `ink-2` on `surface-2` | 8.57 | 9.01 | 4.5 | Secondary text on cards; cell word 給食; marks ○ △ —; food-picker group headings and date-correction legend in sheets |
| P06 | `ink-2` on `surface-3` | 7.29 | 7.74 | 4.5 | Secondary text on sunken areas |
| P07 | `ink-3` on `surface-1` | 5.56 | 6.82 | 4.5 | Hints, past-day numerals on page |
| P08 | `ink-3` on `surface-2` | 5.47 | 6.07 | 4.5 | Hints in cards; past numerals in cells; current and taken numerals in the date-correction grid |
| P09 | `ink-3` on `surface-3` | 4.65 | 5.22 | 4.5 | Disabled button/chip text on disabled fill |
| P10 | `ink-inverse` on `navy-fill` | 13.20 | 15.03 | 4.5 | Planned cell text and icons; planned banner; selected chip; toast; selected date-correction cell (numeral, bar) |
| P11 | `navy-fill` on `ink-inverse` | 13.20 | 15.03 | 4.5 | Today numeral on a planned cell (inverted circle) |
| P12 | `surface-2` on `ink-1` | 13.99 | 13.37 | 4.5 | Today numeral (navy circle), step numbers, active toggle side |
| P13 | `ink-inverse` on `accent-strong` | 4.96 | 7.08 | 4.5 | Primary button label |
| P14 | `ink-inverse` on `accent-strong-hover` | 6.11 | 8.45 | 4.5 | Primary button hover/pressed |
| P15 | `ink-inverse` on `danger-strong` | 6.80 | 8.53 | 4.5 | Destructive button label |
| P16 | `ink-inverse` on `danger-strong-hover` | 8.72 | 10.43 | 4.5 | Destructive button hover/pressed |
| P17 | `accent-ink` on `surface-1` | 6.33 | 8.45 | 4.5 | Red text on page |
| P18 | `accent-ink` on `surface-2` | 6.23 | 7.52 | 4.5 | Low-preference ? mark and label in cells and cards |
| P19 | `accent-ink` on `accent-soft` | 5.06 | 7.05 | 4.5 | 苦手 tag; low-preference chip |
| P20 | `ink-1` on `accent-soft` | 11.37 | 12.54 | 4.5 | Assessment sentence in the low-preference block |
| P21 | `ink-2` on `accent-soft` | 6.97 | 8.44 | 4.5 | Secondary text in the low-preference block |
| P22 | `saturday` on `surface-1` | 6.73 | 8.15 | 4.5 | Saturday numeral/header on page |
| P23 | `saturday` on `surface-2` | 6.62 | 7.25 | 4.5 | Saturday numeral in a cell |
| P24 | `sunday` on `surface-1` | 6.33 | 8.45 | 4.5 | Sunday/holiday numeral/header on page |
| P25 | `sunday` on `surface-2` | 6.23 | 7.52 | 4.5 | Holiday numeral and 祝 in a cell |
| P26 | `info` on `surface-1` | 6.73 | 8.15 | 4.5 | Info text on page |
| P27 | `info` on `surface-2` | 6.62 | 7.25 | 4.5 | Info icon/text in cards |
| P28 | `ink-1` on `info-soft` | 11.93 | 11.33 | 4.5 | Info banner and disclaimer text |
| P29 | `info` on `info-soft` | 5.65 | 6.14 | 4.5 | Info banner icon and title |
| P30 | `link` on `surface-1` | 6.73 | 8.15 | 4.5 | Inline link on page |
| P31 | `link` on `surface-2` | 6.62 | 7.25 | 4.5 | Inline link in cards and sheets |
| P32 | `success` on `success-soft` | 5.34 | 7.12 | 4.5 | Success banner text |
| P33 | `success` on `surface-2` | 6.19 | 8.81 | 4.5 | Success icon/text in cards |
| P34 | `ink-1` on `success-soft` | 12.06 | 10.80 | 4.5 | Success banner body |
| P35 | `warning` on `warning-soft` | 6.39 | 8.05 | 4.5 | Warning banner title, uncertain label, needs-review badge |
| P36 | `ink-1` on `warning-soft` | 12.62 | 11.31 | 4.5 | Warning banner body; uncertain field value |
| P37 | `warning` on `surface-2` | 7.08 | 9.52 | 4.5 | Warning icon/text in cards and sheets |
| P38 | `warning` on `surface-1` | 7.20 | 10.70 | 4.5 | Warning text on page |
| P39 | `danger` on `surface-1` | 7.32 | 8.53 | 4.5 | Error text under a field on page |
| P40 | `danger` on `surface-2` | 7.20 | 7.59 | 4.5 | Error text in cards and sheets |
| P41 | `danger` on `danger-soft` | 5.99 | 6.93 | 4.5 | Error banner title |
| P42 | `ink-1` on `danger-soft` | 11.62 | 12.21 | 4.5 | Error banner body |
| P43 | `ink-2` on `line-1` | 6.29 | 6.67 | 4.5 | Label on hatch (label sits on its own surface-2 pill; worst case) |
| U01 | `line-ui` on `surface-1` | 3.67 | 4.79 | 3 | Input/checkbox/radio/switch border on page |
| U02 | `line-ui` on `surface-2` | 3.61 | 4.26 | 3 | Input/checkbox/radio border in cards and sheets; dashed current-date cell in the date-correction grid |
| U03 | `line-ui` on `surface-3` | 3.07 | 3.66 | 3 | Disabled control dashed border on disabled fill |
| U04 | `ink-1` on `surface-2` | 13.99 | 13.37 | 3 | Secondary button border; not-confirmed cell solid outline; same-weekday bar in the date-correction grid |
| U05 | `accent` on `surface-1` | 4.03 | 7.08 | 3 | Dashed suggestion outline (low-preference, still school lunch) on page |
| U06 | `accent` on `surface-2` | 3.96 | 6.30 | 3 | Dashed suggestion outline on cell surface |
| U07 | `accent-strong` on `surface-1` | 5.34 | 7.08 | 3 | Primary button fill boundary on page |
| U08 | `accent-strong` on `surface-2` | 5.26 | 6.30 | 3 | Primary button fill boundary in cards |
| U09 | `danger` on `surface-2` | 7.20 | 7.59 | 3 | Invalid input border |
| U10 | `focus-ring` on `surface-1` | 6.09 | 8.15 | 3 | Focus ring on page |
| U11 | `focus-ring` on `surface-2` | 5.99 | 7.25 | 3 | Focus ring in cards and sheets |
| U12 | `focus-ring` on `focus-halo` | 6.09 | 8.15 | 3 | Focus ring against its halo (on any fill, incl. planned cells) |
| U13 | `navy-fill` on `surface-1` | 14.22 | 15.03 | 3 | Planned cell fill boundary on page |
| U14 | `warning` on `surface-2` | 7.08 | 9.52 | 3 | Uncertain field 2 px border; needs-review badge border |
| U15 | `warning-soft` on `navy-fill` | 12.62 | 11.31 | 3 | Needs-review badge on a planned (filled) cell |
| U16 | `success` on `surface-2` | 6.19 | 8.81 | 3 | Checked checkbox fill; switch on track |
| U17 | `ink-inverse` on `success` | 5.84 | 9.90 | 3 | Check mark on the checked checkbox / switch knob |
| U18 | `accent-ink` on `surface-2` | 6.23 | 7.52 | 3 | Low-preference ? mark (icon) |
| U19 | `ink-2` on `surface-2` | 8.57 | 9.01 | 3 | Assessment marks ○ △ — (icons); taken-date dot in the date-correction grid |
| U20 | `planned-edge` on `navy-fill` | 3.53 | 4.67 | 3 | Red top edge of a planned cell and planned banner edge |
| U21 | `accent` on `surface-3` | 3.37 | 5.42 | 3 | Stripe band on illustration panels (decorative) |
| U22 | `stripe-a` on `surface-1` | 14.22 | 15.03 | 3 | Navy stripe band under the app bar (decorative) |
| W1 | `warning` on `surface-1` (= P38) | 7.20 | 10.70 | 4.5 | Processed-food marker and compact notice text on page rows |
| W2 | `warning` on `surface-2` (= P37) | 7.08 | 9.52 | 4.5 | Processed-food marker and compact notice on cards, sheets, ingredient table in cards; icon at 3:1 (U14) |
| W3 | `ink-1` on `warning-soft` (= P36) | 12.62 | 11.31 | 4.5 | Recipe notice `warn.processed.recipe` body |
| W4 | `warning` on `warning-soft` (= P35) | 6.39 | 8.05 | 3 | Recipe notice icon |
| D01 | `debug-ink` on `debug-surface` | 14.58 | 14.58 | 4.5 | Debug panel text (dev only) |
| D02 | `debug-accent` on `debug-surface` | 9.39 | 9.39 | 3 | Debug panel borders and controls (dev only) |
| D03 | `debug-surface` on `debug-accent` | 9.39 | 9.39 | 4.5 | DEV pill text on accent (dev only) |

**Pairs deliberately not in the table (not text, not needed to identify a control):**
- `line-1` hairlines and the 1 px border of calendar cells and cards (1.3:1 on white). They are decoration: a cell is identified by its numeral and words (≥ 5.47:1), a card by its heading. Inputs, checkboxes, radios, switches, chips and secondary buttons always use `line-ui` or `ink-1` borders (U01–U04).
- The diagonal hatch (`line-1` stripes): its meaning ("no school lunch") is also carried by the word 「給食なし」/「お弁当の日」 on a `surface-2` pill (P43 worst case shown).
- Stripe bands and illustrations (`illus-*`): decorative, `aria-hidden`, never carry text.
- Scrim: not a text background.
- Disabled controls: WCAG exempts them, but we still keep their text ≥ 4.5:1 (P09) and their border ≥ 3:1 (U03).

**Rejected pairs (never specify):** `ink-inverse` on `accent` (3.96:1, why `accent-strong` exists); `accent` as text on any surface; `line-1` as a control border; `accent` on `navy-fill` in dark (2.12:1, replaced by `planned-edge`); `ink-3` on `accent-soft` (not used).

## 3. State never relies on colour alone

> **2026-11-10 (day tile redesign):** the calendar rows below that mention assessment marks (○ △ ? —), the override bar, decision words, the dashed suggestion frame, the hatch, the recipe name, the planned fill and the needs-review badge **are superseded for the tile by §12.2**. The other rows (forms, chips, switches, debug, processed food, date correction) stand.

| Information | Colour cue | Non-colour cue(s) | Story |
|---|---|---|---|
| Assessment: likely / mixed / low / not assessed | ink-2 / ink-2 / accent-ink | Mark shape ○ / △ / dashed-circle ? / —; word in sheet and accessible name | US-E5-01/AC3, US-NF-02/AC3 |
| Override | — | 2 px bar under the mark; 「手動で変更」 label | US-E4-03/AC1 |
| Decision: school lunch / not confirmed / planned | — / ink-1 / navy fill | Word 給食 / outline bento icon + 未定 + solid 2 px frame / filled bento icon + recipe name + solid fill | US-E5-01/AC4, US-E5-05/AC1, BR-03 |
| Low preference while still school lunch (suggestion) | accent dashed frame | **Dashed** border + ? mark + the word 給食 stays | US-E5-04 |
| No school lunch / bento day | hatch | Words 「給食なし」/「お弁当の日」, bento icon on bento day | US-E5-08 |
| Saturday / Sunday / holiday | blue / red / red | Column position + weekday header text; 「祝」 word on holidays; holiday name in the accessible name | US-E5-01/AC2, US-E8-04/AC1 |
| Today | navy circle | Filled circle shape, 「今日、」 in the accessible name, `aria-current="date"`, today card names the date | US-E5-01/AC1 |
| Past day | ink-3 numeral | Box background removed (transparent) + 「過去の日」 in the accessible name + read-only note in the sheet | US-E5-02/AC3 |
| Needs review / allergen conflict | warning / danger | "!" badge shape; 「献立が変わりました」/「アレルゲン注意」 in the accessible name and the sheet banner | US-E3-05/AC2, US-E1-05/AC2 |
| Processed food (child with a registered allergen) | warning | Package icon + visible text 「市販品。表示を確認」 on the ingredient; triangle icon + text in the notice and compact line; hidden 「注意」 lead-in | US-E6-02/AC11 |
| Uncertain review field | warning fill and border | 「要確認」 tag + triangle icon + reason text | US-E3-01/AC2 |
| Date-correction grid: same weekday / taken / current date / selected | ink-1 bar / ink-2 dot + ink-3 numeral / dashed line-ui / navy fill | Bar, dot, dashed border; visible legend text and accessible-name suffixes 「曜日が一致」「ほかの献立があります」「いまの日付」; status-line text; `aria-disabled`, `aria-selected` | US-E2-05/AC7, AC8 |
| Disliked menu item | accent wavy underline | Tag 「苦手」 | US-E4-02 |
| Errors | danger | Triangle icon + message text + `aria-invalid` | all forms |
| Selected chip / segment | navy fill | Check icon, `aria-checked`/`aria-pressed` | §1.6–1.7 |
| Switch on/off | success track | Knob position + visible 「オン」/「オフ」 | US-E7-04/AC4 |
| Disabled | grey | Dashed border + explanatory hint, `aria-disabled` | all |
| Rank of recommendations | — | Text badge 「1位」 | US-E6-01 |
| Debug UI | purple | Hatched band, square corners, monospace, 「Debug」 label | US-E11-01 |

Test: the e2e suite runs the calendar screenshot check in greyscale (`filter: grayscale(1)`) and asserts the state words/shapes are present (QA, US-NF-02/AC3).

## 4. Focus

**Style.** `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-halo) }` (in `tokens.css`). Ring vs page 6.09:1, vs its halo 6.09:1 (light) / 8.15:1 (dark), so it reads on navy-filled cells and inside the 2 px grid gaps. Mouse clicks don't show the ring; keyboard always does. Never `outline: none` without this replacement. Focused elements are never hidden under the sticky footers (`scroll-padding-bottom: 96px` on scroll containers; `scroll-padding-top: 72px` under the app bar).

**Focus order per screen** (DOM order = visual order; no positive `tabindex`):

| Screen | Order |
|---|---|
| All | 1 skip link 「本文へ移動」 (visible on focus) → app/top bar → main |
| C1 Calendar | app bar (日本語/EN, レシピ, 設定) → reminder banners (actions, then close; 「ほかにn件」) → storage/menu cards → today card action / checkbox → upcoming rows → 前の月 → 今日 → 次の月 → **grid (one tab stop, arrows inside)** → legend toggle → 今週の予定を共有. Desktop: then the side panel (its header receives focus when a date is chosen) |
| D1 Day sheet | header (date, receives focus on open) → close → conflict/allergen banner actions → menu (no stops unless links) → 判定を変更 → override radios → 自動判定に戻す → plan actions top to bottom → reservation checkbox. Esc / close → focus returns to the cell |
| R1 Recommendations | back → title → (unknown-allergy banner is text, no stop) → card 1: この日に決定, 作り方を見る → card 2 … → card 3 … → ほかのレシピ → links in the disclaimer (none) / empty-state links |
| R2 Recipe | back → processed-food notice and markers are static text, no stop (read in DOM order: notice before the ingredient table, marker between an ingredient's label and its quantity) → (planned banner, no stop) → source links in reading order → 農林水産省 credit link → sticky footer action(s) (last) |
| R3 Library | back → rows in order → (plan-date picker: title → options → この日に決定 → close) |
| S1 Profile | back (not on step 1) → nickname → age chips (radio group: one stop, arrows) → likes search → selected chips' remove buttons → popular chips → dislikes (same) → allergy radio group → allergen chips (9, then 20) → other-foods search → diet chips → theme chips → note → 次へ. On a failed 次へ: focus to the first invalid group |
| S2 Import | back → month select → URL → 取り込む → PDFファイルを選ぶ → くわしく見る → 手入力する → あとで取り込む. After an error: focus moves to the error panel (heading), then its actions |
| S2c Consent | dialog title → link → 同意しない → 同意して読み取る (initial focus on the title so the text is read first) |
| S2p Progress | headline (focused, status) → 中止する |
| S3 Review | back → summary → 次の要確認へ → 元のPDFを見る → day rows in date order (per row: 日付を直す → このままにする (day-level weekday-mismatch flag; a corrected row keeps 日付を直す only) → dish inputs → their remove buttons → このままにする (field flags) → 料理を追加 → 給食なしの日にする / reason radios → 献立表での書き方) → out-of-month disclosure → この内容で確定 (sticky, last). 次の要確認へ moves focus to the next uncertain field and scrolls it above the footer |
| S3d Date correction | close → grid (one stop; initial focus on the nearest free 曜日が一致 cell, the title is read as the dialog label) → キャンセル → この日にする |
| Onboarding top bar (S1–S3) | back (not on step 1) → 日本語/EN → 設定 (US-E1-01/AC6) |
| S3r Needs-review list | title → rows (開く) → カレンダーへ |
| P1 Settings | back → sections top to bottom; within お知らせ: switch → 曜日 → 時 → 分 → next row; 表示: 言語 → 週のはじまり → テーマ; 献立表; プロフィール; データ; このアプリについて |
| H1 Share | title → preview (focusable `tabindex="0"` read-only region so it can be read and selected) → 共有する → コピーする → close |
| Dialogs | initial focus on the least destructive action (キャンセル / 戻る / 編集を続ける); trap inside; Esc = cancel; focus returns to the trigger |
| X1 Debug | Debug pill is the last tab stop of every screen (dev only); panel order top to bottom |

## 5. Keyboard map and ARIA patterns

| Component | Pattern | Keys |
|---|---|---|
| Date-correction mini-grid (review, components §6.9) | `dialog` (sheet / dialog / popover, always `aria-modal`) containing `role="grid"` labelled `review.dateFix.gridLabel`; gridcells with one button each, roving tabindex; `aria-selected` on the chosen cell; the current date `aria-disabled` | ←/→ day; ↑/↓ week; Home/End row start/end; PageUp/PageDown nothing (one month); arrows stop at the month edges; Enter/Space select a free date (does not apply) or, on a taken/current date, put the reason in the status line; taken and current cells are `aria-disabled` but focusable; Tab: close → grid → キャンセル → この日にする; Esc = cancel, focus back to 「日付を直す」. Initial focus: nearest free cell with the printed weekday |
| Calendar grid | `role="grid"` + `gridcell` with one button each, roving tabindex (ARIA APG date-picker grid) | ←/→ previous/next day; ↑/↓ same weekday previous/next week; Home/End first/last day of the week row; PageUp/PageDown previous/next month (focus keeps the day number, clamped); Enter/Space open the day sheet. Moving past a month edge loads the adjacent month. Focus lands on today when the grid is first entered, else on the last focused date |
| Agenda list (fallback) | `role="list"` of buttons | Tab/Shift+Tab, Enter |
| Month nav | buttons | Enter/Space |
| Language toggle, override segmented, settings language | `radiogroup` | ←/→ move and select; Tab leaves |
| Chips (single) | `radiogroup` | arrows; Space selects |
| Chips (multi) | toggle buttons `aria-pressed` | Tab between, Space/Enter toggle |
| Food picker search | combobox + listbox (`aria-expanded`, `aria-activedescendant`) | ↓/↑ move, Enter select, Esc close/clear |
| Radio groups (allergy, week start, theme, reasons, ambiguity) | native radios in fieldset | arrows |
| Switch | `role="switch"` button | Space/Enter |
| Sheet / dialog | `dialog` / `alertdialog`, `aria-modal` | Esc closes (= cancel), Tab trapped |
| Side panel (desktop) | `region` | not modal; F6-style: focus moves to its header on date choice |
| Disclosures (legend, more reminders, out-of-month, ほかのレシピ) | button + `aria-expanded` + `aria-controls` | Enter/Space |
| Reminder banners | `region` 「お知らせ」 containing articles | Tab to actions/close |
| Toasts | `role="status"` | not focusable unless they hold an action |
| Debug panel | `dialog` (non-modal on desktop) | Esc closes |

**Live regions**

| Message | Politeness | Where |
|---|---|---|
| Form error summary `live.formErrors` | assertive (`role="alert"`) | S1, P2, S3 on submit |
| Import errors (panel) | assertive | S2 |
| Import progress `import.progress` | polite (`role="status"`) | S2p |
| Month changed `live.monthChanged` | polite | C1 |
| Recommendation count `live.recCount`, `rec.fewer` | polite | R1 |
| Food moved / limit / theme limit | polite | S1 |
| Override saved, settings saved, toasts | polite | D1, P1, all |
| Reminder appears | polite (announced once; never steals focus) | C1 |
| Busy countdown | polite, at start and when the button becomes enabled only | S2 |
| Date correction status line `review.dateFix.selected` / `.cantChoose` / `.noFree` | polite (`role="status"` in the sheet) | S3d |
| Date correction applied `review.dateFix.moved` | polite; focus also moves to the moved row legend | S3 |
| Storage unavailable | assertive, once | all |

## 6. Screen-reader names for calendar tiles (replaced 2026-11-10: day tile redesign; components §18.10; BA US-E5-01/AC14)

Built from `copy.md` §24 (`cell.aria.*`, `cell.state.*`), one full sentence per tile button, no colour words, no "button" in the text, no assessment and no recipe name (both are in the day sheet). Order is fixed:

`{date}[、{holidayName}]、{state}[、手動で変更][、今日|明日|過去の日][、お弁当の準備が未定]`

| Tile | ja | en |
|---|---|---|
| School lunch, ordinary | 11月4日（水）、給食 | Wed, Nov 4, school lunch |
| School lunch, changed by the user, tomorrow (BA example) | 11月4日（水）、給食、手動で変更、明日 | Wed, Nov 4, school lunch, changed by you, tomorrow |
| Homemade bento planned | 11月18日（水）、手作りお弁当、手動で変更 | Wed, Nov 18, homemade bento, changed by you |
| Homemade bento planned, today | 11月17日（火）、手作りお弁当、手動で変更、今日 | Tue, Nov 17, homemade bento, changed by you, today |
| Bento day, no plan yet (red dash), later this month | 11月20日（金）、手作りお弁当の日、お弁当の準備が未定 | Fri, Nov 20, bento day, bento still to plan |
| Bento day, no plan, tomorrow | 11月20日（金）、手作りお弁当の日、明日、お弁当の準備が未定 | Fri, Nov 20, bento day, tomorrow, bento still to plan |
| Bento day, planned | 11月20日（金）、手作りお弁当、手動で変更 | Fri, Nov 20, homemade bento, changed by you |
| Not confirmed | 11月24日（火）、未定、手動で変更 | Tue, Nov 24, undecided, changed by you |
| Past school-lunch day | 11月5日（木）、給食、過去の日 | Thu, Nov 5, school lunch, past day |
| Past, changed (keeps its red top border) | 11月4日（水）、手作りお弁当、手動で変更、過去の日 | Wed, Nov 4, homemade bento, changed by you, past day |
| No-lunch day | 11月27日（金）、給食なし（午前保育（給食なし）） | Fri, Nov 27, no school lunch (午前保育（給食なし）) |
| Holiday outside the menu | 11月3日（火）、文化の日、献立に記載なし | Tue, Nov 3, Culture Day, not on the menu |
| Weekend, today | 11月7日（土）、献立に記載なし、今日 | Sat, Nov 7, not on the menu, today |
| Month without a menu | 12月1日（火）、献立未取り込み | Tue, Dec 1, menu not imported |

Notes. (1) The tomorrow tile is the next calendar date (BA AC12), so a Saturday tile can say 「明日」. (2) A dormant record (US-E3-05/AC8, AC12) is not named. (3) `cell.aria.override` (「手動で変更」) is reused unchanged; the BA's AC14 wording is used, not the shorter 「変更あり」 sometimes proposed. (4) The en date format is the existing `fmt.date` ("Wed, Nov 4"); BA AC14 prints "Wednesday, November 4" as an example, tests should compare through the keys. (5) Menu dish and no-lunch reason text inside sentences keep `lang="ja"` in EN mode. (6) The grid's `aria-label` is 「2026年11月のカレンダー」; column headers carry the long weekday (`aria-label="水曜日"`). (7) The visible content of the tile (number, 「祝」) is `aria-hidden`; the name comes from the sentence, so WCAG 2.5.3 holds (no visible label text differs from the name: the only visible text is the number and 「祝」, both inside the name). (8) The old US-NF-02/AC4 name with the assessment ("苦手かも、給食") is retired by the BA.

## 7. Touch targets and pointer

- Every interactive element ≥ **44 × 44 CSS px at 360 px width** (US-NF-02/AC3): buttons 52 px tall; icon buttons, chips, checkboxes, radios and switches have 44 px hit areas (padding or a pseudo-element when the visual is smaller). **Exception, D-M1-08 (2026-10-25): the app bar and top bar use no pseudo-element hit areas**; the language toggle options and icon buttons are ≥ 44 × 44 on their own box (components §1.1, §1.7), because a pseudo-element inside an `overflow: hidden` container is clipped and QA measures the element box. Date-correction mini-grid cells are 44 × 44 at 360 px (16 px sheet gutters); calendar weekend columns have `min-width: 44px` and rows ≥ 44 px (compact weekend-only rows are 44 px, never 34 px as in the direction draft).
- Targets never overlap; at least 4 px between adjacent separate targets, except calendar cells (2 px gap; each cell is ≥ 44 × 44 by itself).
- No gesture-only actions: the sheet's grab handle is decorative; swipe-to-close is an extra, the close button is always present. No hover-only content (hover reveals nothing that focus/tap doesn't).
- `touch-action: manipulation` on buttons (no double-tap zoom delay); pinch zoom is never disabled (`user-scalable` not set).

## 8. Breakpoints and layouts

| Breakpoint | Width | Layout |
|---|---|---|
| xs | 360–389 | Single column. Page gutter 16 px; calendar bleeds to 4 px gutters; brand text hidden in the app bar (logo only); weekday cells ≈ 50 px, weekend cells 44 px; recipe short names 2 × 4 chars at 12 px |
| sm (reference) | 390–767 | Same as xs with the brand text; weekday cells ≈ 56 px |
| md | 768–1279 | Single column centred, max 560 px; day sheet, share sheet and plan-date picker open as centred dialogs (max 480 px); recommendation cards one column; review rows stacked cards |
| lg | ≥ 1280 | Calendar home: left column (max 760 px) + **day side panel 440 px**; recommendations in 3 columns; recipe detail in 2 columns; review as a table with optional PDF split view; settings in 2 columns; icon buttons show text labels |

Below 360 px (and at 320 px for WCAG 1.4.10 reflow): content reflows in one column; the calendar switches to the **agenda list** (components §2.3). No horizontal scrolling except inside the review's PDF view.

## 9. Japanese text setting and line breaking

| Context | CSS | Why |
|---|---|---|
| Body text, explanations, banners, notes (ja) | `line-break: strict; word-break: normal; overflow-wrap: anywhere;` | Kinsoku: no 「。、）」 or small kana at a line start. `keep-all` is **not** used for running Japanese: with no spaces it would stop all breaks and overflow |
| Headings, button labels, chips, today headline (ja) | `word-break: auto-phrase; line-break: strict;` (Chromium 119+ with `lang="ja"`), fallback `word-break: normal` | Breaks between phrases (「この日に / 決定」 rather than mid-word) where supported; never overflows where not |
| Calendar cell words and recipe short names | Split into at most 2 lines **at a phrase boundary**, each line `white-space: nowrap; letter-spacing: 0; text-align: center`. Split rule: segment with `Intl.Segmenter('ja', { granularity: 'word' })`, take the boundary that keeps both lines ≤ 4 characters and is closest to the middle; if none exists, split after character 4. Fixed cell words are pre-split (給食 / 給食・なし / お弁当・の日 / 未定) | A plain 4 em box breaks mid-word (「ほしのオ / ムレツ」, 「給食な / し」 in the preview screenshot). The BA should curate `shortNameJa` so a natural split exists (「くまさん / おにぎり」, 「ほしの / オムレツ」). Never mechanical truncation or ellipsis (US-E5-01/AC4) |
| English (`html[lang=en]`) | `word-break: normal; overflow-wrap: break-word; hyphens: auto;` letter-spacing 0 | `shortNameEn` ≤ 8 chars ("Bear oni") breaks at its space |
| Dish names in EN mode | `lang="ja"` on the element | Correct font fallback, pronunciation and line breaking |
| Numerals | `font-variant-numeric: tabular-nums` (calendar, times, quantities) | Columns don't jitter |
| Japanese minimum size | 12 px (`--text-xs`), body 16 px, line-height 1.7 (1.85 recipe steps), tracking 0.02 em | Kanji legibility; en tracking 0 |
| No italics, no all-caps for meaning | | Japanese has no true italic |

Placeholders like 「{n}つ」 switch to 「個」 for 10 and more (copy §0).

## 10. Text resize, zoom and reflow

- All sizes in `rem` (tokens are px values at the 16 px root; the developer converts to rem in the token build or uses `calc(var(--text-md) / 16px * 1rem)`): browser text size 200 % scales every string; containers grow vertically.
- **200 % text**: the calendar's container query sees cells narrower than 4 em and switches to the agenda list; buttons wrap to 2 lines; sticky footers stay ≤ 25 % of the viewport height, otherwise they become non-sticky (static at the end of the content).
- **400 % zoom (320 CSS px)**: single column, agenda list, sheets become full-screen; no content or function lost (WCAG 1.4.4, 1.4.10).
- **Text spacing override** (WCAG 1.4.12: line-height 1.5, letter 0.12 em, word 0.16 em, paragraph 2 em): no fixed heights on text containers (cells use `min-height`), no clipped labels.

## 11. Motion

- Tokens: `--duration-fast` 120 ms (hover/press), `--duration-base` 200 ms (fades, banners, toast), `--duration-slow` 320 ms (sheet slide-up, panel), `--duration-shimmer` 1400 ms.
- `prefers-reduced-motion: reduce` → all durations 0 ms, `--sheet-offset` 0 px: sheets and dialogs appear in place, skeletons are static, the import spinner is replaced by static 「…」 + text, the indeterminate progress bar is static. No parallax, no confetti, no auto-playing animation anywhere; nothing flashes.
- Nothing animates for longer than 5 s; the skeleton shimmer stops when content arrives (≤ 100 ms budget, US-NF-01/AC2).

## 12. Forms and inputs

- Every input has a visible `<label>`; required/optional is written in text (「必須」/「任意」).
- Errors: inline message under the field + `aria-invalid` + `aria-describedby`; on submit, an assertive summary and focus to the first invalid control; never only a red border.
- URL input: `type="url" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false"`. Nickname: `autocomplete="off"` (not a real name). Dish inputs: `lang="ja"`, `enterkeyhint="next"`.
- File input: native input visually styled as the button (no custom drop-only zone); accepts `application/pdf`; the chosen file name is announced.
- Time: two native selects (hour, minute) instead of `<input type=time>`, because `step=900` is ignored by several mobile browsers (US-E7-04/AC3).
- Inputs are 16 px text so iOS doesn't zoom on focus.

## 13. Language and document

- `<html lang>` follows `settings.language` (`ja` default, US-E8-01/AC1–AC2); the language toggle's 「日本語」 carries `lang="ja"`, 「EN」 `lang="en"`.
- `<title>` per screen (`app.docTitle`); one `h1` per screen; headings in order; landmarks: `header` (app/top bar), `main`, `nav` none (no tab bar), `region`s for reminders and the side panel, `footer` for sticky actions.
- Dark/light: `color-scheme` set per theme so native controls match (US-E8-05).

## 14. Verification checklist for QA (maps to US-NF-02)
1. axe: 0 serious/critical on S1, S2, S2c, S3, S3r, C1, D1, R1, R2, R3, P1, H1, dialogs; ja and en; light and dark (AC1, US-E8-05/AC3).
2. Keyboard-only E0 journey (20 actions, flows §2) with visible focus at every step (AC2).
3. Greyscale screenshot of C1 with every cell state: states still distinguishable; every target ≥ 44 × 44 at 360 px (AC3).
4. Accessible names of the cells in §6 (AC4).
5. 200 % text and 320 px: agenda list appears, nothing clipped.
6. Reduced motion: no transitions (computed `transition-duration: 0s`).
7. `node design/_scratch/contrast.mjs` exits 0 after any token change.


---

## 12. UI refresh 2026-11 (addendum; components §17)

- **Breakpoints (unchanged values):** 320 (reflow floor, no horizontal scroll), 390 (design target, phone first), 400 (brand name appears), 768 (tablet: centred column, popover instead of pull-down, sheets as dialogs, sticky action bar becomes a normal footer), 1280 (calendar and day panel side by side). Cell heights: 80 / 96 / 104 px (`--cell-min-height`, `-md`, `-lg`). Rhythm aliases: components §17.3.
- **Keyboard map additions:** brand button: Enter and Space toggle the info panel; **Esc** closes it and returns focus to the button; Tab moves from the button into the panel (heading is not focusable; first stops are the consent button, then 「閉じる」); Tab past 「閉じる」 continues to the language toggle (popover mode: also closes on outside pointer). The legend toggle: Enter and Space. The grid's roving tabindex and arrow-key map (§5) are unchanged. Sticky action bar: last in DOM and tab order.
- **ARIA:** brand button `aria-expanded`, `aria-controls="about-panel"`, accessible name `about.open` (contains the visible name); panel `role="region"` with `aria-labelledby` pointing at its heading; legend toggle keeps `aria-expanded` and `aria-controls="legend-body"`. No live region for either disclosure. Logo inside the button is decorative (`aria-hidden`).
- **Targets:** brand button 44 × 44 minimum on its own box; month chevrons 48 × 48; share and legend buttons 52 / 44 px high; weekday cells about 56 × 80, weekend cells 44 × 44; `touch-action: manipulation` on cells as now.
- **Reflow and zoom:** at 320 px or 200 % text the grid container is below 340 px and the agenda list is used (unchanged); the popover is `max-width: calc(100vw - 32px)` and scrolls inside (`max-height: calc(100dvh - 96px)`); the sticky bar un-sticks when it would exceed 40 % of the viewport height.
- **Reduced motion:** no pull-down animation, no chevron rotation; the panel appears and disappears instantly. **Dark mode:** panel uses `surface-2` / `surface-1`, `ink-1`, `line-1`, which are already audited in both themes.
- **Contrast audit (new or changed pairs only; all other pairs are unchanged and stay in the main audit):**

| Pair | Where | Light | Dark | Needed | Result |
|---|---|---|---|---|---|
| `ink-1` on `surface-2` | panel text, heading | 14.0:1 | 13.4:1 | 4.5:1 | pass |
| `ink-2` on `surface-2` | panel paragraphs | 8.6:1 | 9.0:1 | 4.5:1 | pass |
| `ink-3` on `surface-2` | version line | 5.5:1 | 6.1:1 | 4.5:1 | pass |
| `ink-1` on `surface-1` | ⓘ badge closed (glyph on disc) | 14.2:1 | 15.0:1 | 3:1 (UI part) | pass |
| `ink-inverse` on `ink-1` | ⓘ badge open | 13.2:1 | 15.0:1 | 3:1 | pass |
| `line-1` top edge of the action bar | decorative divider | n/a (not required) | n/a | none | decorative |
| `accent` 2 px underline under today's weekday | decorative; the navy disc is the real signal | n/a | n/a | none | decorative |

  Values computed 2026-11-10 from the hex values in `design/tokens.json` (same WCAG formula as `design/_scratch/contrast.mjs`); dark column uses the dark roles of the same names. No new colour exists.


### 12.2 Day tile redesign (2026-11-10; components §18; BA US-E5-01/AC3-AC4, AC9-AC15)

- **Keyboard and ARIA:** unchanged (roving tabindex, arrows, Home/End, PageUp/PageDown, `role="grid"`; today `aria-current="date"`). The tile name is the sentence in §6 (replaced). Icons, the red dash and the red top bar are `aria-hidden` decoration; every fact they show is in the name and in the legend text.
- **Never colour alone** (replaces the calendar rows of §3): school / home / unsure = box / X / X with ?; changed = top bar + 「手動で変更」; needed-not-planned = bottom dash + 「お弁当の準備が未定」; today = the only filled tile + 「今日」 + `aria-current`; tomorrow = 2 px frame + 「明日」; past = no fill, lighter stroke + 「過去の日」. Assessment (○ △ ? —), recipe name and badges are no longer on the tile.
- **Targets:** tile >= 44 x 44 (weekend column 44 x 80), 2 px gap. **Reflow / 200 % text:** agenda rows (components §18.9) carry the words as text.
- **Reduced motion:** nothing animates on a tile. **Dark:** the same token names; `navy-fill` is cream and `ink-inverse` deep navy, so today stays "the filled tile".
- **Contrast audit for the tile** (computed 2026-11-10 from `design/tokens.json` with the WCAG 2.1 formula by `docs/dev/_scratch/ui-refresh/tile-contrast.mjs`; **26 pairs x 2 themes = 52 checks, 0 failures**; no new colour exists). Needs: 4.5 text, 3 non-text.

| # | Pair | Where | Light | Dark | Needs |
|---|---|---|---|---|---|
| T01 | `ink-1` on `surface-2` | day number on a tile (= P02) | 13.99 | 13.37 | 4.5 |
| T02 | `ink-3` on `surface-1` | past day number on the transparent past tile (= P07) | 5.56 | 6.82 | 4.5 |
| T03 | `ink-inverse` on `navy-fill` | today: number | 13.20 | 15.03 | 4.5 |
| T04 | `ink-2` on `surface-2` | icon on a normal tile | 8.57 | 9.01 | 3 |
| T05 | `ink-3` on `surface-1` | past icon (grey stroke) | 5.56 | 6.82 | 3 |
| T06 | `ink-inverse` on `navy-fill` | today: icon | 13.20 | 15.03 | 3 |
| T07 | `ink-2` on `surface-3` | icon on hover / active fill | 7.29 | 7.74 | 3 |
| T08 | `ink-1` on `surface-3` | number on hover / active fill | 11.90 | 11.49 | 4.5 |
| T09 | `accent` on `surface-2` | red dash and red top bar on a tile | 3.96 | 6.30 | 3 |
| T10 | `accent` on `surface-1` | red top bar on a past (transparent) tile and against the page | 4.03 | 7.08 | 3 |
| T11 | `accent` on `surface-3` | red dash on hover / active fill | 3.37 | 5.42 | 3 |
| T12 | `planned-edge` on `navy-fill` | red dash and top bar on the today tile | 3.53 | 4.67 | 3 |
| T13 | `planned-edge` on `surface-1` | top bar of the today tile against the page | 4.03 | 3.22 | 3 |
| T14 | `ink-1` on `surface-2` | tomorrow frame against the tile fill | 13.99 | 13.37 | 3 |
| T15 | `ink-1` on `surface-1` | tomorrow frame against the page | 14.22 | 15.03 | 3 |
| T16 | `navy-fill` on `surface-1` | today fill against the page | 14.22 | 15.03 | 3 |
| T17 | `ink-1` on `surface-2` | selected ring | 13.99 | 13.37 | 3 |
| T18 | `ink-inverse` on `navy-fill` | selected ring on today | 13.20 | 15.03 | 3 |
| T19 / T20 | `sunday` / `saturday` on `surface-2` | Sun, holiday 「祝」, Sat number on a tile (= P25, P23) | 6.23 / 6.62 | 7.52 / 7.25 | 4.5 |
| T21 / T22 | `sunday` / `saturday` on `surface-1` | the same on a past (transparent) tile (= P24, P22) | 6.33 / 6.73 | 8.45 / 8.15 | 4.5 |
| T25 / T26 | `focus-ring` on `focus-halo` / `surface-1` | focus ring on any tile / against the page (= U12, U10) | 6.09 / 6.09 | 8.15 / 8.15 | 3 |

  Why `planned-edge` on the today tile: `accent` on the dark-theme cream fill would be 2.12:1 (already a rejected pair); `planned-edge` is the existing deeper red made for exactly this surface (T12 4.67 dark). The lowest new pair is T11 (red dash on the hover fill, light, 3.37:1), above the 3:1 floor; the lowest new text pair is T02 (5.56:1). Saturday / Sunday numbers are never drawn on the today tile (they turn `ink-inverse`), so no blue or red on navy exists. The hairline `line-1` border of a tile stays decorative (as in §2). T01-T26 are not added to the main 68-pair table; they re-use its values.
