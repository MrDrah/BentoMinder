Scratch (developer, kick-off architecture)
- Done: ADR 001, ADR 003. Next: ADR 004, architecture.md.
- Finding: validate.mjs overlap `words()` matches only [a-z0-9'] -> Japanese text yields 0 words, so overlap never flags copied Japanese prose. Also only string fields are checked (arrays skipped). Framework lesson for the Orchestrator.
- Node 20 EOL April 2026; recommend preflight.nodeMajor 22 (type stripping >= 22.18).
- All four files written. Report sent.

Scratch (developer, H1 ADR alignment, 2026-10-24)
- Plan: 002 (R-1, region) -> 004 (R-2, R-3, BR-04/09/16/17) -> 005 (R-4) -> 001/003 -> architecture §11 M0.
- Findings to report (not editing BA files):
  1. R-3 "incomplete allergen data" undefined in contract; almost every Japanese seasoning (しょうゆ, みそ, だし) is `varies` -> if incomplete = has varies ingredient, an allergic child gets ~0 recipes. ADR 004 defines incomplete = fails per-ingredient completeness or allergenScheme != current; varies-by-product handled by mayContain filter (BR-06/OQ-13).
  2. Contract root store has no ownerId/deviceId (additionalProperties false) but PLAN §1 seam says all records carry ownerId -> ask BA for root `ownerId`.
  3. Settings has no weekStart -> BA to add `settings.weekStart`.
  4. State machine table: on a bento-day, 給食に戻す makes no sense -> proposed CLEAR_PLAN back to derived no-school-lunch.
  5. overlap fields: localized arrays need indexed dotted paths; Japanese invisible to tokenizer.
- H1 alignment done: ADR 001/002/003/004 accepted, 005 web accepted (Android proposed), architecture §10/§11 written. ADRs follow the BA contract update (ownerId meta, weekStartsOn, theme, shortName, allergenDataComplete, decision-bento-day-remove).
