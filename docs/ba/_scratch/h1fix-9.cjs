// H1 closing rulings (PLAN §7 "H1 closing rulings"): A57, S10, O-3, U5, RU1, N3, AC15 precedence.
const fs=require('fs');
function load(f){return fs.readFileSync(f,'utf8')}
function rep(s,a,b,tag){if(!s.includes(a)){console.error('MISSING',tag||'',a.slice(0,90));process.exit(1)}return s.replace(a,b)}
function repLine(s,prefix,newLine){const i=s.indexOf(prefix);if(i<0){console.error('MISSING line',prefix.slice(0,60));process.exit(1)}const e=s.indexOf('\n',i);return s.slice(0,i)+newLine+s.slice(e)}
const US='docs/ba/user-stories.md';let s=load(US);
// verdict precedence
s=repLine(s,'3. *Verdict per food.*','3. *Verdict per food* (precedence ruling, PLAN §7 "H1 closing rulings"). Check the profile level by level; the first level with a like or a dislike decides, and if that level has both, the dislike wins: level 1 the food\'s ingredient ids themselves (for a dish food: its defining ingredient; for a descendant food: the descendant and the ancestor folded into it); level 2 their dictionary parent ingredients, nearest first; level 3 the dish id (dish foods only); level 4 the categories of those ids, then the categories\' ancestors, nearest first. So for a dish and its defining ingredient the order is ingredient → dish → category: a like on `ing-mackerel` with a dislike on `dish-saba-miso` makes 「さばのみそ煮」 liked. A food gets at most one verdict.');
// O-3 in collapse rule 2
s=rep(s,'siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). Nothing else collapses:',
'siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). A defining-ingredient link never takes part in a cross-item collapse: an ingredient id that is collapsed with a dish in its item stays with that dish and does not fold into a descendant found in another item (「鶏のから揚げ」 in item 1 + 「鶏もも肉のてりやき」 in item 2 = 2 foods). Nothing else collapses:','O-3');
s=s.replace('もも and むね liked (level 2, parent `ing-chicken`);','もも and むね liked (level 1, the folded ancestor `ing-chicken` is a member of each);');
// AC15 retire, add AC19 + AC20
const a15=s.indexOf('Scenario: AC15 A dish and its defining ingredient are one food (BR-04)');
const e15=s.indexOf('\n\n',a15);
s=s.slice(0,a15)+'  # AC15 retired at the H1 closing rulings: its second case gave the dislike on dish-saba-miso and the like/dislike on ing-mackerel as a same-level tie; the precedence ingredient → dish → category now decides (replaced by AC19).'+s.slice(e15);
s=rep(s,'  Then ing-chicken folds into each of ing-chicken-thigh and ing-chicken-breast, which stay 2 foods (D = 2)\n```',
`  Then ing-chicken folds into each of ing-chicken-thigh and ing-chicken-breast, which stay 2 foods (D = 2)

Scenario: AC19 A dish and its defining ingredient are one food; ingredient → dish → category decides (BR-04)
  Given a profile that dislikes dish-saba-miso and ing-mackerel
  And a school day lists 「さばのみそ煮」「ごはん」 with the ingredients さば, みそ
  Then dish-saba-miso and ing-mackerel collapse to one food, represented by dish-saba-miso, and D = 1, L = 0 (low-preference, 1 food in the explanation)
  Given instead a profile that likes ing-mackerel and dislikes dish-saba-miso
  Then the food is liked (level 1 ingredient beats level 3 dish): D = 0, L = 1, U = 0%, so the day is likely-enjoyable
  Given instead a profile that likes dish-saba-miso and dislikes cat-fish
  Then the food is liked (level 3 dish beats level 4 category): D = 0, L = 1, likely-enjoyable

Scenario: AC20 A defining-ingredient link never crosses items (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「鶏のから揚げ」 and 「鶏もも肉のてりやき」 (no ingredient list)
  Then {dish-karaage + ing-chicken} is one food and ing-chicken-thigh is a second food: ing-chicken does not fold into the thigh across items
  And D = 2, so the day is low-preference
\`\`\``,'AC19');
// E3-05: AC9 clarified, AC10 retired, AC11 (A57), AC12 (S10)
s=rep(s,'  Given November has stored decisions or overrides on 2026-11-04, 2026-11-11, 2026-11-18 and 2026-11-25',
'  Given November has 2026-11-04 homemade-bento-planned, 2026-11-11 not-confirmed, an override on 2026-11-18 and 2026-11-25 school-lunch-planned','AC9');
s=rep(s,'(changed dates that carry a stored decision or override)','(changed dates that carry an override or a stored homemade-bento-planned or not-confirmed decision; school-lunch-planned records are never listed)','AC9b');
const a10=s.indexOf('Scenario: AC10 A not-confirmed or school-lunch record on a date that becomes a no-lunch day stays dormant');
const e10=s.indexOf('\n```',a10);
s=s.slice(0,a10)+`  # AC10 retired at the H1 closing rulings: it listed the dormant school-lunch-planned record in 「確認が必要な日」; ruling S10 lists only not-confirmed records (replaced by AC12).

Scenario: AC11 An override on a date that the refresh removes is listed for review (BR-05, BR-13)
  Given 2026-11-11 is a school day with an override likely-enjoyable
  When the refreshed November menu no longer lists 2026-11-11 at all
  Then 2026-11-11 shows no assessment, and the override is still stored, byte-for-byte unchanged (dormant)
  And 2026-11-11 is listed in the refresh's 「確認が必要な日」 list
  When a later refresh lists 2026-11-11 as a school day again
  Then the override is applied again

Scenario: AC12 Not-confirmed and school-lunch records on a no-lunch or removed date stay dormant (BR-02, BR-13)
  Given 2026-11-11 has the stored decision not-confirmed and 2026-11-12 has the stored decision school-lunch-planned with reservationDoneExternally true
  When the refreshed menu no longer lists 2026-11-11 and marks 2026-11-12 as a no-lunch day with reason "closed"
  Then both records are still stored, byte-for-byte unchanged (dormant)
  And neither day shows its stored decision (2026-11-11 shows nothing, 2026-11-12 shows no-school-lunch) and neither offers a decision action
  And 2026-11-11 (not-confirmed) is listed in the refresh's 「確認が必要な日」 list and 2026-11-12 (school-lunch-planned) is not
  When a later refresh lists both dates as school days again
  Then they display not-confirmed and school-lunch-planned (with the reservation record) again, unchanged`+s.slice(e10);
