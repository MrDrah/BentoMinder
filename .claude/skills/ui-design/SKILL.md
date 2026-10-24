---
name: ui-design
description: Produce a design system and specs a developer can build without guessing — tokens in JSON and CSS (light and dark), component specs with every state, flows mapped to story IDs, an accessibility/responsive spec with a contrast audit, and a verbatim microcopy sheet. Use before any UI is built or when a new screen is added.
---

# UI design

Output lives in `design/`. Order matters: tokens → components → flows → a11y → copy → preview.

## 1. Tokens (`design/tokens.json` + `design/tokens.css`)
- Colour roles, not raw colours: `--surface-1..3`, `--ink-1..3`, `--accent`, `--accent-ink`, `--danger`, `--info`, `--success`, `--focus-ring`.
- Light and dark sets from day one (`:root` + `[data-theme="dark"]` + `prefers-color-scheme`).
- Type scale, 4px spacing scale, radii, elevation, motion durations/easings, and a `prefers-reduced-motion` override.
- The app's CSS uses only token variables. A raw hex in `src/` is a review comment.

## 2. Components (`design/components.md`)
For each: anatomy, sizes, and the states **default, hover, focus-visible, active, disabled, error, loading, empty**. Mobile and desktop. `data-testid` names QA will use.
Common ones to always consider: input with validation, primary/secondary CTA, card, dialog/sheet, list/grid with 0/1/many items, toast/inline message, empty state, error state.
(v1) Auth forms, account menu, profile, destructive-action confirm.

## 3. Flows (`design/flows.md`)
Happy path, every error path, empty and fallback paths, reload/back. Each step cites story IDs (`US-E1-03`). A flow with no story ID is either missing a story or out of scope.

## 4. Accessibility & responsive (`design/a11y-responsive.md`)
- Breakpoints (default 360 / 768 / 1024 / 1440).
- Keyboard map; ARIA pattern per component (combobox, dialog, listbox…); live regions for errors and result counts.
- **Contrast audit table:** every text/background pair with its ratio. ≥ 4.5:1 text, ≥ 3:1 large text and UI parts. Bright accents on light surfaces usually fail: use dark ink on accent fills.
- Target: WCAG 2.1 AA, verified later by axe in e2e (0 serious/critical).

## 5. Copy (`design/copy.md`)
Every user-facing string: labels, hints, errors, empty states, confirmations. Friendly, concise, specific. The developer imports them from one module and uses them verbatim; QA asserts on them.

## 6. Preview (`design/preview.html`)
A static page that renders tokens and components in both themes, so the product owner can react before code exists.

## Gate H2
Tokens (JSON + CSS, both themes) · every component state · flows ↔ story IDs · contrast audit all passing · copy sheet complete.
