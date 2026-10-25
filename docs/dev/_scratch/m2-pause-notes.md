# M2 pause notes (developer)

Branch worktree-agent-a04d875d3e81d2b8f.

## Done
- Domain: matcher (dictionary section 7 rules), assessment (BR-04, collapse, precedence, explanation keys), overrides (BR-27), decision state machine (KEEP_PLAN, plannedAt, dormant, conflicts), refresh review, review date move, resolvedIds, day viewer and upcoming summary. Property tests (fast-check). FX-01 check 7/5/5/2.
- Code-side items: RULES_NOT_IN_CONTRACT empty; confirmedMenuSchema checks; resolved-ids-candidates / review-date-correction / override-no-past-write implemented; US-E10-02 tests renamed AC8 (and the m1-data title).
- UI: role=grid calendar with keyboard, cells, day sheet (sheet/dialog/panel), override, decisions and dialogs, upcoming, legend, agenda, next-month card, refresh review list and settings link, date-fix sheet, ambiguity chooser, settings (week start, prompt day, onboarding entry with ?from=), picker kind labels.
- Tests: unit (domain and ui), e2e tests/e2e/m2-calendar.spec.ts (22 pass). Dev gate was green before the last two edits; QA M1 suite 446 passed / 0 failed after them.

## Committed as WIP at pause
- CellName.tsx (cell name as visually hidden content with lang=ja fragments), App.tsx (bare #/settings with nothing set up still redirects to onboarding unless ?from=; keeps the QA m1-data D-M1-03 test green).

## Known / left
- Run `gate --stage dev` once more (last full run was before the CellName and App edits). One UI unit test failed once under load and passed on rerun; not identified.
- ADR 004 change log and a new ADR (M2 decisions, D-M1-06 for decision edits) NOT written. PLAN and CATCH-UP untouched (Orchestrator).
- Not built: holidays (no sourced list), amb-soba review flag (no copy), recommendation view is an empty M3 placeholder (the bento action writes nothing), popover form of the date picker (centred dialog used), Today card and reminders (M4).
- D-M1-06 decision for decision edits: a refused save reloads the stored version and shows the toast; no re-apply (e2e two-tab tests). To record in ADR 003/004.
- Questions for BA/PO: AC13 empty list screen shown after a refresh (AC wins over design), upcoming "next 7 days" = today to today+6, English food labels lower-cased inside sentences, placeholder {wdLongEn} renamed {wdLong} in en.

## Next step
Run the dev gate, write ADR 007 and the ADR 004 change log, then send the final report.
