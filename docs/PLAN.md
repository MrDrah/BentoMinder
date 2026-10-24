# Plan — BentoMinder

Owner: Orchestrator · Status: **approved** (architecture, BRs, design direction, open questions) · next: H1 · 2026-10-24 · framework v0.5.0

Inputs: PO brief `docs/ba/po-brief-2026-10-24.md` · structured brief `docs/PROJECT_BRIEF.md` · stories `docs/ba/user-stories.md` (72 stories, 245 ACs) · data contract `docs/ba/data-contract.md` · open questions `docs/ba/open-questions.md` · architecture `docs/dev/architecture.md` + ADR 001–005 · research `docs/dev/research/` · design `design/`.

## 1. Product summary
**BentoMinder — おべんとう、忘れない。** A Japanese-first family app. Once a month the parent imports the kindergarten's public lunch-menu PDF; one AI call turns it into a structured menu that the parent reviews and confirms. From then on everything runs on the device with plain rules: which lunches the child may not enjoy (with a one-line reason), three ranked homemade-bento suggestions for a day, and reminders (Sunday 14:00 weekly, 17:30 the day before a bento day).

- **Core rule:** the preference assessment and the family's decision are separate, and only the parent changes a decision (BR-01, BR-02).
- **Never:** suggest a recipe with a known allergen or excluded diet item, or claim allergy safety (BR-06, BR-07). Never claim a school-lunch reservation (BR-19).

| MVP (web, local) | v1 | Later |
|------------------|----|-------|
| Onboarding: 1 child profile, PDF URL or upload, review + confirm | **Android test build** (Capacitor) with scheduled local notifications | Google Play publication |
| AI extraction via local proxy (Gemini free tier, if region allows), schema-validated, cached by PDF hash; fixtures for all tests | Hosted extractor (e.g. Cloudflare Worker free plan) so a phone can import | Synced family planning (accounts, roles) |
| Deterministic assessment + explanation + manual override | Re-import detects a changed PDF at the saved URL | Multiple children |
| Calendar: assessment vs decision visibly distinct; plan / change / cancel | Reservation reminder at the school's cut-off time | AI-generated recipes |
| 3 suggestions from 15–20 sourced recipes; recipe detail | Library growth | |
| In-app reminders + Today view; configurable times | | |
| ja (default) / EN toggle; Asia/Tokyo everywhere | | |
| Share weekly plan as text / OS share | | |
| Local versioned store; export / delete | | |
| Dev-only debug panel | | |
| Android **feasibility document** (M6) | | |

**Seams the MVP leaves for v1:**
- **Identity:** all records carry `ownerId` (MVP: a local device id) and timestamps, so a family account can own them later (ADR 003).
- **Persistence:** one versioned JSON document behind a `Storage` port (localStorage on web, Capacitor Preferences on Android); sync conflict policy written down, not built.
- **Integrations:** `MenuExtractor` and `PdfSource` ports; the proxy contract (`POST /api/menu/fetch-pdf`, `POST /api/menu/extract`) moves unchanged to a hosted function in v1. `NotificationScheduler` port with web and Android adapters.
- **Privacy:** only the public menu PDF leaves the device. v1 sync would store child preferences server-side: APPI review and consent needed then (`templates/v1/PRIVACY.md`).

**Known MVP limitations (said in the UI and docs):** data lives on one device (sharing is copied text, not sync); the browser can't remind while closed; school reservations stay outside the app.

## 2. Roles
| Role | Agent | Primary output |
|------|-------|----------------|
| Business Analyst | `ba` | Stories + ACs, data contract, dictionary, sourced recipes |
| UX/UI Designer | `designer` | Tokens, component specs, flows, a11y, copy |
| Developer/Architect | `developer` | ADRs, domain logic, proxy, UI, local gate, (v1) Android |
| QA Engineer | `qa` | Test strategy, oracle (assessment, state machine, ranking filters), e2e, report |
| Verifier | `verifier` | Spot-checks of research, recipes and Japanese text against sources |
| Metrics & Evidence | `metrics` | MVP evidence package findings |

## 3. Business rules
Proposed by the BA (`docs/ba/open-questions.md`), **awaiting PO approval**. Only the Orchestrator changes these; every change is logged in §7.

