# Motion spec (2026-11-11)

Calm, quick, phone-first. Motion confirms "your tap registered" and "something appeared from there"; it never decorates. Developer builds this in one CSS-only slice. Tokens: `design/tokens.css` / `tokens.json` (existing `--duration-fast 120ms`, `--duration-base 200ms`, `--ease-standard`, `--ease-enter`, `--ease-exit`; added `--duration-sheet 240ms`, `--rise-offset 12px`, `--press-scale 0.97`). All zero out under `prefers-reduced-motion: reduce`.

## 1. Rules (all motion)
1. Animate `transform` and `opacity` only (plus `background-color`/`color` for hover/press fills). Never `height`, `top`, `margin`, `box-shadow` size. Exception: the existing about reveal keeps `max-height` (see 4.3) because it already ships and the content height is unknown.
2. No animation may delay interaction: the target is interactive from frame 1; no entrance longer than 250 ms (`--duration-sheet` 240 ms is the ceiling). `--duration-slow` 320 ms is not used for UI.
3. Focus is never moved or lost by animation. Focus moves exactly as today (title / first control on mount); animating does not change DOM order, `hidden`, or `inert`.
4. No looping motion except the existing spinner/progress (already reduced-motion safe). No bounce, no overshoot, no parallax.
5. Entrance easing `--ease-enter`; state-change easing `--ease-standard`; exit easing `--ease-exit`.
6. Every keyframe/transition that moves or fades is written inside `@media (prefers-reduced-motion: no-preference)` (or uses the zeroed tokens). Never rely on a 0 ms duration alone for tests (section 6).

## 2. Hover and press (buttons and tappable rows)
Hover colours already exist in `forms.css`; this adds the transition and a press scale.

| Element | Transition (all 120 ms `--ease-standard`) | Pressed (`:active`) |
|---|---|---|
| `.btn` (all variants) | `background-color, color, border-color, transform` | `transform: scale(var(--press-scale))` plus the existing active fill |
| `.btn--primary` | hover to `--accent-strong-hover` | scale 0.97 + `--accent-strong-hover` |
| `.btn--secondary`, plain `.btn` | hover to `--surface-3` | scale 0.97 + `--surface-3` |
| `.btn--destructive` | hover to `--danger-strong-hover` | scale 0.97 + same |
| `.btn--text`, `.btn--destructive-text` | none on scale | no scale (text pill) ; fill `--surface-3` fades in 120 ms |
| `.iconbtn`, `.monthnav .iconbtn`, `.chip`, `.switch` | background fade | scale 0.94 for icon buttons (small target), 0.97 chips; switch knob keeps its existing 120 ms slide |
| Calendar day cell `.cell` (button) | none on hover | background `--surface-3` fades in 120 ms; scale 0.98 on the tile |

- `transform-origin: center`. Release returns over 120 ms. Disabled (`[aria-disabled=true]`, `:disabled`, `.is-disabled`) and `[aria-busy=true]`: no press scale, no transition (`transform: none`).
- Hover rules stay inside `@media (hover: hover)` as today (no sticky hover on touch).
- Touch feedback must be visible on a quick tap (under 120 ms): apply the `:active` style with no delay on entry (`transition-duration: 0ms` on `:active`, 120 ms on release), so the press is seen even when the finger lifts at once.
- Focus ring is unaffected: scale never clips it (the ring is `outline`, outside the transform box; if clipped by an `overflow:hidden` parent, that is a bug).

## 3. Entrance / exit

### 3.1 Phone (below 768): bottom sheets
Applies to `.sheet` (DaySheet, SyncStatus sheet) and the sheet-style PlanPicker.
- Sheet: `@keyframes sheet-up { from { transform: translateY(100%) } to { transform: none } }`, `var(--duration-sheet) var(--ease-enter) both`. Travels from fully below the viewport (100%), not 24 px; `--sheet-offset` is for dialogs only.
- Scrim `.sheet-scrim`: `@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }`, `var(--duration-base) var(--ease-standard)`.
- The sheet's content is fully rendered and tappable during the slide (a tap on the scrim in the first 240 ms still closes it).

### 3.2 Dialogs and popovers (768 and up)
- `.sheet` at 768-1279 (centred): keyframes MUST include the centring translate, because the base rule uses `transform: translate(-50%, -50%)`: `from { opacity:0; transform: translate(-50%, calc(-50% + var(--rise-offset))) } to { opacity:1; transform: translate(-50%, -50%) }`, `var(--duration-sheet) var(--ease-enter)`.
- `.dialog` inside `.scrim` (ShareSheet, lost-list, consent, family dialogs, DateFixSheet, confirm dialogs): `from { opacity:0; transform: translateY(var(--rise-offset)) } to { opacity:1; transform: none }`, same timing. `.scrim` fades in at `--duration-base`. On phones `.dialog` also uses this (it is centred, not a bottom sheet); full-screen consent (`.consent`) fades only (no rise).
- Side panel (`.sheet--panel`, 1280 and up, in-flow `role=region`): opacity fade only, `--duration-base`; no slide (it is part of the page, not an overlay).
- Weekly/Today banners keep the existing `reminder-in` 200 ms fade.

