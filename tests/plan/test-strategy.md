# Test strategy — BentoMinder

Owner: QA · 2026-10-24 · Status: **H1, oracle-ready** (written before any code exists; QA blockers ruled in `docs/PLAN.md` §7 on 2026-10-24 and applied) · Inputs: `docs/PLAN.md` (BR-01…27, §5 milestones and gates, §6 DoD, §7 incl. R-1…R-4), `docs/ba/user-stories.md` (H1 final: 73 stories, 264 ACs of which 10 v1), `docs/ba/data-contract.md` (H1 final), `docs/ba/domain-dictionary.md`, `docs/dev/architecture.md` §6, ADR 002/004/005, PO brief §16.

Companion files: oracle specs in `tests/oracle/` · fixture plan `tests/plan/fixtures-plan.md` · report `tests/reports/test-report.md`.

## 1. What must never happen
The oracles and the property tests exist to prove these. Each one breaking is a **P1**.

| # | Never | Rule | Proven by |
|---|-------|------|-----------|
| N1 | Suggest, list as plannable, or let the parent confirm a recipe that contains a known allergen (incl. may-contain), an excluded ingredient or a selected-diet violation | BR-06, R-3 | ranking oracle, property test over every allergen, pair and diet on the real library, decision oracle T37/T39 |
| N2 | State or imply allergy safety; treat a missing allergen declaration as "none" | BR-07, BR-08 | catalog scan against `data/banned-phrases.json` (BA-owned), e2e on every recipe/recommendation screen, extraction fixtures FX-01/FX-07 |
| N3 | Create, change or remove a family decision without an explicit parent action (import, refresh, assessment, override, profile edit, reminder, time) | BR-01, BR-02, BR-13 | decision oracle §3 (system events), random event sequences, e2e reload/refresh checks |
| N4 | Reserve, cancel or claim to have reserved a school lunch | BR-19 | catalog scan, e2e on day sheet and today view |
| N5 | Send any child-profile, decision or override data off the device | BR-10, BR-21, US-NF-03 | contract test on the adapter payload allow-list, Playwright network audit of every request body in the journey, share-text test |
| N6 | Lose or silently alter stored family data (profile, decisions, overrides, settings) on reload, refresh, migration, failed import or full storage | BR-05, BR-13, BR-22 | store round-trip tests, migration fixtures, US-E2-06/AC3 byte-equality, US-E10-02 |
| N7 | Remind on the wrong day or time, or not remind a planned day before its due time, because of the device timezone or a calendar boundary | BR-15, BR-16, BR-17 | reminder oracle, TZ matrix (Asia/Tokyo, Europe/Paris, America/Los_Angeles), e2e with `timezoneId: 'Europe/Paris'` |
| N8 | Ship debug UI, debug marker strings or an AI key in the production build | BR-24, US-NF-05 | `check:no-debug`, `validate.mjs secrets`, built-asset scan |