// E5-06 RU1
s=rep(s,`Scenario: AC3 Cancel asks first (BR-02)
  When the parent taps 「給食に戻す」
  Then a dialog asks 「11月4日の手作りお弁当の予定を取り消しますか？」 and nothing changes on 「キャンセル」
\`\`\``,`Scenario: AC3 Cancel asks first (BR-02)
  When the parent taps 「給食に戻す」
  Then a dialog asks 「11月4日の手作りお弁当の予定を取り消しますか？」 and nothing changes on 「キャンセル」

Scenario: AC4 plannedAt is cleared when the day leaves homemade-bento-planned (BR-17)
  Given 2026-11-04 was planned at 2026-11-01T10:00+09:00 (plannedAt 2026-11-01T10:00+09:00)
  When at 2026-11-02T09:00+09:00 the parent sets it to 「あとで決める」 (or 「給食に戻す」 and confirms)
  Then the stored decision has no plannedAt
  When at 2026-11-02T20:00+09:00 the parent confirms a recipe for 2026-11-04 again
  Then plannedAt is 2026-11-02T20:00+09:00 (a new first confirm), and a later 「レシピを変更」 keeps that value
\`\`\``,'RU1');
// E5-08 U5
s=rep(s,`  Given 2026-11-20 is not planned
  Then no day-before reminder exists for 2026-11-20
\`\`\``,`  Given 2026-11-20 is not planned
  Then no day-before reminder exists for 2026-11-20

Scenario: AC5 Planning an お弁当の日 replaces a dormant record (BR-02, BR-13)
  Given 2026-11-13 had the stored decision not-confirmed and a refresh made it a no-lunch day with reason "bento-day", so that record is dormant (US-E3-05/AC12)
  When the parent opens 2026-11-13, taps 「お弁当を計画する」 and confirms recipe R (CONFIRM_RECIPE)
  Then the stored decision for 2026-11-13 is homemade-bento-planned with R and a new plannedAt, the dormant not-confirmed record is replaced (its state is kept only as an entry in history)
  And if a later refresh makes 2026-11-13 a school day again, it displays homemade-bento-planned with R, not not-confirmed
\`\`\``,'U5');
// E7-05 N3
s=rep(s,`Scenario: AC3 Weekly reminder expiry (BR-17)
  Then a weekly reminder expires at the end of the last day it covers, and only the most recent unexpired weekly reminder is shown`,
`Scenario: AC3 Weekly reminder expiry (BR-17)
  Then a weekly reminder expires at the end of the last day it covers, and only the most recent unexpired weekly reminder is shown

Scenario: AC4 A shown but undismissed reminder shows again until dismissed or expired (BR-17)
  Given the 2026-11-04 day-before reminder was shown at 2026-11-03 17:30 JST (shownAt set) and not dismissed, and the app was closed
  When the app opens again at 2026-11-03 21:00 JST
  Then the reminder is shown again, labelled with its original time, and still has no dismissedAt
  When the parent dismisses it and reopens the app at 2026-11-03 22:00 JST
  Then it is not shown again
  And if it is never dismissed, it is not shown on an open at or after 2026-11-04 00:00 JST (expired)`,'N3');
