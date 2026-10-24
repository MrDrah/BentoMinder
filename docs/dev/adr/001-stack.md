# ADR-001: Client stack, i18n, dates, routing and the local AI proxy

Status: proposed · 2026-10-24 · Owner: Developer

## Context
BentoMinder is a Japanese-first, mobile-first family app (PO brief §3, §12). It must:
- run locally in a browser and be tested with Playwright (§12, §16);
- be packaged later as an Android app with Capacitor **without a rewrite** (§12), so everything must work inside an Android System WebView: no SSR, no server-only routing, no APIs the WebView lacks (Web Notifications, Web Share, Push, Background Sync);
- keep the AI key off the client (§7), which needs a small server-side piece even in the MVP;
- show every string in 日本語 (default) or English with a visible toggle (§3), in Japanese date formats and Asia/Tokyo time regardless of the device's timezone (§3, §11, §16);
- stay inside the framework budget: **400 KB gzip JS**, 50 KB gzip CSS, usable in < 2.5 s on a mid-range phone on 4G (PROJECT_BRIEF §9).

Related: ADR 002 (AI extraction provider, in progress), ADR 003 (local data), ADR 004 (domain engines), ADR 005 (notifications / Android, in progress).

## Decision
**One npm package**: React 19 + TypeScript (strict) + Vite, a single runtime dependency besides React (**zod** for schemas), a **typed in-house dictionary** for i18n, **no date library** (a ~100-line `jst` module over `Intl`), a **~60-line hash router**, Vitest + Testing Library for unit/component tests, Playwright + axe for e2e, and a **dependency-free Node HTTP proxy in `server/`** (Node's built-in type stripping, no Express) that Vite proxies `/api/*` to during development.

| Concern | Choice |
|---------|--------|
| Build / UI | Vite 7, React 19, TypeScript 5.x strict, `erasableSyntaxOnly` (so the same `.ts` files run in Node without a compiler) |
| Runtime deps | `react`, `react-dom`, `zod` (v4). Android adds Capacitor packages in M6 (ADR 005) |
| State | React context + `useReducer` around the domain store; no Redux/Zustand |
| Routing | `src/ui/router.ts`: typed hash routes (`#/calendar/2026-11`, `#/day/2026-11-05`, `#/recipe/<id>`, `#/settings`, `#/onboarding/<step>`) |
| i18n | `src/i18n/{ja,en}.ts` typed dictionaries, `t(key, params)`; `ja` is the source of truth for keys |
| Dates | `src/domain/time/`: `LocalDate` (`'YYYY-MM-DD'` civil date), `Instant` (epoch ms), fixed `+09:00` JST conversion; display via `Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tokyo' })` |
| Validation | zod schemas in `src/domain/schema/`, shared by client and `server/`; `z.toJSONSchema()` produces the structured-output schema the extractor sends (ADR 002) |
| Unit tests | Vitest + `@vitest/coverage-v8` (≥ 90 % on `src/domain`), Testing Library + jsdom for components |
| E2E | Playwright (Chromium mobile 390×844 and desktop 1280×800) + `@axe-core/playwright`, against the production build, extractor mocked with `page.route`, time via `page.clock` |
| Dev proxy | `server/index.ts` on `node:http`, port 8787, run with `node --env-file=.env server/index.ts` (Node ≥ 22.18 strips types natively) |
| Fonts | System Japanese fonts (Hiragino / Noto Sans CJK JP / Yu Gothic) via the token stack; no web-font download (a JP web font is 1–2 MB) |

### Why each choice

**React + Vite + TS.** Framework default (`implementation` skill §1), team skill, and Capacitor's documented path is "any static web build in `dist/`". Vite builds with `base: './'` so the same `dist/` loads from `https://localhost` in the Capacitor WebView.

**i18n: typed dictionary, not react-i18next.** We have two locales, ~250 strings, almost no plural forms (Japanese has none; English needs a handful, handled with `Intl.PluralRules`). `i18next` + `react-i18next` cost ~22 KB gzip and give us runtime key lookup by string, i.e. typos are found by users, not the compiler. A typed dictionary (`en satisfies Dictionary<typeof ja>`) makes a missing English key a **type error**, costs < 1 KB of code, and keeps parameterised messages as plain functions, which reads naturally in Japanese (`(p) => \`${p.weekday}の給食には、苦手な食材が${p.count}つ含まれています。\``). Both dictionaries are bundled (two × ~10 KB); the switch is instant and works offline. The framework's `src/ui/copy.ts` rule maps to `src/i18n/`: the designer's copy sheet (`design/copy.md`) is the source; UI components never contain literal strings (lint rule + a unit test that renders every screen in both locales and fails on any missing key).

**Dates: no library.** All the app's time logic is "a civil date in Japan" or "a wall-clock time in Japan". Japan has had a fixed UTC+09:00 offset with no DST since 1951, so converting `2026-11-04 17:30 JST` to an instant is `Date.UTC(2026, 10, 4, 17, 30) − 9 h`, independent of the device's timezone. A `LocalDate` string type avoids the classic bug where `new Date('2026-11-05')` becomes Nov 4 in a negative-offset device timezone. Display uses `Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' })` → `11月5日(木)`, and the `en` equivalent. Alternatives cost bytes for features we don't need: `date-fns` + `@date-fns/tz` (~6–10 KB for our subset), `dayjs` + tz plugin (~7 KB, mutable-plugin model), Temporal polyfill (~50 KB; native Temporal is not in every Android WebView we must support). The module is pure and gets exhaustive tests (month ends, leap years, year boundary, device TZ set to `America/Los_Angeles` and `Pacific/Kiritimati` via `TZ=` in a test project).

**Japanese era (令和).** Not used for display: Japanese parents read 西暦 calendars daily and mobile calendar apps show `2026年11月`. School menus often head the page with `令和8年11月`; converting that to an ISO month is the **extractor's** job (ADR 002) and the review screen shows the Gregorian month for the parent to confirm. The domain keeps a tiny `reiwaToGregorian()` helper only to cross-check the extractor's output (Reiwa 1 = 2019). Revisit if the designer or BA finds parents expect 令和 on screen.

**Routing: tiny hash router.** Capacitor serves the app from `https://localhost/index.html`; path routing works there but breaks on reload of a deep URL in other static hosts, and notification taps must deep-link (`#/day/2026-11-05`, `#/recipe/<id>`). We have ~8 routes; React Router (~20 KB gzip) is not justified. A typed `Route` union + `parseHash()`/`toHash()` is pure and unit-tested; screen state that should survive reload lives in the hash (`implementation` skill §5).

**zod.** The AI output must be validated against a schema (brief §7), the import/export file and the stored state too (ADR 003). One schema definition gives us: TypeScript types (`z.infer`), runtime validation with path-level error messages for the review screen, and a JSON Schema for the model's structured-output mode. ~13 KB gzip (zod v4); writing and maintaining three parallel artefacts by hand is the bigger risk.

**Dev proxy without Express.** The proxy has three endpoints (ADR 002 decides the provider call inside one of them): `GET /api/health`, `POST /api/menu/fetch-pdf` (server-side fetch of a public URL, avoiding CORS), `POST /api/menu/extract`. `node:http` + `fetch` is enough. Node ≥ 22.18 runs `.ts` directly (type stripping), so `server/` shares `src/domain/schema/*.ts` with the client without a build step or `tsx`. The key lives in `.env` (git-ignored) and is documented in `.env.example`.

**Single package, not a monorepo.** One `package.json`, three `tsconfig` projects (`tsconfig.app.json` for `src/`, `tsconfig.server.json` for `server/`, `tsconfig.node.json` for config/scripts). Workspaces would add tooling for one shared folder.

### Android WebView compatibility rules (enforced in review and by a lint rule)
- No direct use of `Notification`, `navigator.share`, `navigator.clipboard` (clipboard is allowed only inside the web `Share` adapter, with a fallback), `localStorage`/`indexedDB` (only inside the web `Storage` adapter), `Date.now()`/`new Date()` (only inside the `Clock` adapter). These go through ports (see `docs/dev/architecture.md`).
- No service worker in the MVP (not needed; avoids cache-staleness bugs inside Capacitor).
- `<input type="file" accept="application/pdf">` for upload (works in the WebView via Capacitor's file chooser).
- Targets: `build.target: ['es2022', 'chrome111']` (Android System WebView updates via Play Store; Android 8+ devices with a current WebView meet this).

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| react-i18next / FormatJS | 22–40 KB gzip, string keys not type-checked; our two-locale, plural-free copy doesn't need ICU |
| date-fns + @date-fns/tz, dayjs, Luxon | Bytes for features we don't use; JST has no DST, so a fixed offset is exact |
| Temporal (native/polyfill) | Not available in all target WebViews; polyfill ~50 KB |
| React Router / TanStack Router | ~8 routes; 15–20 KB gzip; our hash router is ~60 lines and fully unit-tested |
| Next.js / Remix | SSR is incompatible with a Capacitor static bundle; nothing here needs SSR |
| Ionic React UI kit | Large, imposes its own visual language; the design direction is custom (brief §14) |
| Express / Fastify / Hono for the proxy | Three endpoints; `node:http` is enough and has no supply-chain surface |
| `tsx` / `ts-node` for the proxy | Node ≥ 22.18 strips types natively; one less dependency |
| npm workspaces monorepo | One shared folder (`src/domain/schema`) doesn't justify it |
| Hand-written validators instead of zod | Three artefacts (types, validator, JSON Schema) to keep in sync by hand |

## Consequences
- **Bundle estimate**: React + ReactDOM ~60 KB, zod ~13 KB, app code + two dictionaries ~60–90 KB → **~140–170 KB gzip**, well under 400 KB. Recipes JSON (`data/library.json`, 20 recipes × 2 languages) is imported statically (~15 KB gzip).
- **Node version**: the proxy needs Node ≥ 22.18 (native type stripping). Node 20 reached end of life in April 2026, so we recommend `preflight.nodeMajor: 22` (see `docs/dev/architecture.md` §8).
- `erasableSyntaxOnly` forbids TS `enum`s and parameter properties; we use string-literal unions instead (better for JSON anyway).
- Every new string needs a `ja` and an `en` entry or the build fails. That is intended.
- We own ~200 lines of infrastructure (router, jst, i18n) that libraries would otherwise provide. Each is pure and covered by unit tests.
- Must test: `jst` across month/year boundaries and foreign device timezones; router round-trip; both locales render every screen; production bundle contains no debug code (architecture §5).

## Revisit when
- A third locale or real plural/gender rules are needed → reconsider FormatJS / i18next.
- The app must schedule in a timezone other than Asia/Tokyo, or Japan reintroduces DST → adopt `@date-fns/tz` or native Temporal.
- More than ~15 routes or nested layouts → React Router.
- JS bundle passes 250 KB gzip → audit before it becomes a budget problem.
- The proxy needs auth, persistence or more than ~5 endpoints (v1 hosted adapter) → pick a framework in that ADR.
