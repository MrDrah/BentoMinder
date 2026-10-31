# ADR 012: M4 slice C, weekly share and the development-only debug panel

Status: accepted, 2026-10-31. Stories: US-E9-01, US-E9-02, US-E11-01..03. Builds on ADR 004 §share, ADR 005, ADR 011.

## Share
- `src/domain/share/week-text.ts` is pure. `shareWeek(store, today, viewer)` returns only dates, decision kind and recipe-name snapshots for the 7 days from tomorrow (independent of `weekStartsOn`); `composeShareText` receives already-translated labels. It never sees the profile, so US-E9-02/AC1 holds by construction, not by filtering.
- `Share` port gained `canShare()` and `copy()`. The web adapter tries `navigator.share`, falls back to the clipboard when it is missing or rejects (a dismissed sheet counts as a rejection, AC2), and returns `'cancelled'` only when neither delivered the text (AC4). Nothing runs before a tap.
- `ShareSheet` (calendar, under the legend) shows the exact text in a read-only preview, the two notes, 「共有する」 only when `canShare()`, and 「コピーする」. On failure it selects the preview text.
- The share text follows the app language; the keys are the `share.*` rows of `design/copy.md` §15.

## Debug panel
- `main.tsx` loads `src/debug/*` only behind `import.meta.env.DEV` (dynamic imports), so Vite drops the module, its catalog and its fixture imports from production. `check:no-debug` (unchanged) and the e2e bundle scan prove it; a unit test pins that nothing else imports `debug/`.
- The panel renders inside `AppProvider`, so it uses the app's store, services and Tokyo date. Simulated time is an offset added to the real clock (`wrapClock`), so time keeps running from the chosen instant; the panel fires a `focus` event so the app re-reads today and re-plans at once. No production code knows about the offset.
- Trigger buttons plan reminders for the simulated time with the log ignored and both reminder types forced on, and render the normal banner marked 「デバッグ表示」 inside the panel. They write nothing (US-E11-02/AC2). 「強制表示」 shows both at once.
- Failure modes wrap the extractor and PDF source (`sim.ts`): each mode returns what its story describes (provider-call counts 2, `simulated-primary` / `simulated-fallback` models). `url-unreachable` fails `fromUrl`.
- Samples reuse the existing fixtures (`tests/fixtures/state/v1.json` profile, `recorded/hand-1.json` menu through `parseModelReply`); loading the menu records an extraction and opens the review, with no AI call.
- Strings come from `src/debug/catalog.ts`, generated from `design/copy.md` §18 by `docs/dev/_scratch/gen-debug-catalog.mjs`.

## Revisit if
- v1 adds a native share plugin: implement `Share` on it; the sheet does not change.
- A second debug feature needs state outside the app providers: then promote `sim.ts` to a small store.
- Android (ADR 005) needs reminders triggered natively: the trigger buttons stay web-only.
