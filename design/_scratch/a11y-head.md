# BentoMinder: accessibility and responsive spec v1.0

> Status: **H2 final**, 2026-10-24. Target: **WCAG 2.1 AA** on every MVP screen in ja and en, light and dark (US-NF-02, US-E8-05/AC3), verified later by axe in e2e (0 serious/critical) and the keyboard-only E0 journey. Components: `design/components.md`. Strings: `design/copy.md`. Tokens: `design/tokens.json` (source) / `design/tokens.css` (generated).

## 1. Principles that decide disputes
1. **Meaning never rides on colour alone** (§3). Every state has a shape, an icon or a word.
2. **One focus style everywhere**, never removed (§4).
3. **Everything the journey needs works with a keyboard and a screen reader** (§5, §7), including the calendar.
4. **Japanese text is set as Japanese** (§9): no mechanical truncation, kinsoku rules on, 12 px minimum.
5. **Small screens and big text get a different layout, not a broken one** (§6): the calendar becomes a list.

## 2. Contrast audit

Computed with the WCAG 2.1 relative-luminance formula from the hex values in `design/tokens.json` by `design/_scratch/contrast.mjs` (re-run after any token change; it exits non-zero on a failure). `surface-1` is pure white `#FFFFFF` (PO 2026-10-24). Thresholds: **4.5:1** for text (all our text is treated as normal size, even headings), **3:1** for UI parts, icons that carry meaning and focus indicators.

**Result: 68 pairs × 2 themes = 136 checks, 0 failures.**
- Lowest text pair: **P09 `ink-3` on `surface-3` = 4.65:1** (light; disabled text). Next: P13 `ink-inverse` on `accent-strong` = 4.96:1 (primary button).
- Lowest UI pair: **U03 `line-ui` on `surface-3` = 3.07:1** (light; dashed border of a disabled control).
- Dark theme: `line-ui` changed from the direction's `#7D7A72` to **`#8A877E`** so control borders pass on `surface-3` (3.66:1); `planned-edge` added (light `#D2574F`, dark `#B8443C`) because the soft red top edge on the cream planned cell was 2.12:1 in dark.

