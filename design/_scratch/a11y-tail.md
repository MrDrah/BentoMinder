
**Pairs deliberately not in the table (not text, not needed to identify a control):**
- `line-1` hairlines and the 1 px border of calendar cells and cards (1.3:1 on white). They are decoration: a cell is identified by its numeral and words (≥ 5.47:1), a card by its heading. Inputs, checkboxes, radios, switches, chips and secondary buttons always use `line-ui` or `ink-1` borders (U01–U04).
- The diagonal hatch (`line-1` stripes): its meaning ("no school lunch") is also carried by the word 「給食なし」/「お弁当の日」 on a `surface-2` pill (P43 worst case shown).
- Stripe bands and illustrations (`illus-*`): decorative, `aria-hidden`, never carry text.
- Scrim: not a text background.
- Disabled controls: WCAG exempts them, but we still keep their text ≥ 4.5:1 (P09) and their border ≥ 3:1 (U03).

**Rejected pairs (never specify):** `ink-inverse` on `accent` (3.96:1, why `accent-strong` exists); `accent` as text on any surface; `line-1` as a control border; `accent` on `navy-fill` in dark (2.12:1, replaced by `planned-edge`); `ink-3` on `accent-soft` (not used).

## 3. State never relies on colour alone

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
| Uncertain review field | warning fill and border | 「要確認」 tag + triangle icon + reason text | US-E3-01/AC2 |
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
| R2 Recipe | back → (planned banner, no stop) → source links in reading order → 農林水産省 credit link → sticky footer action(s) (last) |
| R3 Library | back → rows in order → (plan-date picker: title → options → この日に決定 → close) |
| S1 Profile | back (not on step 1) → nickname → age chips (radio group: one stop, arrows) → likes search → selected chips' remove buttons → popular chips → dislikes (same) → allergy radio group → allergen chips (9, then 20) → other-foods search → diet chips → theme chips → note → 次へ. On a failed 次へ: focus to the first invalid group |
| S2 Import | back → month select → URL → 取り込む → PDFファイルを選ぶ → くわしく見る → 手入力する → あとで取り込む. After an error: focus moves to the error panel (heading), then its actions |
| S2c Consent | dialog title → link → 同意しない → 同意して読み取る (initial focus on the title so the text is read first) |
| S2p Progress | headline (focused, status) → 中止する |
| S3 Review | back → summary → 次の要確認へ → 元のPDFを見る → day rows in date order (per row: dish inputs → their remove buttons → このままでよい → 料理を追加 → 給食なしの日にする / reason radios → 献立表での書き方) → out-of-month disclosure → この内容で確定 (sticky, last). 次の要確認へ moves focus to the next uncertain field and scrolls it above the footer |
| S3r Needs-review list | title → rows (開く) → カレンダーへ |
| P1 Settings | back → sections top to bottom; within お知らせ: switch → 曜日 → 時 → 分 → next row; 表示: 言語 → 週のはじまり → テーマ; 献立表; プロフィール; データ; このアプリについて |
| H1 Share | title → preview (focusable `tabindex="0"` read-only region so it can be read and selected) → 共有する → コピーする → close |
| Dialogs | initial focus on the least destructive action (キャンセル / 戻る / 編集を続ける); trap inside; Esc = cancel; focus returns to the trigger |
| X1 Debug | Debug pill is the last tab stop of every screen (dev only); panel order top to bottom |

## 5. Keyboard map and ARIA patterns

| Component | Pattern | Keys |
|---|---|---|
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
| Storage unavailable | assertive, once | all |

## 6. Screen-reader names for calendar cells

Built from `copy.md` §8 (`cell.aria*`), one full sentence per cell button, no colour words, no "button" in the text:

| Cell | ja | en |
|---|---|---|
| School day, low preference, school lunch (US-NF-02/AC4 example) | 11月4日（水）、苦手かも、給食 | Wed, Nov 4, might not enjoy, school lunch |
| Today, planned, overridden | 今日、11月18日（水）、苦手かも、手作りお弁当：くまさんおにぎり弁当、手動で変更 | Today, Wed, Nov 18, might not enjoy, homemade bento: Bear onigiri bento, changed by you |
| Not confirmed | 11月20日（金）、どちらとも、未定 | Fri, Nov 20, hard to say, not decided |
| Planned, refresh conflict | 11月25日（水）、給食なし、手作りお弁当：星のミニハンバーグ弁当、献立が変わりました | Wed, Nov 25, no school lunch, homemade bento: Star mini hamburg bento, menu changed |
| Planned, recipe has a registered allergen | 11月26日（木）、たのしめそう、手作りお弁当：…、アレルゲン注意 | …, allergen alert |
| Not assessed | 11月30日（月）、未判定、給食 | Mon, Nov 30, not assessed, school lunch |
| No-lunch day | 11月27日（金）、給食なし（午前保育（給食なし）） | Fri, Nov 27, no school lunch (午前保育（給食なし）) |
| Bento day, not planned | 11月20日（金）、お弁当の日、未計画 | Fri, Nov 20, bento day, not planned |
| Holiday outside the menu | 11月3日（火）、文化の日、献立に記載なし | Tue, Nov 3, Culture Day, not on the menu |
| Weekend | 11月7日（土）、献立に記載なし | Sat, Nov 7, not on the menu |
| Month without a menu | 12月1日（火）、献立未取り込み | Tue, Dec 1, menu not imported |
| Past | …、過去の日 (suffix) | …, past day |

The planned cell uses the **full** recipe name (US-E5-01/AC4); missing recipe → `recipeNameSnapshot`. Menu dish names inside sentences keep `lang="ja"` in EN mode. The grid's `aria-label` is 「2026年11月のカレンダー」; column headers carry the long weekday (`aria-label="水曜日"`).

## 7. Touch targets and pointer

- Every interactive element ≥ **44 × 44 CSS px at 360 px width** (US-NF-02/AC3): buttons 52 px tall; icon buttons, chips, checkboxes, radios and switches have 44 px hit areas (padding or a pseudo-element when the visual is smaller, e.g. the 36 px language toggle); calendar weekend columns have `min-width: 44px` and rows ≥ 44 px (compact weekend-only rows are 44 px, never 34 px as in the direction draft).
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
| Calendar cell words and recipe short names | `max-inline-size: 4em; line-break: strict; word-break: normal; letter-spacing: 0; text-align: center` | Curated `shortNameJa` ≤ 8 chars sets as 2 lines × 4 (「くまさん / おにぎり」); never mechanical truncation or ellipsis (US-E5-01/AC4) |
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
