const fs=require('fs');const f='docs/ba/user-stories.md';let s=fs.readFileSync(f,'utf8');
function rep(a,b){if(!s.includes(a)){console.error('MISSING:',a.slice(0,90));process.exit(1)}s=s.replace(a,b)}
// E4-04 AC1
rep(`Scenario: AC1 No judgmental words in assessment copy
  Then no assessment string in ja or en contains: 「まずい」「体に悪い」「不健康」「よくない」「おすすめしません」, "bad", "unhealthy", "unsuitable", "avoid"`,
`Scenario: AC1 No judgmental words in assessment copy (BR-07)
  Then no assessment string in ja or en matches a phrase of \`data/banned-phrases.json\` (matching as in US-E6-03/AC2)
  And, for assessment strings only, none contains 「よくない」, "unsuitable" or "avoid" either (these words are allowed elsewhere, e.g. in food-handling notes)`);
// E5 state machine row
rep(`| no-school-lunch, any other reason | — | — | — | — | — |`,
`| no-school-lunch, any other reason | — | — | — | — | — |
| homemade-bento-planned on a date that a refresh made a no-lunch day (reason ≠ \`bento-day\`) or removed from the menu (refresh conflict, BR-13) | — | — | — | — | stored decision removed (after confirm dialog); 「このまま」 = KEEP_PLAN sets \`acknowledgedMenuVersion\`, state unchanged (US-E3-05/AC2, AC6, AC7) |
| stored not-confirmed / school-lunch-planned on such a date | dormant: kept unchanged, displays no-school-lunch (or nothing when unlisted), no actions; shown again unchanged if the date becomes a school day (US-E3-05/AC10) | | | | |

Timestamps: \`decidedAt\` is set on every write; \`plannedAt\` is set when the state becomes homemade-bento-planned from any other state (first confirm), kept unchanged by 「レシピを変更」 and by KEEP_PLAN, and removed when the state leaves homemade-bento-planned (data contract §3.6).`);
// E5-01 AC4
rep(`  And if the planned recipe is missing from the library (US-E6-06), the cell shows the first 8 characters of recipeNameSnapshot`,
`  And if the planned recipe is missing from the library (US-E6-06), the cell shows the stored recipeShortNameSnapshot (ja or en by language) and the day sheet the stored recipeNameSnapshot`);
// E5-03 AC2
rep(`  Then the stored decision for 2026-11-04 is homemade-bento-planned with that recipeId and decidedAt`,
`  Then the stored decision for 2026-11-04 is homemade-bento-planned with that recipeId, decidedAt, plannedAt (= decidedAt of this first confirm), recipeNameSnapshot and recipeShortNameSnapshot (the recipe's shortNameJa / shortNameEn)`);
// E5-07 AC2
rep(`  Then no string in ja or en states or implies that the app reserved, booked, ordered or cancelled a school lunch (e.g. 「予約しました」「予約完了」「キャンセルしました」 as app actions, "booked", "reserved for you")
  # Exception: the parent's own checkbox label in AC3`,
`  Then no catalog string in ja or en matches a reservation phrase of \`data/banned-phrases.json\` (e.g. 「予約しました」「予約完了」, "reserved", "booked"; matching as in US-E6-03/AC2)
  # Exception: the catalog key of the parent's own checkbox label in AC3 (「園で予約済み（自分で記録）」 / its en label) is exempt from the en phrase "reserved"; the exemption is listed by key in the test, not in the data file.`);
