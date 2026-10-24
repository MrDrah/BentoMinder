// OQ-16 overruled: same food counts once (PLAN §7 row "OQ-16 overruled").
const fs=require('fs');
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a)){console.error('MISSING in',f,':',a.slice(0,90));process.exit(1)}s=s.replace(a,b)}fs.writeFileSync(f,s)}
const US='docs/ba/user-stories.md';
let s=fs.readFileSync(US,'utf8');
const p0=s.indexOf('**Counting (H1 rulings B1, B2, B5;');const p1=s.indexOf('1. Day is a no-lunch day',p0);
const para=`**Counting (H1 rulings B1, B2, B5, follow-ups and "OQ-16 overruled"; binding for the engine, ADR 004 and the QA oracle).**
1. *Found ids.* Collect every distinct dictionary id (\`dish-\` or \`ing-\`) that the matching rules of \`domain-dictionary.md\` §1 find in the day's non-snack items (dish names) and in its listed ingredients, plus the ids the parent chose for an ambiguous item on review (\`resolvedIds\`). An id found several times (in a dish name and again in the ingredient list, or in two dishes) is one found id. Seasonings (\`cat-seasoning\`) are left out unless the profile names their exact id (dictionary §1 rule 8).
2. *Foods.* Found ids that are the same food collapse into **one food**: (a) a dish id and the ingredient ids that the same menu text adds through that dish (its name ingredients, e.g. 「さばのみそ煮」 → \`dish-saba-miso\` + \`ing-mackerel\`); (b) ids in an ancestor/descendant relation in the dictionary (\`ing-chicken\` and \`ing-chicken-thigh\`). The grouping is transitive (a found id shared by two groups joins them). Each food is represented by its most specific id: a descendant over its ancestor, a dish over its name ingredients. Ingredients found in the rest of an item's text (not through a dish) are separate foods.
3. *Verdict per food.* Check the profile from most to least specific across all ids of the food: level 1 any member id itself; level 2 a member's dictionary parent ingredient; level 3 a member's category; level 4 that category's ancestors, nearest first. The first level that has a like or a dislike decides; if it has both, the dislike wins. A food gets at most one verdict.
4. **\`D\` = number of disliked foods; \`L\` = number of liked foods.** So D counts different foods a parent would recognise, not profile entries and not ids: 「さけのしおやき」 and 「さばのみそ煮」 give D = 2 for a child who only dislikes \`cat-fish\`; 鶏肉 and 鶏もも肉 on one day are one food. The explanation names each counted food by the label of the id whose profile entry decided (さば, not さばのみそ煮, when the dislike is \`cat-fish\`).
5. **\`U\`** = (number of the day's non-snack items that have no dictionary match at all, or that contain at least one unresolved ambiguity) ÷ (number of the day's non-snack items). An item with a match *and* an unresolved ambiguity (「カレーうどん」: \`ing-udon\` found, 「カレー」 unresolved) counts towards U, and its foods still count towards D and L.

*Worked example* (sample child: dislikes \`ing-green-pepper\`, \`ing-eggplant\`, \`cat-fish\`; likes \`ing-chicken\`, \`ing-egg\`, \`ing-corn\`; plus, for this example only, likes \`ing-salmon\`). A day lists the items 「ピーマンとなすのみそ炒め」「さけのしおやき」「さばのみそ煮」「カレーうどん」「とりももの照り焼き風」「ごはん」 and the ingredients ピーマン, なす, 鮭, さば, 鶏肉, みそ, うどん (kanji 鮭 resolves to \`ing-salmon\`; kana 「さけ」 in an ingredient list could trigger amb-sake). Found ids, seasonings (\`ing-miso\`, \`ing-salt\`) left out: \`ing-green-pepper\`, \`ing-eggplant\`, \`dish-salted-salmon\`, \`ing-salmon\`, \`dish-saba-miso\`, \`ing-mackerel\`, \`ing-udon\`, \`ing-chicken-thigh\` (「とりもも」, amb-momo rule), \`ing-chicken\`, \`ing-rice\`. Foods: {ピーマン}, {なす} (each once although found in a dish name and in the ingredient list); {\`dish-salted-salmon\`, \`ing-salmon\`}; {\`dish-saba-miso\`, \`ing-mackerel\`}; {\`ing-chicken-thigh\`, \`ing-chicken\`} (descendant/ancestor, represented by \`ing-chicken-thigh\`); {うどん}; {ごはん}. Verdicts: ピーマン, なす disliked (level 1); the salmon food liked (level 1 like on \`ing-salmon\` beats the level-3 dislike of \`cat-fish\`: B2); the mackerel food disliked (level 3, \`cat-fish\`); the chicken food liked (level 2, parent \`ing-chicken\`); うどん, ごはん no verdict. So D = 3, L = 2. Items: 6 non-snack; 「カレーうどん」 has an unresolved 「カレー」 (amb-curry) and 「とりももの照り焼き風」 is matched → 1 of 6 → U ≈ 17%. Rule 3 applies: \`low-preference\`, explanation 「苦手な食材が3つ」 (ピーマン, なす, さば).

`;
s=s.slice(0,p0)+para+s.slice(p1);
fs.writeFileSync(US,s);
edit(US,[
['  Then ing-ground-mixed counts as disliked only, so it adds 1 to D and 0 to L\n',
`  Then ing-ground-mixed counts as disliked only, so it adds 1 to D and 0 to L

Scenario: AC15 A dish and the ingredient named in it are one food (BR-04)
  Given a profile that dislikes dish-saba-miso and ing-mackerel
  And a school day lists 「さばのみそ煮」「ごはん」 with the ingredients さば, みそ
  Then dish-saba-miso and ing-mackerel collapse to one food, represented by dish-saba-miso
  And D = 1, L = 0, so the day is low-preference and the explanation counts 1 food
  Given instead the profile dislikes ing-mackerel and likes dish-saba-miso
  Then the one food has both a like and a dislike at level 1, the dislike wins, and D = 1, L = 0

Scenario: AC16 An ingredient and its dictionary descendant are one food (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「とりにくのからあげ」 and 「鶏もも肉のてりやき」 with the ingredients 鶏肉, 鶏もも肉
  Then ing-chicken and ing-chicken-thigh collapse to one food, represented by ing-chicken-thigh
  And D = 1, so the day is low-preference with 「苦手な食材が1つ」
  Given the same day also lists 「さけのしおやき」 and the profile also dislikes cat-fish
  Then D = 2 (the chicken food and the salmon food)
`]]);
// index + changes table
edit(US,[
['| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 28 |','| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 30 |'],
['| **Total** | | **73** | **278 (10 v1)** |','| **Total** | | **73** | **280 (10 v1)** |'],
['→ 73 / 278 after the H1 fix round)','→ 73 / 280 after the H1 fix round)'],
['| BR-14 tightened to https only (PLAN §7, H1) | US-E2-01/AC2 | | |',
'| BR-14 tightened to https only (PLAN §7, H1) | US-E2-01/AC2 | | |\n| OQ-16 overruled (PLAN §7): a dish and its name ingredients, and dictionary ancestor/descendant ids, collapse to one food (most specific id); D and L count foods | E4 counting paragraph and worked example | US-E4-01/AC15, AC16 | |']]);
// contract
edit('docs/ba/data-contract.md',[
['**Counting D, L, U** (H1 rulings B1, B2, B5 and follow-up; the full rule with a worked example is the E4 paragraph of `user-stories.md`): *found ids* are the distinct dictionary ids found in the day\'s non-snack items and listed ingredients (plus parent-chosen `resolvedIds`); each found id gets one verdict from the most specific profile entry that covers it (the id itself → its dictionary parent ingredient → its category → ancestor categories, nearest first); at the deciding level a dislike beats a like. D = disliked found ids, L = liked found ids.',
'**Counting D, L, U** (H1 rulings B1, B2, B5, follow-ups and "OQ-16 overruled"; the full rule with a worked example is the E4 paragraph of `user-stories.md`): *found ids* are the distinct dictionary ids found in the day\'s non-snack items and listed ingredients (plus parent-chosen `resolvedIds`), seasonings left out unless the profile names them. Found ids that are the same food collapse into one **food** (rule `assessment-food-collapse`): a dish id with the name-ingredient ids the same menu text adds through it, and ids in an ancestor/descendant relation in the dictionary; grouping is transitive; the food is represented by its most specific id (descendant over ancestor, dish over its name ingredients). Each food gets one verdict from the most specific profile entry covering any of its ids (the id itself → dictionary parent ingredient → category → ancestor categories, nearest first); at the deciding level a dislike beats a like. D = disliked foods, L = liked foods. `matched.likedIds` / `dislikedIds` hold the representative id of each counted food.'],
['| `ranking-liked-ids` | BR-09\'s "per liked id" / "per disliked id" count the recipe\'s distinct ingredient ids by the same verdict rule as D and L (§3.5 Counting). |',
'| `ranking-liked-ids` | BR-09\'s "per liked id" / "per disliked id" count the recipe\'s foods (its ingredient ids collapsed by ancestor/descendant) with the same verdict rule as D and L (§3.5 Counting). |'],
['| H1 fix round: `ranking-liked-ids` | B1 (ranking K18) |','| H1 fix round: `ranking-liked-ids` | B1 (ranking K18) |\n| §3.5 food collapse (`assessment-food-collapse`): dish + name ingredients, ancestor/descendant ids count once | OQ-16 overruled (PLAN §7) |']]);
// dictionary rule 7a
edit('docs/ba/domain-dictionary.md',[
['7a. **One verdict per found id, most specific entry wins** (H1 rulings B1, B2 and follow-up). D and L count distinct found ids, not profile entries.',
'7a. **One verdict per food, most specific entry wins** (H1 rulings B1, B2, follow-up and "OQ-16 overruled"). D and L count foods, not profile entries: within one day a dish id and the name ingredients it adds from the same menu text, and ids in an ancestor/descendant relation (鶏肉 / 鶏もも肉), are one food represented by the most specific id.']]);
// open questions
edit('docs/ba/open-questions.md',[
['| OQ-16 | B1 counts distinct found ids','| OQ-16 (**Overruled 2026-10-24 (Orchestrator)**: same food counts once; a dish with its name ingredients and ancestor/descendant ids collapse to the most specific id, see user-stories E4) | B1 counts distinct found ids'],
['| OQ-17 | Animal rennet','| OQ-17 (**Accepted** 2026-10-24) | Animal rennet'],
['| OQ-18 | Seven ingredients','| OQ-18 (**Accepted** 2026-10-24; research brief §4a) | Seven ingredients'],
['| OQ-19 | BR-18 phrases','| OQ-19 (**Accepted** 2026-10-24) | BR-18 phrases'],
['| OQ-20 | QA N3','| OQ-20 (**Accepted** 2026-10-24) | QA N3']]);
// research brief
edit('docs/ba/research-brief.md',[
['## 5. Batch plan',
`## 4a. Ingredients of unknown animal origin (H1, OQ-18 accepted)
Recipes using an ingredient whose dictionary \`animalOrigin\` ends in \`?\` (\`ing-dashi\` だし, \`ing-bread\` パン, \`ing-bread-crumbs\` パン粉, \`ing-consomme\` コンソメ, \`ing-curry-roux\` カレールウ, \`ing-stew-roux\` シチュールウ, \`ing-worcester-sauce\` ソース) are excluded for every selected diet unless the cited source states that product's ingredients (\`animalOriginKnown\`, data contract §3.7–§3.8). When choosing candidates, prefer recipes that avoid these or that specify them: e.g. 昆布だし (\`ing-kombu\`) or かつおだし made from \`ing-bonito-flakes\` instead of plain だし, rice instead of bread. Record \`animalOrigin\` for every ingredient and report each recipe that ends with \`dietDataComplete = false\`.

## 5. Batch plan`]]);
console.log('ok');
