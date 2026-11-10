

---

## 17. UI refresh 2026-11 (PO request 2026-11-10: "not very breathy; the calendar should be more in focus; the explanation as a pull-down or pop-up; more space between blocks; mobile friendly, SP oriented")

> Status: design proposal for the developer. **Layout, spacing and disclosure only: no rule, string meaning, state, test id or story outcome changes.** Where this section and §1–§16 disagree on size, spacing, order or default-open state, this section wins; everything else in §1–§16 stands. CSS-level guidance, impact on tests and the per-screen change list: `design/ui-refresh-2026-11.md`. Screens captured before the change: `docs/dev/_scratch/ui-refresh/before/`. Preview: `design/preview/index.html`, slot (h).

### 17.0 What "the explanation of the logo" is (interpretation, PO to confirm)
The home screen has no text next to the brand mark. The two explanatory things a parent meets are (a) the legend 「表示の見かた」 (§2.8: what the cell marks mean; it opens **expanded** until the first bento is planned and is a long list that pushes a new user's calendar down), and (b) the tagline 「おべんとう、忘れない。」 and the 「このアプリについて」 block, which today live only on the login screen and in Settings. This refresh handles both with the **same disclosure pattern**: (1) a new brand-info disclosure in the app bar (§17.2) that answers "what is this app?", and (2) the legend becomes closed by default, behind a visible button under the calendar (§17.5). If the PO meant only one of the two, the other is left as it is today (Decision D1).

### 17.1 Principles
1. **The month is the hero.** On 390 × 844 the whole month grid is visible without scrolling and starts within about 130 px of the top; nothing informational sits above it. Only things that need action now (alerts) may sit above, and they are compact.
2. **Space separates, borders don't.** Blocks are separated by a vertical rhythm (§17.3), not by extra boxes. Cards keep one 1 px `line-1` border; wrappers that were boxes inside boxes lose theirs.
3. **Phone first.** 390 px is designed first (single column, primary actions in thumb reach, sticky bottom action bar where a screen has one primary action, safe-area insets, no horizontal scroll at 320). 768 and 1280 are enhancements: centred max width; side by side only for the calendar plus day panel at ≥ 1280.
4. **Reuse.** Two new pieces only: the brand-info disclosure (§17.2) and the sticky action bar (§17.6). Everything else is existing components with new sizes and spacing.

### 17.2 Brand-info disclosure (new; 「このアプリについて」)
Anatomy: **trigger** = the brand block of the app bar becomes one `<button>` (logo 36 px decorative + brand name + ⓘ icon). **Panel** = a region directly after the app bar in the DOM: heading (`app.tagline`, h2, `text-lg`) · two short paragraphs (`about.body.1`, `about.body.2`, `text-md`, `ink-2`, line length at most 36 em) · a text button 「AIでの読み取りについて」 (`settings.about.consent`, opens the existing consent dialog §6.7) · version line (`settings.about.version`, `text-sm`, `ink-3`) · 「閉じる」 text button (`common.close`, 44 px high, right-aligned).

| | 390 (and < 768) | 768–1279 and ≥ 1280 |
|---|---|---|
| Trigger | 44 × 44 box: logo 36 px with a 16 px ⓘ badge at its lower right (`surface-1` disc, `ink-1` glyph). Brand name hidden below 400 px as before (§1.1); at ≥ 400 the name shows and a 20 px ⓘ follows it; the box grows to fit, min height 44 | name + 20 px ⓘ, hover `surface-3` pill |
| Panel presentation | **Inline pull-down**: in normal flow under the app bar stripe, full width, pushes the page down (`surface-2`, 20 px padding, bottom border 1 px `line-1`, no shadow); height animates 200 ms (none with reduced motion) | **Popover**: absolutely positioned under the brand, left-aligned to it, 360 px wide, `radius-lg`, `elevation-2`, `surface-1`, 24 px padding, `z-appbar` + 1. Non-modal: no scrim, no focus trap |
| Closes on | trigger again, 「閉じる」, Esc, navigating to another screen | same, plus a click or tap outside |
| Default | **closed on every load.** Never remembered (it is an explanation, not a setting). Decision D2 if the PO wants it remembered | same |

Markup contract: `<button aria-expanded="true|false" aria-controls="about-panel" data-testid="about-toggle">` with accessible name `about.open` (set with `aria-label` so the 390 px logo-only box has a name; at ≥ 400 the visible text 「BentoMinder」 is part of the label, so `about.open` is the same words as the visible ones plus the purpose: see `copy.md` §23: the label contains the visible name, WCAG 2.5.3); panel `<section id="about-panel" role="region" aria-labelledby="about-heading" hidden>` with `data-testid="about-panel"`. The same DOM serves both presentations; only CSS differs, so tests do not depend on the viewport. Opening does **not** move focus (the panel follows the trigger in tab order, so the next Tab enters it). Closing with Esc, 「閉じる」 or the trigger returns focus to the trigger. No live region (the user caused the change and `aria-expanded` announces it).

States: default (closed); hover (`surface-3` pill, `(hover: hover)` only); focus-visible (global ring, 2 px offset; the app bar must not clip it: `overflow: visible`); active (`surface-3`); open (`aria-expanded="true"`; the ⓘ badge is filled `ink-1` with an `ink-inverse` glyph, so open/closed is not colour only; at ≥ 400 px a small chevron after the ⓘ points up when open, with no rotation animation under reduced motion); disabled n/a (always available); loading n/a (static text, version is build time); error n/a; empty n/a.
Where it appears: calendar home only (the only screen whose app bar shows the brand). The login and new-device screens already show the tagline in full. Other screens keep the Settings 「このアプリについて」 card unchanged. Width budget at 320: 24 padding + 44 brand button + 206 controls = 274 px, fits.
Test ids: `about-toggle`, `about-panel`, `about-close`. Stories: none changed (UI only; PO request 2026-11-10); US-NF-02 (target size, keyboard) and US-E2-08 (consent link) apply.

### 17.3 Vertical rhythm (new aliases, built only from the existing 4 px space tokens)
Defined once in `global.css` `:root` (not in `tokens.json`, because they change with the viewport):

| Alias | < 768 (390) | 768–1279 | ≥ 1280 | Use |
|---|---|---|---|---|
| `--page-gutter` | 20 px (`space-5`) | 24 px (`space-6`) | 24 px | left/right page padding (the calendar grid is the only element that bleeds, §17.4) |
| `--rhythm-block` | 24 px (`space-6`) | 32 px (`space-8`) | 40 px (`space-10`) | gap between blocks on a page: cards, banners, headings with their content |
| `--rhythm-section` | 40 px (`space-10`) | 48 px (`space-12`) | 64 px (`space-16`) | gap before a new section: the calendar to the stack below it; the destructive area of Settings; the end-of-page area |
| `--rhythm-related` | 12 px (`space-3`) | 12 px | 16 px (`space-4`) | inside a block: title to body, label to control, list rows |
| `--card-pad` | 20 px (`space-5`) | 24 px | 24 px | padding of every `.card` |

Rules: (1) `margin-bottom` on blocks is replaced by a grid `gap` on the page container (`display: grid; gap: var(--rhythm-block)`) so nothing relies on margin collapse. (2) Body text and notes never exceed `max-width: 36em` (about 36 full-width characters; keeps Japanese lines comfortable at 768 and 1280); headings, grids, tables and controls are not capped. (3) Line height stays `--leading-normal` (1.7) for body and `--leading-tight` for headings. (4) Calmer surfaces: `.card` keeps `1px line-1` on `surface-2`; `elevation-0` everywhere except sheets, popovers (`elevation-2`; the desktop day panel drops from `elevation-4` to `elevation-2`) and the sticky action bar's top edge (1 px `line-1`, no shadow). (5) Controls keep 44 px minimum height (52 px for primary and secondary buttons and inputs); the space that grows is the space **between** them: 12 px between stacked buttons (was 8), 20 px between form fields (was about 12).
Contrast: no colour changes, so the audit in `a11y-responsive.md` stands. The one new pair is the ⓘ badge (`ink-1` on `surface-1` 14.6:1; open state `ink-inverse` on `ink-1` 14.2:1).

### 17.4 Calendar home: the month grid as the hero
Order on every size (this is also the focus order): 1 app bar (brand-info trigger, §17.2) · 2 about panel (when open) · 3 **alert stack**: reminder banners (§8), storage and outdated banners (§12), the pending-review card (`card-menu-pending`) and the missing-menu card (`menu-card-missing`; with no menu the grid is numerals only and this card is the one action) · 4 month navigation · 5 **grid** · 6 **below-the-grid stack** (starts `--rhythm-section` after the grid): Today card (§2.6) · upcoming summary (§2.5) · next-month card (`card-menu-next`, dismissible, §2.7) · tools row (§17.5). Before, the Today card, menu cards and upcoming summary came first and pushed the grid to y ≈ 560 on 390 × 844.

| | 390 | 768–1279 | ≥ 1280 |
|---|---|---|---|
| Month navigation | one row, 56 px high; 8 px below the alert stack (the nav belongs to the grid); chevrons 48 × 48, title `text-xl`, 「今日」 pill (44 px) at the far right only when away from the current month | same, title centred between the chevrons | same, in the left column |
| Grid width | bleeds to 4 px gutters (as now) | column 640 px centred (the calendar home page only; other screens stay 560 px) | left column `minmax(0, 1fr)`, about 784 px, day panel 440 px (§1.12); layout max 1280 px |
| School-week row height | `--cell-min-height` 80 px (was 68) | `--cell-min-height-md` 96 px | `--cell-min-height-lg` 104 px (was 88) |
| Weekend-only or empty row | 44 px (`--cell-row-compact`, unchanged) | 44 px | 44 px |
| Gap between cells | 2 px | 4 px | 6 px |
| Column widths | weekday `minmax(0, 1fr)`; Saturday and Sunday `minmax(44px, 0.62fr)` as now (the 44 px floor keeps them tappable; at 390 a weekday cell is about 56 × 80, a weekend cell 44 × 44) | same | same |
| Cell content | date numeral `text-md` 700 (was `text-sm`) top-left; assessment mark 18 px top-right; decision word `text-xs` at the bottom; 6 px inner padding (was 3) | numeral `text-lg` | numeral `text-lg`, word `text-sm` |
| Whole month in view | yes: 56 + 8 (bar) + 56 (nav) + 28 (weekday header) + 5 school rows × 80 + weekend-only rows 44 = under 640 px of 844 (Nov 2026: 632 px), leaving room for the first line of the Today card | n/a | grid and day panel share the first screen |

Cell states (§2.4 stands; only the two treatments the PO asked about are restated):
- **Today:** the numeral sits in a 28 px `ink-1` disc with an `ink-inverse` numeral (as now) and `aria-current="date"`. New: the weekday header of today's column gets a 2 px `accent` underline (decorative; the disc is the real signal).
- **Selected** (desktop panel open, or the day whose sheet is open): `inset 0 0 0 3px ink-1` ring (on planned cells `ink-inverse`), as now. Selection is conveyed to assistive tech by the open panel's heading; no `aria-selected` is added (cells are buttons). Today and selected combine (disc plus ring) without conflict.
- All other cell states (planned navy with red top edge, not-confirmed 2 px solid, suggestion 2 px dashed `accent`, no-lunch hatch, bento-day hatch, flagged `!` badge, override underline, past, dormant, boxed) are **unchanged**. Loading (skeleton grid at the new row height), empty (numerals only) and the agenda fallback (container < 340 px) are unchanged; agenda rows are 12 px apart.
Alert stack: banners keep their text and actions; padding 12 × 16; the reminder stack's collapse rule (§8.2) is unchanged; the stack's blocks are 12 px apart (alerts are one group), then 16 px to the month nav.
Today card (below the grid at all sizes): headline `text-xl` (the status tile shrinks from 44 to 40 px); at 390 the info note under it loses its filled `info-soft` box and becomes plain `text-sm` `ink-2` text with the ⓘ icon (the card gets about 40 % shorter); the reservation checkbox row stays 44 px. Content and behaviour unchanged.
Upcoming summary: content unchanged; heading `text-lg`; rows 12 px apart (was 8).

### 17.5 Tools row and legend (end of the below-the-grid stack)
One row: **「今週の予定を共有」** (share, `btn--secondary`, 52 px, icon + text, `flex: 1 1 auto`) and **「表示の見かた」** (legend toggle, text button with the existing chevron, 44 px). At 390 they share one row when both fit and wrap to two full-width rows below 360 px. Share keeps its left edge within 40 px of the viewport edge (an existing test asserts it).
Legend (§2.8) change: **always closed by default** (the "open until the first bento is planned" rule is dropped); open state kept for the session only. Open panel: a card (`--card-pad`) under the row; one column at 390 (rows 12 px apart, swatches 32 px), two columns at ≥ 768. There is no extra first-run hint element: the Today card and the empty-state card are the first-run guidance, and the legend button is one tap away (Decision D3 offers the old "open until the first plan" instead).

### 17.6 Sticky bottom action bar (new, phones only, < 768)
Used where a screen has **one primary forward action** that today sits at the end of a long form: import (取り込む), onboarding steps (次へ), review (この内容で確定), profile edit (保存). Anatomy: bar at the bottom of the screen container, `surface-1`, 1 px `line-1` top edge, padding `space-3` `--page-gutter` `max(space-3, env(safe-area-inset-bottom))`, holding the primary button (52 px, full width) and, when the screen has one, a text button under it. It is `position: sticky; bottom: 0` inside the screen container (not `fixed`), so it never covers a focused input when the keyboard opens and it flows at the end of the content once the page is short. With 200 % text, if the bar would exceed 40 % of the viewport height it stops being sticky and flows at the end of the content. ≥ 768 it is not sticky and sits at the end of the form as today. Focus order is unchanged (the bar is last in the DOM). States are the primary button's (§1.3). Not used on the home screen (the grid is the content) or in sheets and dialogs (they have their own footers, §1.12–§1.13), except the day sheet's primary decision button (§17.7).

### 17.7 Other containers and screens (sizes and spacing only)
- **Top bar (§1.2):** unchanged size (56 px plus stripe); `--rhythm-block` below it; titles wrap as before.
- **Day sheet (§3, §1.12):** header 56 px with the close button staying in view; section spacing `--rhythm-block` (24 px) at 390 (was 20), 32 px in the dialog and the panel; the **primary** decision button is pinned at the bottom of the sheet on < 768 (the §17.6 bar inside the sheet), the other actions scroll with the body. Sheet height at most 85 dvh. Desktop side panel `elevation-2`.
- **Cards (all screens):** padding `--card-pad`; title margin `--rhythm-related`; cards `--rhythm-block` apart.
- **Recommendation cards (§4.2):** 24 px apart; the image band (an empty placeholder today, about 100 px) is 72 px high at 390 and 120 px at ≥ 768; buttons 12 px apart; the disclaimer note has `--rhythm-block` above it.
- **Recipe detail (§5.1):** sections `--rhythm-block` apart; ingredient and step lists 12 px row gap; the 「この日に決定」 action (when the screen was opened from a date) uses the §17.6 bar.
- **Library rows (§5.2):** row padding 16, rows 12 px apart (fewer rows per screen, each readable and tappable without mis-taps).
- **Import (§6.5) and review (§6.8):** field groups 20 px apart; the three buttons (取り込む, PDFファイルを選ぶ, 手入力する) 12 px apart; 取り込む moves into the §17.6 bar; the AI notice card gets `--rhythm-block` above it.
- **Settings (§9), account (§15.3) and family (§16.1) cards:** cards `--rhythm-block` apart (was 16); fields inside a card 20 px apart; switch rows 56 px high; radio choice cards 12 px apart; the destructive entry points (プロフィールを削除, すべてのデータを削除) are separated from the safe buttons of their card by `--rhythm-section`'s smaller half (20 px) plus a 1 px divider. Section order is unchanged.
- **Login (§15.1) and new-device (§16.9):** brand block in the top third (logo, wordmark, tagline, 「ようこそ」); the Google button and the privacy line sit in the **lower third** (thumb reach: the column is `min-height: 100dvh` minus safe areas, `justify-content: space-between`); at ≥ 768 a single centred column 400 px wide, vertically centred.
- **Dialogs (§1.13), toasts (§1.11), banners (§1.10):** unchanged except `--rhythm-related` spacing inside.

### 17.8 Before / after

| Area | Before (screenshots in `before/`) | After |
|---|---|---|
| Home, first screen at 390 × 844 | Today card (about 320 px), heading, upcoming card, then the month; grid starts at y ≈ 560 and ends below the fold | Month title near y = 120, whole grid in view; Today, upcoming and next-month cards below it |
| Grid cell | 68 px high, 3 px padding, `text-sm` numerals; 88 px at desktop | 80 / 96 / 104 px, 6 px padding, `text-md` numerals |
| Brand explanation | none on home; legend opens expanded on first run; app explanation only in Settings | closed pull-down (390) or popover (≥ 768) from the brand ⓘ; legend closed behind a button under the grid |
| Block spacing | 16 px between cards (24 at desktop), 8 px between title and body | 24 / 32 / 40 px between blocks, 40 / 48 / 64 px between sections, 12 px inside a block |
| Card padding | 16 (24 at desktop) | 20 / 24 / 24 |
| Page gutter | 16 px | 20 px (grid still bleeds to 4 px) |
| Borders and shadows | cards, list rows and info boxes all boxed; desktop day panel `elevation-4` | one border level; info box on the Today card becomes plain text at 390; panel `elevation-2` |
| Primary action on long forms | at the end of the form | sticky bottom bar on phones with safe-area padding |
| Login | everything at the top, lower 60 % empty | brand top, sign-in bottom (thumb reach) |
| Desktop home (1280) | cells 88 px, left column 760 px, panel 440 px, dashed empty panel | cells 104 px, left column about 784 px, same panel width, empty panel on `surface-2` without the dashed border |
| Tablet 768 | phone layout centred at 560 px | calendar home 640 px, cells 96 px, sheets as dialogs, popover for the brand info |

### 17.9 Coverage
Stories touched visually only (outcomes unchanged): US-E5-01 (grid), US-E5-02 (sheet), US-E7-01, US-E7-03, US-E7-05 (alert and Today card positions), US-E3-06 (menu cards), US-E8-01/AC2 (language toggle stays in the bar), US-E13-01 (login), US-E15 (family and sync card spacing), US-NF-02 (targets, reflow, keyboard). Per-screen changes and the test impact list: `design/ui-refresh-2026-11.md`.