| ID | Rule |
|----|------|
| **BR-01** | Assessment and decision are separate: computing an assessment never reads or writes a decision, and changing a decision never changes an assessment. |
| **BR-02** | A decision is created, changed or removed only by an explicit parent action allowed by the decision state machine. Menu import/refresh, assessment, profile edits, reminders and the passage of time change 0 decisions; a low-preference assessment creates 0 plans. |
| **BR-03** | A day is `homemade-bento-planned` only with exactly 1 confirmed recipe. Suggested (low-preference) and planned days differ in icon and text, never in colour alone. |
| **BR-04** | Assessment per school day (D = distinct disliked ids, L = distinct liked ids, U = share of unmatched dishes): no-lunch day → `no-school-lunch`; no likes and no dislikes in the profile → `not-assessed`; D ≥ 2 → `low-preference`; D = 1 and L = 0 → `low-preference`; D = 1 and L ≥ 1 → `mixed-uncertain`; D = 0, L ≥ 1 and U ≤ 50% → `likely-enjoyable`; otherwise `mixed-uncertain`. Deterministic. |
| **BR-05** | A manual override is stored per date and stays applied across reload, reassessment, profile edits and menu refresh until the parent clears it. |
| **BR-06** | A recipe is never suggested or plannable if any of its allergens or may-contain allergens is a known allergen of the child, any ingredient (or its dictionary parent) is excluded, or it violates a selected diet. |
| **BR-07** | The app never states or implies allergy safety: every recommendation and recipe screen shows the disclaimer; unknown allergy status adds a banner; 0 catalog strings match the banned-phrase list. |
| **BR-08** | Missing allergen information is "unknown", never "none": `declared-none` requires the PDF's own words. |
| **BR-09** | Suggestions: top 3 (fewer only if fewer pass BR-06) by +2 per liked id, +1 theme match, −3 per disliked id, −2 if planned within ±14 days, −1 if > 20 minutes; ties by minutes, then id. |
| **BR-10** | The AI adapter receives only the PDF, target month, prompt and schema versions (0 child-profile fields). At most 2 provider calls per import action; 0 calls for a PDF whose sha256 was already extracted. *(Retry policy to reconcile with ADR 002 at H1: see §7 2026-10-24 "R-1".)* |
| **BR-11** | AI output is used only if it validates against `ExtractedMenu` v1; weekday mismatches, duplicate dates and illegible fields are flagged `uncertain`; nothing the PDF doesn't print is added. |
| **BR-12** | Only a parent-confirmed menu feeds the calendar, assessments and reminders. |
| **BR-13** | Replacing a month's menu keeps 100% of that month's decisions and overrides; conflicts are flagged, never resolved automatically. |
| **BR-14** | Import input: URL http(s), ≤ 2,048 characters; file starts with `%PDF-`, 1 byte – 10 MB. |
| **BR-15** | All dates and reminder times are Asia/Tokyo, whatever the device timezone. |
| **BR-16** | Weekly reminder default Sunday 14:00 covering the next 7 days; day-before reminder default 17:30 for `homemade-bento-planned` days only. Both configurable in 15-minute steps and can be switched off. |
| **BR-17** | One reminder per key; a reminder missed while closed shows on next open until it expires; changing or cancelling a decision updates or removes its reminder in the same action. |
| **BR-18** | The web version shows reminders in-app only; 0 strings claim notifications while the app or browser is closed. |
| **BR-19** | The app never reserves, cancels or claims to have reserved a school lunch; "reserved" is the parent's own record. |
| **BR-20** | The profile holds only: optional nickname (≤ 20 chars), age range, likes/dislikes (≤ 30 each, disjoint), allergy status + allergens/exclusions, diet, ≤ 3 themes, note (≤ 200 chars). No birthdate, gender, height, weight, photo, real name or school. |
| **BR-21** | A shared summary contains only dates, decision labels, recipe names and fixed notes: 0 profile fields. |
| **BR-22** | Data is stored only on the device with `schemaVersion`; export is one valid JSON file; "delete all" removes 100% of app keys after 1 confirmation. |
| **BR-23** | Japanese on first launch whatever the browser language; the ja/EN toggle is within 1 tap of the calendar; 100% of visible strings come from the catalogs. |
| **BR-24** | The production build contains 0 debug UI and 0 debug marker strings. |
| **BR-25** | A school day is a date in the confirmed menu with ≥ 1 non-snack lunch item; 「お弁当の日」 (no-lunch reason `bento-day`) may also be planned. |
| **BR-26** | The library ships 15–20 recipes, each with ≥ 1 fetched source, valid against the Recipe contract, passing the overlap check, and Japanese text verified by hand (FL-07). |
| **BR-27** | Dates before today (Asia/Tokyo) are read-only. |