### 3.3 About pull-down
Keep `about-in` (opacity + `max-height` 0 to 600 px, 200 ms). Retarget to tokens: `var(--duration-base) var(--ease-enter)`. On >=768 (fixed popover) use the dialog rise instead of `max-height` (no layout animation on the fixed variant). Keep it inside `no-preference`.

### 3.4 Exit
All overlays are unmounted on close (conditional rendering), so CSS-only exit is not achievable without JS timing. Decision: instant close is acceptable and is the spec. Closing must not wait for any animation (a close that waits would break rule 2 and focus return). Optional later enhancement (not in this slice): none.

## 4. Calendar
- Day tap: press feedback only (section 2); the sheet entrance is the response. The selected-day ring/fill changes without transition (state must be readable instantly).
- Month change (prev/next/today): the grid cross-fades: on month change set a `key` on the grid wrapper so it remounts with `@keyframes fade-in` `--duration-fast` (120 ms), opacity only, no horizontal slide (slide direction would need swipe state and fights screen readers' reading order). Month title updates instantly. `aria-live` announcement unchanged.
- Today-jump and data refresh: no animation.

## 5. Reduced motion (`prefers-reduced-motion: reduce`)
- The tokens zero out (`--duration-*`, `--rise-offset`, `--sheet-offset`, `--press-scale: 1`). All new keyframes live in `no-preference` blocks, so no animation or transition is created at all.
- Colour change on hover/press stays (it is not motion) but is instant (0 ms).
- Opacity-only fades are also removed (simplest, matches existing tests).
- Existing tests expect no animation. What they can still assert under `reduce`: `document.getAnimations().length === 0` right after opening any sheet/dialog; computed `animation-name: none` and `transition-duration: 0s` on `.sheet`, `.sheet-scrim`, `.dialog`, `.scrim`, `.btn`; computed `transform: none` on `.btn:active` (use `page.mouse.down()`); the dialog is at its final position immediately (bounding box equal to a second read 50 ms later). `expectNoSeriousAxe` already waits for `getAnimations()` to finish, so it also passes under `no-preference`.

## 6. Files and selectors to change (one slice)
1. `src/ui/styles/forms.css` (buttons, ~lines 7-120): add `transition` to `.btn`; add `transform: scale(var(--press-scale))` to the five `:active` rules for primary / secondary / destructive / plain (not text variants); `.btn[aria-disabled=true], .btn:disabled, .btn.is-disabled, .btn[aria-busy=true]` get `transform: none; transition: none`. `.scrim` and `.dialog` (~lines 411-430): add `dialog-in` / `fade-in` animations in a `no-preference` block.
2. `src/ui/styles/global.css`: `.iconbtn`, `.chip` transition and pressed scale; `.about` (line 218): switch to tokens; `>=768` fixed `.about`: rise instead of `max-height`; `.monthnav` grid wrapper fade.
3. `src/ui/styles/calendar.css`: `.sheet`, `.sheet-scrim` (line 580) keyframes `sheet-up`, `fade-in`; 768-1279 override keyframe `sheet-in-centred` (carries the translate); 1280 `.sheet--panel` fade only; `.cell` press.
4. `src/ui/styles/family.css`: `.consent` fade-only override.
5. `src/ui/calendar/CalendarHome.tsx` (or the grid parent): `key={monthKey}` on the grid wrapper for the month fade. No other TSX change; DaySheet, ShareSheet, DateFixSheet, PlanPicker, SyncStatus, lost-list, family and consent dialogs inherit via the shared classes.
6. Add a shared `@keyframes` block (`fade-in`, `sheet-up`, `dialog-in`, `sheet-in-centred`) once, in `global.css`. Import `design/tokens.css` values already in `src`; mirror the three new tokens into the src tokens file.
7. Keep `.switch__knob`, `reminder-in`, spinner and progress unchanged.

## 7. Proposed story: US-E16-01 Motion (BA files it)
As a parent using BentoMinder on my phone, I want buttons to feel pressed and dialogs to appear smoothly, so that taps feel registered and screens do not jump.
- AC1: Given a primary, secondary or destructive button, when pressed, then it scales to 0.97 and shows its pressed fill, and returns on release; disabled and busy buttons do not scale.
- AC2: Given a phone width (below 768), when a sheet opens, then it slides up from the bottom edge over at most 250 ms while the backdrop fades in, and its controls are usable and focus is on its title/first control from the first frame.
- AC3: Given 768 px or wider, when a dialog opens, then it fades in with a rise of 12 px or less in at most 250 ms and stays centred throughout.
- AC4: Given any overlay, when it closes, then it is removed immediately and focus returns to the opener (no exit animation).
- AC5: Given the month changes, then the grid fades in over 120 ms or less with no horizontal movement, and the month announcement is unchanged.
- AC6: Given prefers-reduced-motion: reduce, when any button is pressed or any sheet, dialog or about panel opens, then no animation or transition runs (`getAnimations()` is empty) and elements are at their final position at once.
- AC7: Given any motion, then only transform, opacity and colour properties are animated (the about phone reveal excepted), and none lasts longer than 250 ms.
- Test hints: AC1/AC6 computed style plus `getAnimations()`; AC2/AC3 `emulateMedia({reducedMotion:'no-preference'})`, open, read `getAnimations()` durations <= 250; AC4 close then `toHaveCount(0)` immediately and `toBeFocused()` on the opener.
