const fs=require('fs');const f='docs/ba/user-stories.md';let s=fs.readFileSync(f,'utf8');
function rep(a,b){if(!s.includes(a)){console.error('MISSING:',a.slice(0,90));process.exit(1)}s=s.replace(a,b)}
rep('72 stories / 245 ACs → 73 / 264)','72 stories / 245 ACs → 73 / 264 at the first H1 pass → 73 / 278 after the H1 fix round)');
rep('| Traceability | 176 scenario titles now end with the BR they enforce `(BR-xx)` | | |',
`| Traceability | 176 scenario titles now end with the BR they enforce \`(BR-xx)\` | | |
| H1 fix round, B1/B2/B5 (PLAN §7 "H1 rulings on QA blockers", "H1 follow-ups confirmed"): D/L = distinct found dictionary ids, most specific profile entry wins, same-level tie → dislike, item with match + unresolved ambiguity counts in U | E4 rule paragraph (one counting paragraph + worked example), E6 ranking paragraph ("per liked id") | US-E4-01/AC11, AC12, AC13, AC14 | |
| H1 fix round, B4: explanation key per mixed case | | US-E4-02/AC4 | |
| H1 fix round, B6/B7 + follow-ups: refresh conflicts (planned day turned no-lunch or removed: kept, flagged 「献立が変わりました」, only KEEP_PLAN or clear, reminder stays; お弁当の日 not flagged; dormant overrides and not-confirmed / school-lunch records; needs-review list) | US-E3-05/AC2, E5 state-machine table (2 rows + timestamp note) | US-E3-05/AC6, AC7, AC8, AC9, AC10 | |
| H1 fix round, B10: \`plannedAt\` drives day-before suppression; a recipe change never deletes a pending reminder | US-E7-02/AC5, AC6, US-E5-03/AC2 | US-E7-02/AC7, AC8 | |
| H1 fix round, B14: diets on ingredient-level animal-origin tags, unknown origin → \`diet-incomplete\` | US-E1-04/AC1, AC4, E6 hard-filter note 2 | US-E6-02/AC7, AC8 | |
| H1 fix round, developer item: short-name snapshot on DayDecision | US-E5-01/AC4, US-E6-06/AC1 | | |
| H1 fix round, developer item: call-2 triggers listed as in BR-10 (429, 408/timeout, 5xx; 400/403/404 never retried) | Conventions | | |
| H1 fix round, non-blocking: onboarding = 3 input steps then the calendar (QA N1); banned phrases in \`data/banned-phrases.json\` (QA N4); out-of-month no-lunch entries (QA N5, FX-Q3); reload month confirmed (QA N7) | US-E1-01/AC1, US-E4-04/AC1, US-E5-07/AC2, US-E6-03/AC2, US-E2-05/AC4, US-E0-01/AC2 (comment only) | | |
| BR-14 tightened to https only (PLAN §7, H1) | US-E2-01/AC2 | | |`);
const idx=[['| E3 Menu review, confirm & refresh | US-E3-01 … 06 | 6 | 22 (1) |','| E3 Menu review, confirm & refresh | US-E3-01 … 06 | 6 | 27 (1) |'],
['| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 23 |','| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 28 |'],
['| E6 Bento recommendations & recipes | US-E6-01 … 07 | 7 | 26 |','| E6 Bento recommendations & recipes | US-E6-01 … 07 | 7 | 28 |'],
['| E7 Reminders & today view | US-E7-01 … 08 | 8 | 27 (1) |','| E7 Reminders & today view | US-E7-01 … 08 | 8 | 29 (1) |'],
['| **Total** | | **73** | **264 (10 v1)** |','| **Total** | | **73** | **278 (10 v1)** |']];
for(const [a,b] of idx) rep(a,b);
rep('reconciliations R-1, R-2, R-3 applied)','reconciliations R-1, R-2, R-3 applied; H1 fix round of 2026-10-24 applied: rulings B1, B2, B4–B7, B10, B14 and follow-ups)');
fs.writeFileSync(f,s);console.log('ok');