## 4. Data contracts
Semantics owned by the BA (`docs/ba/data-contract.md`: ChildProfile, ExtractedMenu, ConfirmedMenu, Assessment, DayDecision, Recipe, ReminderSettings, root store with `schemaVersion`). Format, zod schemas and validator by the Developer (ADR 003, 004). Allergens follow the current Japanese labelling scheme: **9 mandatory 特定原材料** (cashew added 2026-04-01) + 20 recommended items.

## 5. Phases and handoff gates
```
Phase 0  Kick-off: brief → this plan → BR table + architecture approved by PO   ✓ 2026-10-24
Phase 1  H1: BA finalises stories with PO answers; Dev aligns ADRs (R-1…R-3 in §7)   ◄ next
Phase 2  H2: Designer full package    ║  M0 skeleton + local gate
Phase 3  M1 → M5 (Dev), BA recipe research in parallel with M2/M3, QA per milestone
Phase 4  QA: e2e journey, verification, report  → MVP milestone evidence
Phase 5  M6 Android feasibility doc → PO decides v1 Android build
```

| Milestone | Scope | QA verifies | Size |
|-----------|-------|-------------|------|
| M0 | Vite/React/TS skeleton, i18n + toggle, JST module, ports + web adapter stubs, storage + migrations, proxy health, local gate | `gate --stage dev` green; app loads ja/en at 390/1280 px | M |
| M1 | Onboarding, import with **mocked** AI, review/edit/confirm, export/delete, synthetic menu fixtures | Profile CRUD; nothing from the profile in any `/api` request; failure → upload fallback | M |
| M2 | Assessment + overrides, calendar, decision state machine, menu replace keeps decisions | Oracle vs engine 0 diffs; transition table; month boundaries | L |
| M3 | Recipe library (BA research), ranking, 3 suggestions, recipe detail | No known allergen ever suggested (property test); tie-break | M |
| M4 | Reminders (in-app), settings, Today view, share, debug panel | Stable ids, idempotent diff, JST in non-JST browser; **full e2e journey** | M |
| M5 | Real Gemini via proxy, cache, failure handling, opt-in live eval | Contract tests on recorded responses; live eval run once with the PO's key | M |
| M6 | Android feasibility document (+ emulator spike if approved) | Doc reviewed | S |

| Gate | From → To | Must be true |
|------|-----------|--------------|
| H1 | BA → UX, Dev, QA | Every story has GWT ACs and an ID. Data contract v1 published. Open questions answered or deferred in §7. R-1…R-4 reconciled. |
| H2 | UX → Dev | Tokens JSON + CSS (light/dark). Every component state at 390 px + desktop. Flows map to story IDs. Contrast audit passes. ja/en copy sheet complete. |
| H3 | Dev → QA | `gate --stage dev` green. Domain coverage ≥ 90%. Local preview works on mobile + desktop. Budgets met. Known-issues list. |
| H4 | QA → Orchestrator | `gate --stage release` green. Oracle diff 0. 0 open P1/P2. axe 0 serious/critical. Test report with go/no-go. |
| H5 | Orchestrator → live | **Not applicable until the PO approves a remote and a deploy target.** Until then: local release = tagged commit + `CATCH-UP.md` updated. |

