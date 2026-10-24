// OQ-16 collapse narrowed (not transitive) + collapse detail (PLAN §7).
const fs=require('fs');
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a)){console.error('MISSING in',f,':',a.slice(0,90));process.exit(1)}s=s.replace(a,b)}fs.writeFileSync(f,s)}
const US='docs/ba/user-stories.md';
let s=fs.readFileSync(US,'utf8');
const a=s.indexOf('2. *Foods.*');const b=s.indexOf('\n',a);
s=s.slice(0,a)+'2. *Foods* (OQ-16 overruled, narrowed; never transitive). Each found id is one food, except: (a) **dish + defining ingredient:** within one lunch item, a matched dish and its `definingIngredientId` (dictionary §5, e.g. 「さばのみそ煮」 → `dish-saba-miso` + `ing-mackerel`; 「コーンスープ」 → `dish-corn-soup` + `ing-corn`) are one food, represented by the dish; an id identical to that defining ingredient found elsewhere on the day (another item or the ingredient list) is counted through that dish, not as a food of its own. Other ingredients named in the dish stay separate foods (「豚のしょうが焼き」 = `dish-ginger-pork` with `ing-pork` + `ing-ginger` = 2 foods). A dish whose `definingIngredientId` is null is a food on its own, and its named ingredients are separate foods. (b) **ancestor/descendant:** a found ingredient id that is a dictionary ancestor of another found id (`ing-chicken` of `ing-chicken-thigh`) folds into **each** found descendant and is not a food of its own; siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). Nothing else collapses: two different items never merge except through identical or ancestor/descendant ids, and grouping is never chained (two dishes with the same defining ingredient in different items stay 2 foods).'+s.slice(b);
s=s.replace("3. *Verdict per food.* Check the profile from most to least specific across all ids of the food: level 1 any member id itself; level 2 a member's dictionary parent ingredient;",
"3. *Verdict per food.* Check the profile from most to least specific across all ids of the food (a dish food's ids are the dish and its defining ingredient, also when that ingredient is not named in the item text): level 1 any member id itself; level 2 a member's dictionary parent ingredient;");
const w=s.indexOf('*Worked example*');const we=s.indexOf('\n',w);
s=s.slice(0,w)+"*Worked example* (sample child: dislikes `ing-green-pepper`, `ing-eggplant`, `cat-fish`; likes `ing-chicken`, `ing-egg`, `ing-corn`; plus, for this example only, likes `ing-salmon` and dislikes `ing-ginger`). A day lists the items 「ピーマンとなすのみそ炒め」「さけのしおやき」「さばのみそ煮」「豚のしょうが焼き」「とりももの照り焼き風」「鶏むね肉のソテー」「カレーうどん」「ごはん」 and the ingredients ピーマン, なす, 鮭, さば, 豚肉, しょうが, 鶏肉, みそ, うどん (kanji 鮭 resolves to `ing-salmon`; kana 「さけ」 in an ingredient list could trigger amb-sake). Found ids, seasonings (`ing-miso`, `ing-salt`) left out: `ing-green-pepper`, `ing-eggplant`, `dish-salted-salmon`, `ing-salmon`, `dish-saba-miso`, `ing-mackerel`, `dish-ginger-pork`, `ing-pork`, `ing-ginger`, `ing-chicken-thigh` (「とりもも」, amb-momo rule), `ing-chicken-breast`, `ing-chicken`, `ing-udon`, `ing-rice`. Foods (10): ピーマン; なす (each once although found in a dish name and in the ingredient list); {`dish-salted-salmon` + defining `ing-salmon`} (鮭 in the ingredient list counts through it); {`dish-saba-miso` + defining `ing-mackerel`}; {`dish-ginger-pork` + defining `ing-pork`}; しょうが (named in the dish but not its defining ingredient: a separate food); `ing-chicken-thigh` and `ing-chicken-breast` (siblings: 2 foods; the found ancestor 鶏肉 folds into each and is not a food of its own); うどん; ごはん. Verdicts: ピーマン, なす disliked (level 1); the salmon food liked (level 1 like on `ing-salmon` beats the level-3 dislike of `cat-fish`: B2); the mackerel food disliked (level 3, `cat-fish`); the ginger-pork food no verdict; しょうが disliked (level 1); もも and むね liked (level 2, parent `ing-chicken`); うどん, ごはん no verdict. So D = 4, L = 3. Items: 8 non-snack; only 「カレーうどん」 has an unresolved 「カレー」 (amb-curry) → U = 1/8 = 12.5%. Rule 3 applies: `low-preference`, explanation 「苦手な食材が4つ」 (ピーマン, なす, さば, しょうが)."+s.slice(we);
fs.writeFileSync(US,s);
edit(US,[
["Scenario: AC15 A dish and the ingredient named in it are one food (BR-04)","Scenario: AC15 A dish and its defining ingredient are one food (BR-04)"],
["  And a school day lists 「とりにくのからあげ」 and 「鶏もも肉のてりやき」 with the ingredients 鶏肉, 鶏もも肉","  And a school day lists 「鶏肉と野菜のスープ」 and 「鶏もも肉のソテー」 with the ingredients 鶏肉, 鶏もも肉"],
["  Then D = 2 (the chicken food and the salmon food)\n```",
`  Then D = 2 (the chicken food and the salmon food)

Scenario: AC17 Other ingredients named in a dish stay separate foods (BR-04)
  Given a profile that dislikes ing-pork and ing-ginger
  And a school day lists only 「豚のしょうが焼き」 and 「ごはん」
  Then dish-ginger-pork collapses with its defining ingredient ing-pork into one food, and ing-ginger is a second food
  And D = 2, so the day is low-preference with 「苦手な食材が2つ」

Scenario: AC18 Collapse is never chained across items; siblings stay separate (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「鶏の照り焼き」 and 「鶏のから揚げ」 (dish-teriyaki-chicken and dish-karaage, both with definingIngredientId ing-chicken)
  Then the two dishes are 2 foods (D = 2): different items are never merged through a shared defining ingredient
  Given instead a day lists 「鶏もも肉のソテー」「鶏むね肉のサラダ」 with the ingredients 鶏肉, 鶏もも肉, 鶏むね肉
  Then ing-chicken folds into each of ing-chicken-thigh and ing-chicken-breast, which stay 2 foods (D = 2)
\`\`\``],
['| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 30 |','| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 32 |'],
['| **Total** | | **73** | **280 (10 v1)** |','| **Total** | | **73** | **282 (10 v1)** |'],
['→ 73 / 280 after the H1 fix round)','→ 73 / 282 after the H1 fix round)'],
['| E4 counting paragraph and worked example | US-E4-01/AC15, AC16 | |',
'| E4 counting paragraph and worked example | US-E4-01/AC15, AC16 | |\n| OQ-16 collapse narrowed (not transitive) and collapse detail (PLAN §7): a dish collapses only with its `definingIngredientId` within one item; other named ingredients stay separate; a found ancestor folds into each found descendant, siblings separate; never chained | E4 counting paragraph and worked example (incl. しょうが焼き and 鶏肉/もも/むね), US-E4-01/AC15 (title: "defining ingredient"; outcome unchanged), US-E4-01/AC16 (example items without a dish; outcome unchanged) | US-E4-01/AC17, AC18 | |']]);
// contract
const C='docs/ba/data-contract.md';
edit(C,[
["Found ids that are the same food collapse into one **food** (rule `assessment-food-collapse`): a dish id with the name-ingredient ids the same menu text adds through it, and ids in an ancestor/descendant relation in the dictionary; grouping is transitive; the food is represented by its most specific id (descendant over ancestor, dish over its name ingredients).",
"Found ids collapse into **foods** (rule `assessment-food-collapse`, never transitive): within one lunch item a matched dish and its dictionary `definingIngredientId` are one food represented by the dish (an identical id found elsewhere that day counts through that dish); other ingredients named in the dish are separate foods; a found ingredient that is a dictionary ancestor of another found id folds into each found descendant (siblings stay separate); nothing else merges, and two dishes are never merged with each other."],
['| §3.5 food collapse (`assessment-food-collapse`): dish + name ingredients, ancestor/descendant ids count once | OQ-16 overruled (PLAN §7) |',
'| §3.5 food collapse (`assessment-food-collapse`): dish + its `definingIngredientId` within one item; ancestor folds into each descendant; never transitive | OQ-16 overruled, narrowed; collapse detail (PLAN §7) |']]);
// dictionary
const D='docs/ba/domain-dictionary.md';
const DEF={'dish-gomoku-rice':'ing-rice','dish-yakisoba':'ing-chinese-noodles','dish-yaki-udon':'ing-udon','dish-napolitan':'ing-spaghetti','dish-meat-sauce':'ing-spaghetti','dish-karaage':'ing-chicken','dish-white-fish-fry':'ing-white-fish','dish-teriyaki-chicken':'ing-chicken','dish-ginger-pork':'ing-pork','dish-saba-miso':'ing-mackerel','dish-salted-salmon':'ing-salmon','dish-tamagoyaki':'ing-egg','dish-mapo-tofu':'ing-tofu','dish-sweet-sour-pork':'ing-pork','dish-octopus-sausage':'ing-sausage','dish-hijiki-nimono':'ing-hijiki','dish-kiriboshi-nimono':'ing-dried-daikon','dish-kinpira':'ing-burdock','dish-pumpkin-nimono':'ing-pumpkin','dish-tonjiru':'ing-pork','dish-corn-soup':'ing-corn','dish-potato-salad':'ing-potato','dish-macaroni-salad':'ing-macaroni','dish-harusame-salad':'ing-harusame'};
let d=fs.readFileSync(D,'utf8').split('\n');let withD=0,nullD=0;const seen=new Set();
for(let i=0;i<d.length;i++){const l=d[i];
 if(l==='| id | 表記 | よみ | English | category | synonyms | name ingredients |'){d[i]=l+' definingIngredientId |';continue}
 if(l==='|----|------|------|---------|----------|----------|------------------|'){d[i]=l+'----------------------|';continue}
 const m=l.match(/^\| (dish-[a-z0-9-]+) \|/);if(!m)continue;
 const v=DEF[m[1]]||'null';seen.add(m[1]);d[i]=l+' '+v+' |';if(v==='null')nullD++;else withD++;
 if(v!=='null'&&!l.includes(v)&&m[1]!=='dish-karaage'){console.error('defining not in name ingredients',m[1]);process.exit(1)}
}
for(const k in DEF)if(!seen.has(k)){console.error('no dish',k);process.exit(1)}
let ds=d.join('\n');
function rd(a,b){if(!ds.includes(a)){console.error('MISSING dict',a.slice(0,80));process.exit(1)}ds=ds.replace(a,b)}
rd("`name ingredients` = ingredients literally named in the dish name (matching rule 4); nothing is inferred from the recipe a school might use.",
`\`name ingredients\` = ingredients literally named in the dish name (matching rule 4); nothing is inferred from the recipe a school might use.
\`definingIngredientId\` (H1, OQ-16 collapse narrowed) = the one ingredient that *is* the dish's main food, so that the dish and that ingredient count as one food when both are found in the same lunch item (rule 7a); \`null\` when the dish has no single defining food (mixed dishes such as 八宝菜, カレーライス, ミックスフライ-type dishes, dressings such as ごまあえ, or variants such as コロッケ). It is always one of the dish's name ingredients (\`dish-karaage\`: ing-chicken, which the dish adds only when 鶏 is in the name). Coverage: ${withD} of ${withD+nullD} dishes have a defining ingredient, ${nullD} are null. Validator rule \`dict-defining-ingredient\` (null or an \`ing-\` id among the dish's name ingredients).`);
const r7=ds.indexOf('7a. **One verdict per food');const r7e=ds.indexOf('\n',r7);
ds=ds.slice(0,r7)+"7a. **One verdict per food, most specific entry wins** (H1 rulings B1, B2, follow-up, \"OQ-16 overruled\", \"collapse narrowed\", \"collapse detail\"). D and L count foods, not profile entries. Within one lunch item a matched dish and its `definingIngredientId` (§5) are one food; other ingredients named in the dish stay separate (豚のしょうが焼き = 豚肉-food + しょうが = 2). A found ancestor id folds into each found descendant; siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). Nothing is chained: different items merge only through identical or ancestor/descendant ids, and two dishes never merge. The verdict comes from the most specific profile entry covering any id of the food (id → dictionary parent → category → ancestors); at the deciding level a dislike beats a like. Example: likes `cat-fish`, dislikes `ing-mackerel` → さば is disliked only, さけ is liked. Full rule and worked example: `user-stories.md` E4."+ds.slice(r7e);
fs.writeFileSync(D,ds);
console.log('ok',{withD,nullD});
