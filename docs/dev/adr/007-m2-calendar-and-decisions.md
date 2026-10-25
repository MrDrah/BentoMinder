# ADR-007: M2 calendar, assessment display and parent decisions

Status: **accepted** · 2026-10-25 · Owner: Developer

Builds on ADR 004 (engines; it stays the rule reference) and ADR 003 (store, D-M1-06). Binding rules: BR-01 to BR-05, BR-13, BR-19, BR-25, BR-27.

## Context
M2 puts the assessment and the decision state machine in front of the parent: a month calendar, a day sheet, overrides, decisions, and a review list after a menu refresh. The design choices below are the ones ADR 004 left open or that changed while building.

## Decisions
1. **Matcher.** `src/domain/assessment/matcher.ts` follows dictionary section 7 exactly: normalise, dish pass (longest match), then ingredient/category pass; ambiguity-group forms stay unresolved unless a section 7 rule or the item's `resolvedIds` (from review) settles them. Unresolved items count towards U only (B5). The ambiguity chooser in review writes `resolvedIds`; the matcher uses them as-is.
2. **Assessment.** `assess.ts` implements the BR-04 table in order, with no-lunch before override (B6) and exact rational U. Output carries explanation keys and params, never display strings. The assessor takes no decision input (BR-01); a type-level test and a property test guard this.
3. **Override (BR-27 for the write path).** `override.ts` writes one record per date, never for past dates, never for a no-lunch date. An override survives reload, profile edit and refresh; on a no-lunch or removed date it is dormant and returns unchanged. The day sheet shows "you set / app suggestion" from `calculatedState`.
4. **Decision state machine.** `decision.ts` is the only writer of `decisions` (ADR 004 section 2). `apply.ts` wraps `transition` for the UI: it builds the `DayContext` from the stored menu, runs the transition, and saves through the repository. `KEEP_PLAN`, `CLEAR_PLAN`, `plannedAt` and refresh conflicts are as in ADR 004. Assessment never feeds `transition`.
5. **Refresh review.** `menu/refresh.ts` (`refreshReview`) is read-only on the records. After a refresh the app ends on the review list (US-E3-05 AC13: the AC wins over the design's "straight to calendar"). Each row offers keep or clear for plans in conflict.
6. **Calendar grid.** `calendar/day-view.ts` derives each cell (assessment, shown decision, conflict, flags) as a pure function; `CalendarGrid.tsx` renders `role=grid` with one tab stop and arrow, Home/End and PageUp/PageDown keys. Week start (Monday or Sunday) is a setting. Assessment and decision are drawn apart (colour plus text plus icon, never colour alone). `CellName.tsx` writes the accessible cell name as visually hidden content with `lang="ja"` on Japanese fragments, because `aria-label` cannot carry a per-fragment language.
7. **Day sheet.** One component, three presentations (sheet, dialog, panel) by width. Opening the recommendation view changes nothing (US-E5-03 AC1, AC3); in M2 that view is an empty placeholder.
8. **D-M1-06 for decision edits.** A save refused because another tab wrote first **reloads the stored version and shows the "not saved" toast; the edit is not re-applied** on top of the reloaded store. ADR 003 allowed re-applying the edited day if M2 needed per-day merge. It does not: a decision is a single parent intent made on what the screen showed, and re-applying it to a changed store could silently contradict the other tab's decision (for example a bento plan over a defer made seconds earlier). The same rule covers overrides and settings. Tests: `tests/e2e/m2-calendar.spec.ts` (two tabs, with and without the storage event).
9. **Settings link with nothing set up.** A bare `#/settings` with no profile and no menu still redirects to onboarding; `#/settings?from=onboarding` opens settings. This keeps the M1 behaviour (D-M1-03) and gives onboarding a way in.

## Alternatives considered
| Option | Why not |
|--------|---------|
| Re-apply the refused decision after reload | Can contradict the other tab's choice without the parent seeing it (decision 8) |
| `aria-label` for cell names | One language per attribute; mixed ja/en names are read in the wrong voice |
| Calendar derived inside the component | Not testable without the DOM; the pure `day-view` is covered by property tests |
| Show the calendar straight after a refresh | Contradicts AC13; the parent would miss conflicts |

## Consequences
- The M2 rules are pure and fixture-tested (domain unit and property tests, FX-01 check 7/5/5/2); the UI tests and the M2 e2e suite cover the screens.
- A refused save always costs the parent one repeat of the edit; acceptable while one family uses one browser profile.
- Not built in M2 (out of scope, open items): holidays (no sourced list), the amb-soba review flag (no copy), recommendations (M3), the popover date picker (a centred dialog is used), the Today card and reminders (M4).

## Revisit when
- v1 family sync defines a real conflict policy: replace decision 8 with per-day merge (ADR 003 seam: `updatedAt`, `deviceId`).
- Parents report lost edits in the two-tab case.
- A sourced holiday list exists: add holidays as a day kind (ADR 004 section 2 `DayContext`).

## Change log
- 2026-10-25 · accepted (M2).