// E6 ranking paragraph
rep("Score = `+2` per distinct liked id in the recipe,",
"Score = `+2` per distinct liked id in the recipe (the recipe's distinct ingredient ids, each given one verdict by the most-specific-entry rule of E4, dislike winning a same-level tie: the same counting as D and L, H1 rulings B1/B2),");
rep("2. Exclude a recipe if any ingredient, or its dictionary parent or category, is in `excludedIngredientIds`, or if it violates a selected diet (data contract §3.8).",
"2. Exclude a recipe if any ingredient, or its dictionary parent or category, is in `excludedIngredientIds`, or if it violates a selected diet. Diets work on ingredient-level animal-origin tags (`animalOrigin`, dictionary §4, incl. hidden sources such as だし, コンソメ, カレールウ, ウインナー): a recipe violates a diet when any ingredient carries a tag the diet forbids, and a recipe with an ingredient of unknown animal origin is excluded for every selected diet with reason `diet-incomplete` (data contract §3.8, H1 ruling B14).");
// E1-04 AC1, AC4
rep(`  Then no suggested recipe contains an ingredient of category cat-pork, an ingredient with allergen alg-pork in allergenIds or possibleAllergenIds, or ing-gelatin (data contract §3.8, OQ-11)`,
`  Then no suggested recipe contains an ingredient whose animalOrigin includes "pork", "meat" (species not stated) or "gelatin", or an ingredient of unknown animal origin (data contract §3.8, OQ-11, B14)`);
rep(`  Then no suggested recipe contains an ingredient of cat-meat, cat-meat-processed, cat-fish, cat-fish-processed or cat-seafood, or ing-gelatin, including through a varies-by-product ingredient's possible content (data contract §3.8, OQ-11)`,
`  Then no suggested recipe contains an ingredient whose animalOrigin includes "meat", "pork", "beef", "chicken", "fish-seafood" or "gelatin" (hidden sources included: e.g. だし, コンソメ, ちくわ), or an ingredient of unknown animal origin (data contract §3.8, OQ-11, B14)`);
// E6-02 new ACs
rep(`  And in 「レシピ一覧」 X is listed last, greyed, with 「アレルゲン情報が不完全なため、登録したアレルギーと照合できません」 / "Allergen information is incomplete, so it can't be checked against the registered allergies", and its 「この日に決定」 is disabled
\`\`\``,
`  And in 「レシピ一覧」 X is listed last, greyed, with 「アレルゲン情報が不完全なため、登録したアレルギーと照合できません」 / "Allergen information is incomplete, so it can't be checked against the registered allergies", and its 「この日に決定」 is disabled

Scenario: AC7 Hidden animal-origin ingredients count for diets (BR-06)
  Given the fixture library has recipe Y whose only animal-origin ingredient is だし (ing-dashi, animalOrigin ["fish-seafood"] confirmed by its cited source) and recipe Z whose only animal-origin ingredient is コンソメ (ing-consomme, animalOrigin ["beef","chicken","pork"] confirmed by its cited source)
  When the child's diet is ["vegetarian"]
  Then neither Y nor Z is suggested or plannable
  When the child's diet is ["no-seafood"]
  Then Y is excluded and Z is not excluded for diet reasons
  When the child's diet is ["no-pork"]
  Then Z is excluded and Y is not excluded for diet reasons

Scenario: AC8 Unknown animal origin excludes a recipe for any selected diet (BR-06)
  Given recipe W has an ingredient whose animal origin is unknown (dictionary animalOrigin "?" not resolved by a cited source, so the recipe has dietDataComplete false) and no other diet conflict
  When the child has any diet selected (e.g. ["no-beef"])
  Then W appears neither in the 3 suggestions nor in 「ほかのレシピ」, and in 「レシピ一覧」 it is greyed with reason diet-incomplete 「原材料の由来がわからないため、食事の制限と照合できません」 / "The origin of some ingredients is unknown, so it can't be checked against the diet", and its 「この日に決定」 is disabled
  When the child has no diet selected
  Then W is not excluded for diet reasons
\`\`\``);
// E6-03 AC2
rep(`  Then no string in ja or en contains 「アレルギー対応」「安全です」「アレルゲンフリー」「除去済み」, "allergy-safe", "allergen-free", "safe for"`,
`  Then no catalog string in ja or en matches any phrase of \`data/banned-phrases.json\` (BA-owned; e.g. 「アレルギー対応済み」「安全です」, "allergy-safe", "safe for")
  # Matching: both sides NFKC-normalised and case-folded; ja phrases match as substrings; en phrases match as whole words or word sequences (so "bad" does not match "badge"). Recipe text in data/library.json is checked against the same file.`);
// E6-06 AC1
rep(`  Then the cell shows the stored recipe name snapshot and the sheet says`,
`  Then the cell shows the stored recipeShortNameSnapshot, the sheet shows the stored recipeNameSnapshot and says`);
// E7-02 AC5, AC6 + new
rep(`Scenario: AC5 Planned after the reminder time (BR-17)
  Given it is 2026-11-03 19:00 JST
  When the parent plans 2026-11-04
  Then no day-before reminder is shown for 2026-11-04 and the today view on 2026-11-04 covers it

Scenario: AC6 Rescheduled or cancelled with the decision (BR-17)
  Given the day-before reminder for 2026-11-04 is scheduled
  When the plan's recipe changes, the reminder refers to the new recipe
  And when the plan is cancelled or set to not-confirmed, the reminder is removed
\`\`\``,
`Scenario: AC5 First planned after the reminder time (BR-17)
  Given it is 2026-11-03 19:00 JST and 2026-11-04 is not homemade-bento-planned
  When the parent plans 2026-11-04 (its plannedAt is 2026-11-03T19:00+09:00, after the due time 2026-11-03 17:30 JST)
  Then no day-before reminder is shown for 2026-11-04 and the today view on 2026-11-04 covers it
  # Suppression compares plannedAt (first CONFIRM_RECIPE), never decidedAt (H1 ruling B10).

Scenario: AC6 Rescheduled or cancelled with the decision (BR-17)
  Given the day-before reminder for 2026-11-04 is scheduled (plannedAt before its due time)
  When the plan's recipe changes, at any time before the reminder expires, the reminder is kept and refers to the new recipe; a recipe change never deletes a pending reminder
  And when the plan is cancelled or set to not-confirmed, the reminder is removed

Scenario: AC7 Changing the recipe after the due time keeps the reminder (BR-17)
  Given 2026-11-04 was planned on 2026-11-01 with recipe R1 and the app was closed at 2026-11-03 17:30 JST
  When the parent opens the app at 2026-11-03 20:00 JST and changes the recipe to R2 before dismissing the reminder
  Then plannedAt keeps its 2026-11-01 value, and the 2026-11-04 day-before reminder is shown (missed reminder, US-E7-05/AC2) and refers to R2

Scenario: AC8 Cancelled and planned again after the due time (BR-17)
  Given 2026-11-04 was planned on 2026-11-01 and its reminder was shown and dismissed at 2026-11-03 17:30 JST
  When at 2026-11-03 19:00 JST the parent taps 「給食に戻す」, confirms, and then plans 2026-11-04 again
  Then plannedAt is 2026-11-03T19:00+09:00 (a new first confirm), no new day-before reminder is shown for 2026-11-04, and the today view on 2026-11-04 covers it
\`\`\``);
fs.writeFileSync(f,s);console.log('ok');