## 6. Definition of Done (MVP)
- [ ] All MVP stories meet their ACs (verified by QA, tests name `US-…/ACn`).
- [ ] The main journey passes end-to-end in Playwright with the mocked extractor: import PDF → confirm menu → low-preference day → choose bento → recipe → save → calendar → trigger reminder → reopen recipe.
- [ ] The core rules hold: assessment oracle 0 diffs; no decision changes without a parent action; no known allergen ever suggested.
- [ ] Recipes sourced, overlap PASS, Japanese text verified by hand.
- [ ] One live extraction eval run with the PO's key on a real menu PDF, results recorded (not gated).
- [ ] WCAG 2.1 AA (axe 0 serious/critical), keyboard journey, 360 px and desktop; ja and en.
- [ ] Performance and bundle budgets met.
- [ ] MVP evidence package collected, findings written, PO's yes, frozen.

## 7. Decision & change log
| Date | Decision | By |
|------|----------|----|
| 2026-10-24 | Plan created from the PO brief. Project scaffolded from app-boilerplate v0.5.0 (`--content-app`); local git only, no push, deploy or paid services without PO approval. | Orchestrator |
| 2026-10-24 | At the PO's request, requirements, architecture, AI/Android research and design proposals were dispatched before BR approval (docs only, no code). | Orchestrator |
| 2026-10-24 | Allergen scheme: 9 mandatory items (cashew mandatory since 2026-04-01; transition labels allowed until 2028-03-31) + 20 recommended. Verified by the Orchestrator against prefectural sources. | Orchestrator |
| 2026-10-24 | **R-1 (open, to reconcile at H1):** BR-10 says ≤ 2 provider calls per import and no automatic retry on rate limit; ADR 002 §5 retries 429/5xx up to 3 times then switches model. Proposed: keep BR-10 (call 1 = primary; call 2 = one repair retry *or* the fallback model on 429/5xx; then stop and offer upload/manual). ADR 002 to be updated. | Orchestrator |
| 2026-10-24 | **R-2 (open):** state names differ (data contract `school-lunch-planned / homemade-bento-planned / not-confirmed / no-school-lunch` vs ADR 004 `school_lunch / bento_pending / bento_planned / no_school_lunch`). Proposed: the data contract's names win; ADR 004 renames. | Orchestrator |
| 2026-10-24 | **R-3 (open):** ADR 004 keeps recipes with unknown allergen data visible in a lower group; BR-06 and OQ-13 (default) exclude any recipe whose possible allergens match. Proposed: BR-06 wins for matches; recipes with incomplete data are flagged and ranked last (ADR 004), only when the child has no known allergens. | Orchestrator |
| 2026-10-24 | **R-4 (closed by OQ-14):** ADR 005 allows an optional desktop system notification while the tab is open; OQ-14 default is in-app only. Proposed: in-app only for MVP (OQ-14). | Orchestrator |
| 2026-10-24 | PO approved the architecture (ADR 001–005 direction) and the BR table BR-01…BR-27. Open decisions (AI region, OQ defaults, other design choices) still pending. | PO |
| 2026-10-24 | Design: `surface-1` (light page background) is pure white `#FFFFFF`, no yellow tint. Contrast re-checked: all pairs improve (navy 14.22:1, dashed suggestion border 4.03:1). | PO |
| 2026-10-24 | Design direction accepted as proposed (`design/direction.md`): week starts Monday with a Sunday setting (US-E5-01/AC2 to be updated by the BA at H1), Saturday blue / Sunday-holiday red on date numbers only, Zen Maru Gothic for headings + system Japanese fonts for body, no tab bar (recipes and settings in the app bar), planned bento = navy fill with red top edge. Card surface `surface-2` and `ink-inverse` keep their current values. | PO |
| 2026-10-24 | AI region: the menu import is used **from Japan only**. Gemini free tier, Google AI Studio project **without** billing; ADR 002 open decision 1 closed. BentoMinder stays a parents-only tool (Gemini terms: users 18+). | PO |
| 2026-10-24 | All 15 open-question defaults accepted (`docs/ba/open-questions.md` OQ-01…OQ-15), incl.: school day = confirmed-menu date with ≥ 1 non-snack lunch item; 「あとで決める」 (`not-confirmed`) is a real state set only by the parent; お弁当の日 plannable; snacks not assessed; recipe = one whole bento; recipes with variable processed-food allergens excluded on a match; web reminders in-app only (closes R-4); weekly reminder covers the next 7 days; next-month prompt from the 20th. | PO |
| 2026-10-24 | Kick-off documents committed locally (no remote, nothing pushed). | PO |
