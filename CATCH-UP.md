# CATCH-UP — read this first

> **To an AI assistant opening this repo:** you are the Orchestrator. Read this file, then `CLAUDE.md` and `docs/PLAN.md`. Run `node .claude/skills/quality-gate/scripts/validate.mjs preflight`, confirm the state against the repo (`git log`, the gate), then tell the product owner in a short summary where things stand and what you propose next. Don't redo work marked done.
>
> **To the product owner:** on a new device, **clone** the repo (a downloaded zip has no history and can't push), open it in Claude Code and say: *"Read CATCH-UP.md and catch up."*

Last updated: 2026-11-10 (E14 hosted AI proxy live; E15 cloud sync + shared family space built and QA-fixed, not yet deployed or pushed; JS budget 445 KB) · Repo: origin = github.com/MrDrah/BentoMinder (public; PO authorized pushing 2026-10-31; first push done) · Live: none · Framework: app-boilerplate v0.5.0

---

## 1. What we're building
**BentoMinder — おべんとう、忘れない。** A Japanese-first family app: import the kindergarten's monthly lunch PDF (one AI extraction, then parent review), flag school lunches the child probably won't enjoy, plan homemade bento days with one of three suitable recipes, and get reminded the day before. Web-first (React/TS), Android later via Capacitor.
Source brief: `docs/ba/po-brief-2026-10-24.md` · Summary: `docs/PROJECT_BRIEF.md` · Rules and decisions: `docs/PLAN.md` §3 and §7.

## 2. How the work is organised
Roles and briefs: `CLAUDE.md` §1 and `.claude/agents/`. Rules and decisions: `docs/PLAN.md`. Framework weaknesses found along the way: `docs/framework-lessons.md` (kept separate from app issues).

## 3. Status

### Done ✅
| UI refresh (2026-11-11) | Breathy SP-first layout, collapsible about, redesigned day tiles + legend, button cascade fix; independent QA passed (0 P1/P2), cycle-1 fixes merged, release gate green. Open: PO phone check, wife join test, LCP 2.9–3.3 s vs 2.5 s | `tests/reports/qa-ui-refresh.md`, `design/ui-refresh-2026-11.md` |
| Email + password sign-in (2026-11-12) | US-E13-08: sign-in/create/forgot modes, confirmed-email hard wall, membership never stores an unconfirmed email; QA 208 tests, 0 P1/P2. PO steps: enable Email/Password provider, add wife email to ALLOWED_ACCOUNTS, redeploy functions | `docs/dev/adr/014-accounts-and-sign-in.md`, `tests/reports/qa-e13-email.md` |
| Motion (2026-11-11) | Press feedback, sheet/dialog entrance, month fade; CSS-only, reduced-motion safe; US-E16-01 | `design/motion.md`, `tests/e2e/motion.spec.ts` |
| Area | What exists | Key files |
|------|-------------|-----------|
| Scaffold | Project created with `new-project.mjs --content-app`, local git, first commit | `.claude/`, `quality-gate.json` |
| Brief | PO brief saved verbatim; structured brief with proposed defaults | `docs/ba/po-brief-2026-10-24.md`, `docs/PROJECT_BRIEF.md` |
| Kick-off | Approved by the PO: architecture, BR-01…27, design direction, OQ-01…15 | `docs/PLAN.md` |
| M0 | App skeleton: Vite/React/TS, i18n + toggle, JST module, contract v1 schemas, storage, proxy health, data scripts; dev gate green | `src/`, `server/`, `scripts/`, `tests/` |
| H2 | Final tokens, 64 component specs, flows, a11y spec, ja/en copy (561 rows), preview v1.0 | `design/` |
| H1 | 73 stories / 287 ACs, data contract v1, dictionary, ADR 001–005, QA strategy + 4 oracles; ~30 rulings in PLAN §7 | `docs/ba/`, `docs/dev/`, `tests/plan/`, `tests/oracle/` |

### Since the MVP (2026-11-02 → 2026-11-09) ✅
- **Processed-food allergen rule, longer import timeouts, real-menu import**: done; the PO confirmed the real menu import works. Review-screen day options renamed ("Homemade bento day" / "Day with cafeteria lunch").
- **E13 accounts (ADR 014, PLAN §7 2026-11-09)**: Firebase Google sign-in (login wall, stays signed in, sign-out in Settings, per-account data `bentominder.<uid>.state`, first account adopts the old local data, reminders cancelled on sign-out). QA found 3 defects (D02 P1 records kept the old owner id, D01, D03), fixed in cycle 1 of 2; PO retested the real login on localhost: OK. Config is `VITE_FIREBASE_*` in the git-ignored `.env` locally; the deploy workflow reads them from GitHub repository **Variables** (public web config). JS budget raised to 420 KB gz for the Firebase SDK. Later: email+password, Sign in with Apple (iPhone), sync/backup, account deletion, APPI consent, Capacitor native sign-in. Open nit: QA-D04 (privacy line position, stories vs design).
- Lesson: a running dev server (proxy on :8787) makes the e2e reuse the real-Gemini proxy and fail; stop it before the gate.

### Since 2026-11-09 (E14, E15) ✅
- **E14 hosted AI proxy**: Firebase function `api` (Tokyo, Blaze, budget alert 1000 yen), secrets GEMINI_API_KEY and ALLOWED_ACCOUNTS in Secret Manager, Firestore proxy counters; Pages site built with repository variables FIREBASE (7 VITE_FIREBASE_* lines) and AI_PROXY_BASE_URL; PO verified a live import. Firebase CLI is logged in on the PC (q.milavec@gmail.com). Deploy: `npx firebase-tools deploy --only functions --project bentominder`; the git-ignored functions env file (copy of functions/params.example) must contain the params.
- **E15 cloud sync + shared family space** (ADR 016, stories US-E15-01..11): sync Cloud Function `sync`, engine src/domain/sync, screens src/ui/sync, QA done (report tests/reports/qa-e15.md), fix cycle 1 done, dev and release gates green (2654 unit, 178 e2e). **Local commits only; not pushed, not deployed.** Before first real upload: PO reviews consent text (design/copy.md §22.1), deploy sync function, set repository variable SYNC_BASE_URL and VITE_SYNC_BASE_URL wiring in deploy workflow, manual two-device smoke test (FakeFirestore is not real Firestore).

### In progress 🔄 — PAUSED 2026-10-25 by the PO (resume next weekend)
Two tasks were stopped at a safe point; each wrote pause notes:
- **M2 build**: DONE and merged to main (5ded922); dev gate green (644 unit, 50 e2e). ADR 007 written. Still open by design: holidays, amb-soba flag, recommendations (M3), popover picker, Today/reminders (M4). Open questions for PO/BA: AC13 empty list after refresh, "next 7 days" = today..+6, lower-cased English food labels, `{wdLongEn}`→`{wdLong}`. **M2 QA done (0 oracle diffs; defects M2-D01 P3 focus after day-sheet action, M2-D02 P4 flaky shell test). D01+D02 fixed (bf17074). Label round slice 1 done (ketchup/curry-powder, verifier fixes 2a-2e, ham+sausage labels; overlap 20 PASS; nipponham.co.jp approved). Label slice 2 done (tuna, salmon flakes, miso, processed cheese labelled; dictionary notes; contract §3.7/§6.1/§3.10; brief §5). Still unknown (no fetchable label): tarako, sakura-denbu, bread crumbs, rolls/bread, tortilla, stick+cheddar cheese. Lesson: a leftover dev server on :8787 makes e2e reuse it and fail (stop it before the gate). M3 DONE (engine 6d79900, UI 0113df0, QA GO; defects M3-D01 P3 content reword of 8 en notes, M3-D03 P4 empty allergen box; D02 ruled in PLAN §7). M4: A reminder engine (8e5b9f9), B in-app reminders/Today/settings/theme + M3-D03 fix (54e5eff, ADR-011); M3-D01 fixed. One unit test failed once in 1 of 7 gate-style runs (not identified; QA to catch it by capturing output). M4-C share + debug panel done (c7b0421, ADR-012). M4-D QA GO (oracle 0 diffs, full journey green; flaky shell title test fixed with waitFor, contract line 319 aligned). H4 status: release gate green locally; D-H4-01 fixed (1245f2b); US-E6-07/AC4 partial (8 of 20 verifier-reviewed, 12 left ba-research). M5 slice A done (86c17a4: Gemini transport + 36 contract tests; no live call made). Next: M5 slice B (privacy/consent UI US-E2-08, on-disk cache), then the first live eval (needs PO yes; sends the public fixture PDF to Google with the PO key);  key already added by the PO); verifier over the remaining 12 recipes before any live release; also fix M3-D03 and designer to confirm qty.* copy.1/§3.10; brief §3) per pause-notes.md.**
- **Recipe label round** (BA, Sonnet from now on): **not started on any record** (batches untouched). Order to resume: 2b ketchup/curry-powder → `varies-by-product` (8 rows, 7 recipes, no fetching), then 2a curry-chahan, 2c quesadilla, 2d storage note, 2e pistachio, then maker labels (ham + sausage first: 7 recipes), dictionary sources + matsutake, contract §3.7/§6.1/§3.10 + brief §3. Notes: `docs/ba/_scratch/research-labels/pause-notes.md`.