## 2. Test levels
| Level | Tool | Location | Scope | Owner | Data |
|-------|------|----------|-------|-------|------|
| Unit (domain) | Vitest | `src/**/*.test.ts` | every rule in `src/domain` (time, schema, menu, assessment, decision, recipes, reminders, share, storage); coverage ≥ 90% lines on `src/domain/**` (H3) | Dev, QA reviews | fixtures only |
| Oracle | Vitest, seeded PRNG | `tests/oracle/` | engine vs naive re-implementation, fixed tables + 1,000 seeded cases per oracle; 0 differences | QA | fixtures + shipped data files (never shipped code) |
| Property | Vitest | `tests/unit/properties/` | never-rules over the **real** library and dictionary (assert properties, not specific outputs) | QA | `data/*.json` |
| Schema / data | Vitest + `npm run validate:data` | `tests/unit/data/` | every contract rule id with a passing and a failing fixture; migrations; export round-trip | Dev + QA | store and library fixtures |
| Component | Vitest + Testing Library | `src/**/*.test.tsx` | every screen renders in ja and en with no missing key; component states; not-colour-alone markers | Dev, QA reviews | fixtures |
| Contract (proxy) | Vitest (node) | `tests/contract/` | `/api/menu/fetch-pdf` and `/api/menu/extract` with **recorded Gemini responses** replayed by a fake transport: payload allow-list, 2-call budget and every call sequence of US-E2-07/AC4, error mapping, cache by sha256, SSRF guard, size cap, timeouts | Dev + QA | `tests/fixtures/extractor/` |
| E2E | Playwright on `vite preview` (production build) | `tests/e2e/` | every MVP story's UI ACs, the main journey, boundaries, hostile input, empty/fallback states, URL/back state, keyboard-only journey; extractor mocked with `page.route` + fixtures; time via `page.clock`; browser `timezoneId: 'Europe/Paris'` and `locale: 'en-US'` in the main projects | QA | fixtures |
| Accessibility | `@axe-core/playwright` | `tests/e2e/a11y.spec.ts` | 0 serious/critical on every screen of US-NF-02/AC1, ja and en, light and dark, 390 px and 1280 px; 360 px touch-target check | QA | fixtures |
| Performance | Lighthouse CLI (manual run, recorded) + `validate.mjs budget` | `tests/perf/` | US-NF-01: LCP ≤ 2.5 s, TBT ≤ 200 ms (Moto G Power, slow 4G); interaction ≤ 100 ms; JS ≤ 400 KB, CSS ≤ 50 KB gzip | QA | FX-01 loaded |
| Live AI eval | `npm run eval:extraction` (opt-in, needs the PO's key) | `tests/eval/` | real extractor on FX-01…FX-07 PDFs + the PO's real PDF locally; date mapping, dish recall/precision, invented items/allergens, uncertainty recall; writes `reports/eval-*.json` | QA runs, Orchestrator holds the key | fixtures; real PDF never committed |
| Content verification | `verifier` agent + matrix test | `tests/content/` | stratified sample of the recipe library (§10) | QA + BA | `data/library.json` |
| Manual | checklist | `tests/manual/` | Android (v1 checklist, §12), screen reader spot-check (TalkBack/VoiceOver), Safari/Firefox smoke | QA | – |

**Mocks and fakes.** Every test except the live eval runs without network and without an AI key (US-NF-04/AC2). Ports are replaced with fakes (Storage: in-memory; Clock: fixed/steppable; MenuExtractor/PdfSource: fixture-backed with failure modes; NotificationScheduler: records calls; Share: records text). In e2e, `/api/**` is intercepted; any unexpected request fails the test.

## 3. What runs where
| Check | `gate --stage dev` (H3, every change) | `gate --stage release` (H4, CI on every PR) | Never in a gate |
|-------|---------------------------------------|---------------------------------------------|-----------------|
| preflight, secrets, budgets | ✔ | ✔ | |
| `npm run validate:data`, `typecheck`, `build`, `check:no-debug` | ✔ | ✔ | |
| `npm run coverage` = unit + oracle + property + schema + component + contract | ✔ | ✔ | |
| `npm run test:e2e` = Playwright journey, story specs, a11y (from M1) | ✔ (recommended in architecture §8) | ✔ | |
| docs, trace (every story ID in an active test title), overlap, evidence | | ✔ | |
| Live AI eval, Lighthouse, Android checklist, screen reader | | | ✔ recorded in the test report |

Requested `quality-gate.json` changes (Orchestrator edits): add `check:no-debug` and `test:e2e` to `commands`; add Playwright JUnit output to `evidence.testResults`; list the v1 stories (US-E7-08, US-E12-02, US-E12-03, US-E12-04) in `trace.allowUntested` with the reason "v1, not built before PO approval" (else the release gate fails by design); add generated fixture PDFs to `generated`; make sure Vitest includes `tests/**/*.test.ts`.

## 4. Naming and traceability
- Every test title names the ACs it verifies in full: `US-E4-01/AC2 rule table row D=0 L=1 U=51% → mixed-uncertain`. A test may name several ACs; it then must assert each of them. `validate.mjs trace` checks the story part (`US-[A-Z0-9]+-\d+`); milestone evidence counts an AC as verified only from a passing test that names it.
- BR ids may be appended (`[BR-04]`) but never replace the AC id.
- Retired ACs (e.g. US-E2-06/AC1) are never named by an active test.
- A skipped or `todo` test carries its reason in the title (`todo: depends on finding B1`) and is listed in the report with that reason.
- Traceability matrix (AC → test files → last result) is **generated** from test titles and the JUnit output by `npm run report:trace` into the test report; never written by hand.

## 5. Environments and test data
| Dimension | Values | Where |
|-----------|--------|-------|
| Viewports | 390 × 844 (mobile), 1280 × 800 (desktop); 360 px for touch targets (US-NF-02/AC3) | Playwright projects |
| Browsers | Chromium (gate); Firefox and WebKit smoke (manual, before H4) | |
| Browser timezone | `Europe/Paris` in the main projects; `America/Los_Angeles` and `Asia/Tokyo` in the TZ project | Playwright `timezoneId`; Vitest runs the time suites under `TZ=Asia/Tokyo`, `TZ=Europe/Paris`, `TZ=America/Los_Angeles` |
| Browser language | `en-US` (proves Japanese is still the default, US-E8-01/AC1) | Playwright `locale` |
| Themes | light and dark (`colorScheme` emulation + the in-app setting, US-E8-05) | a11y project |
| Time | fixed with `page.clock` / fake `Clock`; never the real date | |
| Data | synthetic menus FX-01…FX-08, synthetic recipe library (ranking oracle §2), the real library for property tests, store fixtures | `tests/fixtures/` (plan: `tests/plan/fixtures-plan.md`) |

## 6. Brief §16 focus list → test approach
| Focus (brief §16) | Approach | Level | Stories / ACs | Milestone |
|-------------------|----------|-------|---------------|-----------|
| Japanese PDF extraction accuracy | Hand-made answer keys per fixture; contract tests on recorded outputs (schema, no invented fields, uncertain flags); live eval metrics: date mapping (target 100% on fixtures; < 95% triggers ADR 002 revisit), dish recall/precision after NFKC, 0 invented dishes/allergens, recall of `hardFields` as `uncertain` | contract, live eval | US-E2-04/AC1–AC6, US-E2-05 | M1 (recorded), M5 (live) |
| School menu date mapping | Answer keys for row, grid, two-column and scanned layouts (FX-01, 02, 05, 06); 令和 header (FX-03, 04); weekday cross-check (FX-01d); out-of-month and duplicate dates; 2027-02-29 rejected | contract, unit, live eval | US-E2-05/AC3–AC6, US-E3-01/AC1 | M1, M5 |
| Preference scoring reproducibility | Assessment oracle (65 cases + 1,000 seeded), invariants: shuffle, ja/en, three TZs, 100 repetitions | oracle, unit | US-E4-01/AC1–AC10, US-E4-02 | M2 |
| Manual override persistence | Override survives reload, profile edit, reassessment, FX-01b refresh; cleared only by 「自動判定に戻す」 or profile deletion; 「献立が変わりました」 flag | unit, e2e | US-E4-03, US-E3-05/AC1, AC3, US-E1-06/AC2 | M2 |
| Meal-plan state transitions | Decision oracle: 56 transitions + 23 system events + 1,000 random sequences; dialogs; past-date guard in JST | oracle, unit, e2e | US-E5-02…08, US-E5-04 | M2 |
| Allergies and unknowns | Ranking oracle F1–F4, property test over all 29 allergens, every pair and every diet on the real library; unknown-status banner; `not-declared` ≠ none in menus; incomplete recipes (R-3) both ways; banned-phrase scan | oracle, property, e2e | US-E1-03, US-E6-02, US-E6-03, US-E4-05, US-E1-05/AC2 | M1, M3 |
| Recipe selection and editing | Confirm from recommendations and from the library; change recipe; cancel with dialog; missing recipe after a library change; deep link `/recipes/<id>` | e2e, unit | US-E5-03, US-E5-06, US-E6-04, US-E6-05, US-E6-06 | M3 |
| Notification scheduling and cancellation | Reminder oracle (43 cases + 1,000 seeded): keys, due/expiry instants, missed/expired/dismissed, change/cancel in the same action, idempotent diff | oracle, unit, e2e | US-E7-01, 02, 04, 05, US-E5-05/AC3 | M4 |
| Month boundaries and Japanese timezone | Month/year/leap cases (2026-11-30→12-01, 2026-12-31→2027-01-01, 2027-01-29→02-01, 2028-02-29); "today" at 00:30 JST with the browser in Europe/Paris (local date one day behind); TZ change while open; midnight rollover without reload | unit (3 TZ runs), e2e (`timezoneId: 'Europe/Paris'`) | US-E5-01/AC1, AC5, AC6, US-E7-03/AC3, US-E7-07, US-E8-03/AC3 | M0 (time module), M2, M4 |
| Local data persistence | Reload/restart restores everything exactly; schemaVersion; migration v0→1 with backup; newer version read-only; corrupt store recovery; storage full; export validates and round-trips; delete-all removes every key | unit, e2e | US-E10-01…05, US-E0-01/AC2 | M0, M1 |
| Japanese/English switching | Catalog parity test; every screen in en contains no Japanese except allowed content; html `lang`; switch without reload; persistence; date formats | unit, e2e crawl | US-E8-01…03 | M0, every milestone |
| Android notification permissions | Unit tests with a fake plugin (permission states, inexact warning) when the adapter exists; device checklist (§12) | unit (v1), manual | US-E12-03, US-E12-04 (v1) | M6 doc, v1 |
| AI service unavailability | Every call sequence of US-E2-07/AC4 from recorded responses; not-configured; proxy cap; existing data byte-identical after any failure; offline import message; everything else works with the adapter down | contract, e2e | US-E2-05, US-E2-06, US-E2-07, US-NF-04 | M1 (mocked), M5 |
| Browser and Android consistency | Same domain code, same Playwright journey run inside the Android WebView/emulator in v1; M6 doc lists the adapter differences; until then: the web journey is the reference and Android differences are recorded as known issues | e2e (v1 on emulator), manual | US-E12-01, US-E12-02/AC1 | M6, v1 |

## 7. Main end-to-end journey (US-E0-01/AC1–AC3, DoD §6 bullet 2)
Spec `tests/e2e/journey.spec.ts`, title `US-E0-01/AC1 US-E0-01/AC2 US-E0-01/AC3 main journey …`. Production build, both viewport projects, browser `timezoneId 'Europe/Paris'`, `locale 'en-US'`, fresh storage. `/api/menu/extract` is routed to the FX-01 recorded output; every request is recorded for the network audit.

| # | Action | Assertions |
|---|--------|------------|
| J01 | Set `page.clock` to 2026-10-28T01:00:00Z (10:00 JST, 02:00 in Paris); open `/` | Onboarding step 1 「お子さまのこと」; `<html lang="ja">`; no stored profile (US-E1-01/AC1, US-E8-01/AC1) |
| J02 | Enter the sample child: 年中, likes 鶏肉・たまご・とうもろこし, dislikes ピーマン・なす・さかな, 「アレルギーあり」 + えび, theme どうぶつ; 「次へ」 | Stored profile has exactly the contract fields; ids as in the stories' conventions; no birthdate/gender/etc. field exists (US-E1-02/AC2, US-NF-03/AC2) |
| J03 | Step 2: choose 「PDFファイルを選ぶ」 and upload `fixture-menu-2026-11.pdf` | No `/api` call before consent |
| J04 | Consent notice: read and tap 「同意して読み取る」 | Notice states the 6 facts (US-E2-08/AC4); `consent.aiNoticeVersion = 1` stored |
| J05 | Wait for 「献立を読み取っています…」 then the review screen | Exactly 1 extract request; its body has only `pdf`, `targetMonth`, `promptVersion`, `schemaVersion` and none of 「はなちゃん」, likes, allergens, note (US-E2-04/AC7) |
| J06 | Review screen | Every Mon–Fri of November listed in order; 11-03 and 11-23 「献立に記載なし」; 11-20 お弁当の日; 11-27 給食なし; 「確認が必要な項目：3件」 (US-E3-01/AC1–AC2) |
| J07 | Tap 「この内容で確定」, then 「確定する」 in the uncertain dialog | ConfirmedMenu 2026-11 v1 stored; the 3 fields `uncertain-accepted`; 0 stored decisions (US-E3-03/AC1–AC2, US-E5-04/AC2) |
| J08 | Calendar | Shows 「2026年11月」, Monday-first week (US-E5-01/AC2); 11-04 cell has the low-preference marker and 「給食」; accessible name 「11月4日（水）、苦手かも、給食」 (US-NF-02/AC4) |
| J09 | Tap 2026-11-04 | Day sheet 「11月4日（水）」, explanation 「水曜日の給食には、苦手な食材が2つ含まれています（ピーマン、なす）。」, actions 「手作りお弁当にする」「あとで決める」 only, reservation note (US-E4-02/AC1, US-E5-02/AC1, US-E5-07/AC1) |
| J10 | Tap 「手作りお弁当にする」 | Recommendation view; exactly 3 cards; order equals the ranking oracle for the sample child on the real library; no card's recipe has `alg-shrimp` in allergens or may-contain; disclaimer visible; stored decision still absent (US-E6-01/AC1, US-E6-02/AC1, US-E6-03/AC1, US-E5-03/AC1) |
| J11 | Select card 1, tap 「この日に決定」 | Stored decision 2026-11-04 `homemade-bento-planned`, `recipeId` = card 1, `decidedAt` = the clock time (US-E5-03/AC2) |
| J12 | Back on the calendar | 11-04 cell: filled bento marker + the recipe's `shortNameJa`; upcoming summary lists 「11月4日（水）」 with the recipe (US-E5-01/AC4, AC7) |
| J13 | Network audit so far | Only static assets and `/api/menu/extract`; no request body contains profile, decision or override data (US-E10-01/AC2) |
| J14 | `page.clock.setSystemTime(2026-11-03T08:29:00Z)` (17:29 JST), then advance 1 minute | No banner at 17:29; at 17:30 JST the banner 「明日は手作りお弁当の日！レシピを確認しましょう。」 with the recipe name; `reminderLog` key `day-before:2026-11-04` due 2026-11-03T08:30:00Z (US-E7-02/AC1, US-E7-07/AC1) |
| J15 | Check the reminder is labelled 「（日本時間）」 | Browser is in Paris (US-E7-07/AC2) |
| J16 | Tap the reminder | Recipe detail of the planned recipe at `/recipes/<id>`: ingredients with quantities, numbered steps, MAFF food-handling notes, allergy disclaimer (US-E7-02/AC2, US-E6-04/AC1–AC2) |
| J17 | Browser back | Calendar on November 2026 (last viewed month) |
| J18 | Snapshot the store; reload | Calendar opens directly (no onboarding); store deep-equal to the snapshot; the day-before reminder is not shown again (US-E0-01/AC2, US-E7-05/AC1) |
| J19 | Navigate to November if needed; tap 11-04 | Still `homemade-bento-planned` with the same recipe |
| J20 | Toggle 「EN」, then back to 日本語 | All visible text switches without reload, `lang` follows; recipe shows its English name in en (US-E8-01/AC2, AC4) |
| J21 | axe scan after J01, J06, J08, J09, J10, J16 | 0 serious/critical in each (US-NF-02/AC1) |
| J22 | Count user actions J01–J11 from first launch to the confirmed bento day | ≤ 25 actions, no step more than 2 levels from the calendar (US-E0-01/AC3) |

22 steps. Variants of the same journey: **keyboard-only** (Tab/Enter/Space only, visible focus asserted at each step, US-NF-02/AC2); **dev build** with the debug panel driving J14 instead of `page.clock` (US-E11-02/AC1–AC2); **v1** the same spec inside the Android emulator WebView (US-E12-02/AC1).

## 8. Other e2e coverage (per story, in `tests/e2e/<epic>.spec.ts`)
- **Boundaries:** nickname 20/21, note 200/201, likes/dislikes 30/31, themes 3/4, URL 2,048/2,049, file 10,485,760/10,485,761 bytes, dish name 40/41, 12 items per day, times 00:00/23:45 and stored "24:00"/"17:31" rejected (US-E7-04/AC3), U = 50%.
- **Hostile input:** FX-08 on the review screen; `<script>`, HTML, emoji, very long strings, zero-width and RTL marks in nickname, note, URL and dish fields; `javascript:` URLs; assert literal rendering, no script execution (listen for `dialog` events), no layout break at 360 px.
- **Empty and fallback states:** no menu (US-E1-01/AC5, US-E3-06/AC1), next-month card from the 20th (US-E3-06/AC2), 0/1/2 suggestions (US-E6-01/AC4–AC5), empty upcoming summary, empty week share text (US-E9-01/AC3), share without `navigator.share` → clipboard (US-E9-01/AC2), offline (US-E10-01/AC3), every extraction failure (US-E2-02, US-E2-05, US-E2-06), storage full (US-E10-02/AC5), corrupt and newer stores.
- **URL and back-button state:** deep links `/recipes/<id>` and unknown ids (US-E6-04/AC3); back from recommendations changes nothing (US-E5-03/AC3); `/debug` is not found in production (US-E11-01/AC2); reload on every screen keeps state.
- **Never-strings:** one test reads both catalogs and checks every string against every phrase in `data/banned-phrases.json` (BA-owned; covers BR-07, BR-18, BR-19 and US-E4-04; catalog-level, not only rendered screens). The test fails if the file is missing or empty.
- **i18n crawl:** every screen rendered in en contains no Japanese characters except dish names, recipe Japanese names and 「日本語」; in ja no untranslated English UI text (US-E8-02/AC2).

## 9. Oracles
Specifications: `tests/oracle/README.md`. Fixed cases: assessment 65 (+15 matcher), decisions 56 transitions + 23 system events, ranking 23 + 7 hidden-source diet cases, reminders 43. Each also runs 1,000 seeded random cases in the gate (seed `20261024`). Any difference is P1. Oracle code shares no code with `src/` (enforced by `tests/oracle/independence.test.ts`).

## 10. Content verification (recipe library, BR-26)
- **Automated, 100% of recipes:** contract validation (`validate:data`), allergen union and may-contain union re-derived from the dictionary, `dietOk` re-derived, `allergenDataComplete` re-derived, short names, sources on the approved list, `validate.mjs overlap` PASS and 0 UNVERIFIED (English prose only: the overlap tokenizer cannot see Japanese, architecture §8.5).
- **Stratified sample ≥ 10% (at least 3 of 15–20 recipes):** one `japanese`, one `western-inspired`, one with a varies-by-product ingredient; if the library has an incomplete-data recipe, it is always in the sample. Checks agreed with the BA:
  - C1 every ingredient and quantity is traceable to the cited source (adaptations recorded);
  - C2 minutes plausible against the source;
  - C3 allergen and may-contain lists complete for the source's ingredients;
  - C4 Japanese name, steps and storage notes read naturally and match the source's facts, in our own words (hand check, FL-07);
  - C5 storage/food-handling guidance comes from a cited source;
  - C6 the source page was fetched and is cached.
- The `verifier` agent performs C1–C6; the matrix `tests/reports/content-matrix.md` is written by `WRITE_MATRIX=1 npm run test:content` from the verifier's recorded results, never by hand.
- Dictionary allergen list (29 items, `caa-2026-04`) was verified by the Orchestrator (PLAN §7); QA re-checks the id list against the dictionary file in a unit test.

## 11. Live AI evaluation (opt-in, never in a gate)
`npm run eval:extraction` with the PO's key, run once at M5 by the Orchestrator and again when a model id changes. Inputs: FX-01…FX-07 PDFs and the PO's real PDF (local only). Metrics per fixture: date mapping accuracy, dish recall and precision (NFKC, trimmed), invented dishes/ingredients/allergens (must be 0), no-lunch days correct, `hardFields` flagged uncertain, calls used (≤ 2), latency. Results go to `reports/eval-*.json` and a summary table in the test report. An invented allergen or a wrong date mapping is reported as a finding for the PO (the review screen is the safety net), not as a gate failure.

## 12. Android (M6 document, v1 build)
- **M6:** US-E12-01/AC1 is checked by a doc test (file exists, required sections present, every capability claim has a URL) plus a QA review against ADR 005.
- **v1 manual checklist** (from ADR 005 §4 A2, run on an emulator API 34/35/36 and the PO's phone, results in `tests/reports/`): notification permission denied/granted/revoked; exact-alarm granted/denied (inexact warning shown); day-before fires at 17:30 JST with the app closed and the screen off; device set to Europe/Paris → still 17:30 JST; decision cancel/change cancels/reschedules (plugin pending list); reminder time change; tap deep link opens the recipe; no duplicates after 3 restarts; reboot restore; Doze (`adb shell dumpsys deviceidle force-idle`); expired reminder not delivered late; no AI key in the APK.

## 13. Defect severity
| Severity | Definition for BentoMinder | Examples | Release |
|----------|----------------------------|----------|---------|
| **P1** | A never-rule (§1) is broken; any oracle difference; data loss or corruption; child data leaves the device; crash or dead end on the main journey | a known allergen or may-contain allergen in suggestions, 「ほかのレシピ」 or plannable; any string or screen implying allergy safety (「アレルギー対応」「安全です」…); `not-declared` shown as 「アレルゲンなし」; any claim that the app reserved or cancelled a school lunch; a decision changed by refresh or time; a reminder for the wrong date or an hour off because the browser is not in Tokyo; profile field in a request body; decisions lost after reload | blocks H4 |
| **P2** | A Must AC fails without P1 impact; WCAG 2.1 AA blocker (axe serious/critical, keyboard trap, state shown by colour only); performance budget missed; a failure path with no way forward | 4 suggestions shown; duplicate reminder; English text in the ja UI; no upload fallback after a URL failure; button not keyboard-reachable | blocks H4 |
| **P3** | A Should/Could AC fails; a visual or copy defect with a workaround; a minor a11y issue | holiday names missing (US-E8-04); share falls back to clipboard but the toast is missing | triaged with an owner |
| **P4** | Cosmetic | 1 px misalignment, inconsistent spacing | triaged with an owner |

Each defect is filed in the test report with: id, story/AC, steps, expected, actual, severity, owner, status. QA never changes product code to make a test pass.

## 14. Entry and exit criteria per milestone
| Milestone | Entry | Exit (QA verifies) |
|-----------|-------|--------------------|
| **H1** (now) | stories, contract, dictionary final | this strategy, the 4 oracle specs and the fixture plan published; findings B1, B2, B4, B5, B6, B7, B10, B14 ruled by BA/Orchestrator — **done 2026-10-24** (PLAN §7); oracle specs updated ("H1 oracle-ready") |
| **M0** skeleton | H1 green, H2 tokens available | `gate --stage dev` green; app loads in ja and en at 390/1280 px with `timezoneId 'Europe/Paris'`; `jst` module unit-tested in 3 TZs (today at 00:30 JST, month/year/leap helpers); store `schemaVersion 1`; prod bundle has no debug marker; catalog parity test; e2e harness and axe run on the empty app |
| **M1** onboarding + import (mocked AI) | M0 exit; FX-01, FX-03, FX-07, FX-08, RX-*, file fixtures built and BA-reviewed | profile CRUD incl. all boundaries; export/delete; review edit/confirm; every extraction failure path with upload/manual fallback; payload allow-list contract test; network audit shows no profile field in any `/api` request; e2e for E1, E2, E3 (except refresh), E10 |
| **M2** assessment, calendar, decisions | M1 exit; FX-01b/c, FX-02, FX-04, FX-05 built | assessment oracle 0 differences (fixed + 1,000 seeded); decision oracle 0 differences; override persistence; refresh keeps 100% of decisions and overrides; month/year/leap navigation; JST "today" in Paris; e2e for E4, E5 |
| **M3** recipes + ranking | M2 exit; real library merged (BA research) with overlap PASS | ranking oracle 0 differences on the synthetic library; property test over every allergen, pair and diet on the real library (0 violations); tie-break; R-3 both ways; content matrix C1–C6 on the sample; e2e for E6 |
| **M4** reminders, today, share, debug | M3 exit | reminder oracle 0 differences in 3 TZs; idempotent diff; expired/missed/dismissed; e2e for E7, E9, E11; **full journey (§7) green** incl. keyboard-only; axe 0 serious/critical in both themes and viewports; budgets met |
| **M5** real Gemini via proxy | M4 exit; recorded provider responses from a live run | contract tests on every call sequence of US-E2-07/AC4, cache hit = 0 calls, not-configured, proxy cap, SSRF guard; live eval run once and recorded (not gated); `gate --stage release` green → **H4** with the test report and go/no-go |
| **M6** Android feasibility | M5 exit | doc test + QA review of `docs/dev/android-feasibility.md` against ADR 005 and US-E12-01/AC1 |
| **H4** release (MVP) | M5 (and M6 doc) exit | `gate --stage release` green; every MVP story named by an active passing test; oracle diff 0 on all 4; 0 open P1/P2; P3/P4 triaged with an owner; axe and performance thresholds met; live eval recorded; test report with go/no-go |

## 15. Findings at H1
**Blocking for an exact oracle** — all ruled by the Orchestrator and applied to the oracle specs:
| Id | Finding | Status | Cases |
|----|---------|--------|-------|
| B1 | What D/L (and BR-09's "per liked id") count | **Resolved 2026-10-24 (PLAN §7)**: distinct found dictionary ids, then narrowed by "OQ-16 overruled" / "collapse narrowed" / collapse detail: D and L count *foods* (dish + defining ingredient within one item; identical or ancestor/descendant ids across the day, the ancestor folding into each descendant; never chained) | A11, A12, A26, A52, A58–A64; K18 |
| B2 | An id hitting a like and a dislike | **Resolved 2026-10-24 (PLAN §7)**: most specific entry wins; same-level tie → dislike; for a collapsed food: ingredient → dish → category | A27, A50–A54, A61, A62; K23 |
| B4 | Mixed key for D = 0, L = 0 | **Resolved 2026-10-24 (PLAN §7)**: U > 50% → `assess.mixedUnknown`, else `assess.mixedNeutral` | A39, A55 |
| B5 | Item with an id and an unresolved ambiguity in U | **Resolved 2026-10-24 (PLAN §7)**: counts (story wins) | A48 |
| B6 | Override (and NC/SL record) on a date a refresh makes no-lunch | **Resolved 2026-10-24 (PLAN §7)**: day shows `no-school-lunch`; override/record dormant, listed in "needs review", returns unchanged if the date becomes a school day again | A47, A56; T53, T54, S20, S21 |
| B7 | HB day a refresh made no-lunch or removed | **Resolved 2026-10-24 (PLAN §7)**: decision kept, flagged 「献立が変わりました」, only `KEEP_PLAN` (sets `acknowledgedMenuVersion`) or `CLEAR_PLAN`; reminder kept until cleared; お弁当の日 conversion is not a conflict | T42–T52, S09, S22; RM32, RM38–RM40 |
| B10 | Which instant "planned after the reminder time" compares | **Resolved 2026-10-24 (PLAN §7)**: `plannedAt` (first CONFIRM into HB, unchanged by CHANGE), strictly after due; a change never deletes a pending reminder | RM16, RM20, RM28, RM34–RM37 |
| B14 | Diet filter blind to non-allergen animal content | **Resolved 2026-10-24 (PLAN §7)**: ingredient-level `animalOrigin` tags + `animalOriginKnown`; unknown origin → excluded for any selected diet (`diet-incomplete`) | K11, K12, K20, H1–H7, PR6, PR7 |

**Closed by PLAN §7 "H1 closing rulings" (2026-10-24):** O-2 → A57 (removed date with an override is listed in "needs review"); O-3 → A65 (defining-ingredient links never cross items); O-4 → dictionary `definingIngredientId` published, assessment §1 reconciled (only みそ汁 differed: null; no result changed); U4 → S10, S23 (NC/SL on a removed date dormant, NC listed in review); U5 → T55 (`CONFIRM_RECIPE` on an お弁当の日 replaces a dormant record); RU1 → T56, RM41 (`plannedAt` cleared when the day leaves HB); AC15 → A61 (ingredient → dish → category). **No case depends on an undecided rule; no `todo` remains.**

**Not blocking H1:**
| Id | Finding | Resolution |
|----|---------|-----------|
| N1 | Onboarding "step 1 of 3" vs 4 design screens | **Resolved 2026-10-24 (PLAN §7)**: 3 input steps (profile, menu source, review), then the calendar; e2e asserts 1/3…3/3 then the calendar |
| N2 | Share text: AC vs design sample | **Resolved 2026-10-24 (PLAN §7)**: the AC's wording wins; the design sample follows; the test asserts the AC text |
| N3 | Shown-but-not-dismissed reminders | **Resolved 2026-10-24 (PLAN §7 "H1 closing rulings", OQ-20)**: shown again until dismissed or expired; RM42, RM43; RM22 now dismisses explicitly. The BA writes the AC at M4 (US-E7-04/AC2 "already shown are not shown again" is read as "not fired again as a new reminder") |
| N4 | Banned-phrase lists only as AC examples | **Resolved 2026-10-24 (PLAN §7)**: one BA-owned file `data/banned-phrases.json`; the never-strings test and PR5 read it |
| N5 | Answer-key conventions FX-Q1, FX-Q2; contract gap FX-Q3 | **Partly resolved 2026-10-24 (PLAN §7)**: FX-Q3 (`outOfMonthDays`) fixed by the BA; FX-Q1, FX-Q2 still open, owner BA, by M1 |
| N6 | `quality-gate.json` (allowUntested, commands, overlap fields, requireRemote) | **Resolved 2026-10-24 (PLAN §7)**: applied by the Orchestrator at M0 |
| N7 | After reload the calendar opens on the current Tokyo month | **Open** (not in the H1 rows); the journey test follows the current AC; BA to confirm |

Also applied: BR-14 is https only (port 443): URL cases UR-01…UR-04 in `fixtures-plan.md` §4 (UR-01: an `http://` URL is rejected before any request). BR-10 restated: RX-408 added (fallback model on 408).

No AC was found untestable. Three are verified partly by review rather than automation, with an automated existence check: US-E12-01/AC1 (document content), US-E2-08/AC4 (legal facts in the notice copy), US-E6-07/AC4 (verifier sign-off recorded in data).

## 16. Deferred / not covered in the MVP
- v1 stories US-E7-08, US-E12-02, US-E12-03, US-E12-04 and US-E3-06/AC4: not tested until the PO approves v1; listed in `trace.allowUntested` with that reason.
- iOS: not a target; Safari is a manual smoke check only.
- Sync, accounts and data isolation between families: v1+ (data contract §7); no auth exists in the MVP, so isolation tests are out of scope. The seam (`ownerId` on every record) is checked by a schema test.