// index + changes table
s=rep(s,'| E3 Menu review, confirm & refresh | US-E3-01 … 06 | 6 | 27 (1) |','| E3 Menu review, confirm & refresh | US-E3-01 … 06 | 6 | 28 (1) |');
s=rep(s,'| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 32 |','| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 33 |');
s=rep(s,'| E5 Calendar & family decisions | US-E5-01 … 08 | 8 | 30 |','| E5 Calendar & family decisions | US-E5-01 … 08 | 8 | 32 |');
s=rep(s,'| E7 Reminders & today view | US-E7-01 … 08 | 8 | 29 (1) |','| E7 Reminders & today view | US-E7-01 … 08 | 8 | 30 (1) |');
s=rep(s,'| **Total** | | **73** | **282 (10 v1)** |','| **Total** | | **73** | **287 (10 v1)** |');
s=rep(s,'→ 73 / 282 after the H1 fix round)','→ 73 / 287 after the H1 fix round and closing rulings)');
s=rep(s,'| US-E4-01/AC17, AC18 | |','| US-E4-01/AC17, AC18 | |\n| H1 closing rulings (PLAN §7): verdict precedence ingredient → dish → category (A61); O-3 defining-ingredient links never cross items; A57 removed date with override listed for review; S10 dormant not-confirmed / school-lunch records on removed dates, only not-confirmed listed; U5 CONFIRM_RECIPE on お弁当の日 replaces a dormant record; RU1 plannedAt cleared on leaving homemade-bento-planned; N3 = OQ-20 | E4 counting paragraph (verdict levels, O-3, worked example wording), US-E3-05/AC9 (Given made explicit; listing rule narrowed to overrides and homemade-bento-planned / not-confirmed records; outcome unchanged) | US-E4-01/AC19, AC20; US-E3-05/AC11, AC12; US-E5-06/AC4; US-E5-08/AC5; US-E7-05/AC4 | US-E4-01/AC15 (→ AC19), US-E3-05/AC10 (→ AC12) |');
fs.writeFileSync(US,s);
// contract
const C='docs/ba/data-contract.md';let c=load(C);
c=rep(c,'Each food gets one verdict from the most specific profile entry covering any of its ids (the id itself → dictionary parent ingredient → category → ancestor categories, nearest first); at the deciding level a dislike beats a like.',
'Each food gets one verdict, checked level by level (H1 closing rulings): (1) the food\'s ingredient ids (incl. a folded ancestor), (2) their dictionary parent ingredients, (3) the dish id, (4) categories, then ancestor categories, nearest first; i.e. ingredient → dish → category; at the deciding level a dislike beats a like. A defining-ingredient link never takes part in a cross-item collapse (O-3).','C-verdict');
c=repLine(c,'**Needs-review list**','**Needs-review list** (derived after a refresh is confirmed, US-E3-05/AC9, AC11, AC12): the dates in `changedDatesSincePrevious` (incl. removed dates) that carry an `AssessmentOverride` or a stored `homemade-bento-planned` or `not-confirmed` `DayDecision`; a `school-lunch-planned` record alone never lists a date (S10). Shown once after the confirm and reachable from the flagged days; never stored, never changes a record.');
c=rep(c,'- `decision-dormant` (B6 follow-up):','- `decision-dormant-replaced` (U5): an explicit CONFIRM_RECIPE on an お弁当の日 that carries a dormant record replaces that record with the new `homemade-bento-planned` decision (the old state stays only in `history`).\n- `decision-dormant` (B6 follow-up, S10):','C-U5');
c=rep(c,'Rules: `reminder-key-unique`; `expiresAt > dueAt`;','Rules: `reminder-key-unique`; `expiresAt > dueAt`; `reminder-shown-until-dismissed` (N3 = OQ-20): an entry with `shownAt` and no `dismissedAt` is shown again on every open until it is dismissed or expires;','C-N3');
c=c.trimEnd()+'\n| H1 closing rulings: verdict levels ingredient → dish → category; O-3 no cross-item defining-ingredient collapse; needs-review list (overrides, homemade-bento-planned, not-confirmed; removed dates included); `decision-dormant-replaced`; `reminder-shown-until-dismissed` | PLAN §7 "H1 closing rulings" (A57, A61, S10, O-3, U5, N3) |\n';
fs.writeFileSync(C,c);
// dictionary 7a
const D='docs/ba/domain-dictionary.md';let d=load(D);
d=rep(d,'The verdict comes from the most specific profile entry covering any id of the food (id → dictionary parent → category → ancestors); at the deciding level a dislike beats a like.',
'A defining-ingredient link never crosses items (「鶏のから揚げ」 + 「鶏もも肉のてりやき」 = 2 foods). The verdict is checked level by level: the food\'s ingredient ids → their dictionary parents → the dish id → categories and ancestors (ingredient → dish → category); at the deciding level a dislike beats a like.','D-7a');
fs.writeFileSync(D,d);
console.log('ok');