**Main is committed** (bea84df, dev gate green): recipe research, dictionary ids, schema change, copy fix, docs. Only the M2 worktree branch is unmerged.

### How to resume (new session in this folder; everything on Sonnet, Opus only with PO approval, per CLAUDE.md §6 "Lean orchestration")
0. **Lean orchestration (merged to main, 7a70e23)** holds the orchestration changes (CLAUDE.md §6, six agent files `model: sonnet`, `.claude/settings.json`, PLAN §7 row, `docs/dev/lean-orchestration-baseline.md`). Rollback point: tag `checkpoint/pre-lean-orchestration-2026-10-25` (main 456f7df)..
1. Read this file, PLAN §7 (latest rows), and both pause notes. Run preflight; log `evidence.mjs event resume`. Consider logging it as `recovery-test` (a fresh session restoring from CATCH-UP alone is the evidence package's recovery check).
2. **Label round:** re-dispatch a `ba` agent with "continue the label round from pause-notes.md" (baseline `research-labels`). Then: add the new maker hosts to `APPROVED_HOSTS` in `scripts/validate-data.mjs`, `npm run merge:research`, `validate.mjs overlap --fetch` (must be 0 FAIL, 0 UNVERIFIED), quick verifier re-check of the 2 failed records.
3. **M2:** re-dispatch the `developer` (Sonnet) in the same worktree with "continue M2 from m2-pause-notes.md". Then merge locally, `diff-guard --task m2-build`, **gate + QA suite on main before any commit** (FL-15).
4. M2 QA (Sonnet): oracles as executable tests (0 diffs); clean up `tests/e2e/qa/**` lint and restore the two rules.
5. Then M3 (recipe suggestions), M4 (reminders, today, share, debug, full e2e), M5 (real Gemini: PO creates the key and writes `.env` + the env example file), M6 (Android report, can wait), H4, MVP evidence package.

### Next 📋
**Library growth (PO request 2026-11-01): 20 → 92 recipes** (batches c–h, candidates in data/_research/candidates-2.json; 72 new recipes are `reviewedBy: "ba-research"`, not verifier-reviewed, by the PO's "no tests for now"; dictionary 181 → 227 ingredients; library budget 200 KB gz, JS bundle 348 KB of 400 KB; overlap audit 92 PASS). Next candidates: (a) label pass on the commonly-unknown processed foods (bread, breadcrumbs, tortilla, cheese, furikake, chikuwa, umeboshi) so ~70 % of the new recipes get complete allergen data, (b) verifier pass on the 72, (c) ~8 more recipes from reserves to reach 100. Lesson: the unit run needs `NODE_OPTIONS=--max-old-space-size=4096` and e2e `--workers=3` on this machine when memory is low; a stale proxy/preview on 8787/4173 breaks e2e.
MVP is feature-complete and green (release gate, CI, Pages preview deployed: https://mrdrah.github.io/BentoMinder/). Milestones M0–M6 done: M5 live Gemini works on synthetic fixtures (primary now gemini-3.5-flash-lite, fallback gemini-3.8-flash; 0 invented allergens in 23 live calls; 7 of 9 first-pass fixtures ok, the 2 failures fixed after prompt changes); all 20 recipes verifier-reviewed; Android feasibility doc written (GO for a 1-day spike).
1. MVP approved by the PO 2026-11-01; evidence packages `mvp` and its correction `mvp-r2` frozen (r2 adds the late-logged events; UNVERIFIED overall: functional 87.7% of ACs, cost token-only by PO choice under a subscription, no controlled recovery test). The 26 Oct–1 Nov corrections, defects and interruptions were late-logged (marked) and are in mvp-r2; their log timing is the logging time. Lesson: log events when they happen (CLAUDE.md §2.2).
3. **Hosting decision (PO, 2026-11-01): everything local for the MVP.** Real import: `npm run dev` (Vite + proxy on 127.0.0.1:8787, key read from the git-ignored `.env`), open the printed local URL. The Pages preview is a mock-only demo and may be taken down at any time. Not in the MVP / v1: hosted AI proxy (caps, origin allowlist, access code, SSRF check), accounts/sync, Android build (feasibility doc says GO for a 1-day spike), holidays US-E8-04, reservation reminder US-E7-08, a live check of the real school PDF (PO must approve sending it to Google; a copy is in the git-ignored `local-mocks/`).

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
- Local git only; no push, deploy or paid services without PO approval.
- Architecture approved: React/TS web app, all family data on the device, rules engine without AI, local proxy holds the Gemini key; Android later via Capacitor adapters.
- AI: Gemini free tier, `gemini-3.8-flash` + `gemini-3.5-flash-lite` fallback; import used from Japan only; only the public PDF is sent.
- Design: white page background (`surface-1` #FFFFFF), navy type, soft-red accents, Monday week start, no tab bar.
- All 15 open-question defaults accepted.
- **Lean orchestration (PO, 2026-10-25; replaces the 2026-10-24 model rule):** Sonnet for the Orchestrator and all agents, Opus only with explicit PO approval; BA only for initial requirements, unresolved decisions, research and milestone acceptance; developer gets bounded tasks with a stopping point; Developer/QA fix loops stop after two cycles; QA stays independent. Baseline and measurements: `docs/dev/lean-orchestration-baseline.md`.

## 5. How to work in this repo
```bash
npm ci
npm run dev            # proxy (127.0.0.1:8787) + Vite
node .claude/skills/quality-gate/scripts/validate.mjs gate --stage dev
npm run test:e2e
```
- Generated files (see `quality-gate.json` → `generated`) are never hand-edited.
- Commits: small and descriptive. No remote yet.

## 6. Lessons learned
- Open Claude Code **in this folder** for BentoMinder work (the kick-off started from another project's session; see `docs/framework-lessons.md` FL-01).
