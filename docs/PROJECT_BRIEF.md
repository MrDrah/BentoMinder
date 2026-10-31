# Project brief — BentoMinder

Filled by the Orchestrator from the product owner's brief (`docs/ba/po-brief-2026-10-24.md`) at kick-off · 2026-10-24 · framework v0.5.0

> Items marked **(default)** are the Orchestrator's proposals, awaiting the product owner's confirmation. Everything that changes what gets built is a business rule (BR-xx) or a decision-log row in `docs/PLAN.md`.

## 1. The product in one paragraph
**BentoMinder — おべんとう、忘れない。** A Japanese-first family app for parents whose kindergarten publishes a monthly school-lunch menu as a public PDF. It imports that PDF once a month (one AI extraction, then parent review), flags the days the child probably won't enjoy the school lunch, lets the parent decide "homemade bento" for a day and pick one of three suitable recipes, and reminds the family the day before. Today the family relies on memory and ad-hoc planning; BentoMinder makes the plan visible and the reminder automatic, without touching the school's own reservation process.

## 2. Users
| Who | What they want to get done | How often | Device |
|-----|----------------------------|-----------|--------|
| Planning parent | Import the month's menu, see unpopular days, decide bento days, pick recipes | Monthly import; a few minutes weekly | mobile (primary), desktop |
| Other parent | Know which days are bento days and what to make | Daily glance; day-before reminder | mobile (shared summary in MVP; same device or copied text) |

## 3. The core rule
**A school day's preference assessment and the family's decision are separate, and the app never changes the decision on its own.** A low-preference day is only a suggestion; a day becomes "homemade bento" only when the parent confirms a recipe for it, and it stays that way (including across menu refreshes) until the parent changes it. QA builds an independent oracle for the assessment and for the decision state machine.

The one thing the product must **never** do: **claim allergy safety, or suggest a recipe that contains a known allergen or excluded diet item of the child.** (Close second: never claim a school-lunch reservation was made or cancelled.)

## 4. Scope
| Must have (MVP) | Should have (v1) | Later / out of scope |
|-----------------|------------------|----------------------|
| Onboarding: one child profile, PDF URL or upload, menu review | Android test build (Capacitor) with scheduled local notifications | Google Play publication |
| AI extraction of the Japanese monthly menu (one call/month) via a server-side adapter, schema-validated, fixtures for tests | Re-import from saved URL with change diff | Multi-child profiles |
| Deterministic preference assessment with explanation + manual override | Recipe library growth beyond 20 | Synced family planning (accounts, auth) |
| Calendar: assessment vs decision, confirmed bento shows recipe name | "Reservation done" reminder at the school's cut-off time | AI-generated recipes |
| 3 ranked bento suggestions from a curated, sourced library of 15–20 recipes; recipe detail; change/cancel | | Booking school meals |
| In-app reminders (weekly Sun 14:00, day-before 17:30 JST, today view), configurable | | |
| 日本語 / EN toggle, all strings localized, Asia/Tokyo | | |
| Share weekly plan as text / OS share | | |
| Local storage, versioned schema, export/delete | | |
| Dev-only debug panel | | |
| Android feasibility assessment (document only) | | |

## 5. Data
- **Menu:** imported from the school's public PDF by the parent; extracted by AI, then confirmed by the parent. Belongs to the family (local).
- **Recipes:** researched from public, trusted Japanese and English recipe sources (e.g. recipe publishers, food-safety guidance from MAFF / 厚生労働省 / 農林水産省 for bento handling), written in our own words with source references. Must be real and sourced. 15–20 at launch, maybe 50 in a year.
- **Processed-food allergens:** for processed ingredients (ham, sausage, ketchup, miso, canned tuna…) a recipe records the allergens printed on one cited maker label and tells the parent to check the label of the product they use (`varies-by-product`). Where no label could be fetched the ingredient stays `unknown`, and the recipe is shown as allergen data incomplete, never as allergen-free.
- **Child profile and plans:** typed by the parent, stored only on the device.
- **Sample menu fixtures:** realistic but **synthetic** Japanese kindergarten menus written for tests (marked as such; never presented as a real school's menu).

## 6. Accounts (v1 — answer now even if "not in MVP")
- [x] Later: users save things (plans shared between two parents' devices) **(default: v1+ only, design seam now)**
- Roles needed: none in MVP; v1 "family member" role.
- Preferred sign-in: **(default)** decide at v1; magic link or Google.
- Personal data you'd collect: child nickname (optional), age range, food preferences, allergies, themes. No birthdate, gender, height, weight.

## 7. Integrations (v1)
| Service / API | What for | Free tier OK? | Who owns the account/keys |
|---------------|----------|---------------|---------------------------|
| Google Gemini Developer API | Monthly menu extraction from PDF to JSON | Yes — must be confirmed against current limits and privacy terms at kick-off | Product owner (API key kept server-side, never committed) |
| Capacitor Local Notifications | Android scheduled reminders | Free (open source) | n/a |

## 8. Look and feel
Soft and warm, playful but practical, clean. Inspired by French children's fashion (cream-white, navy type, soft red accents, restrained stripes), with an original identity. Large touch targets, clear calendar indicators. Dark mode: **(default)** supported via tokens, light is primary.

## 9. Constraints
- Budget for hosting/services per month: **¥0 / free tiers only**; no paid API without approval.
- Must run without a server? No: a small server-side adapter is needed for the AI key. MVP runs it locally (local dev proxy). **(default)** Hosted adapter deferred until the PO approves a deploy target.
- Languages / locales: ja-JP (default), en. Timezone Asia/Tokyo for all scheduling.
- Accessibility target: WCAG 2.1 AA.
- Performance target: usable in < 2.5 s on a mid-range phone on 4G.
- Legal/compliance: Japan APPI (child data stays local; only the public menu PDF goes to the AI provider); Gemini free-tier data-use terms explained to the PO before enabling; recipe text in our own words with credits.
- No push, deploy or paid services without the product owner's approval.

## 10. Success
A parent can go from "PDF URL" to "a confirmed bento day with a recipe and a reminder" in **under 5 minutes** on first use, and **under 1 minute** for a later month's planning. The end-to-end journey (import → confirm → low-preference day → choose bento → recipe → save → calendar → reminder → reopen recipe) passes in Playwright. Menu extraction on the sample fixtures: **every dish of every day mapped to the correct date** after parent review, with uncertain fields flagged rather than guessed.

## 11. Working preferences
- Status updates: short.
- Decisions: options with a recommendation (default).
- Who approves pushes to the live site: the product owner. Local git only until approved.
