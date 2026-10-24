// One-off editor: align the ranking oracle with the BA's final B14 data (animalOrigin, animalOriginKnown, diet-incomplete).
const fs = require("fs");
const p = "tests/oracle/ranking-oracle.md";
let L = fs.readFileSync(p, "utf8").split("\n");
const at = (pre) => { const i = L.findIndex((l) => l.startsWith(pre)); if (i < 0) throw new Error(pre); return i; };

L[at("   - F3 a selected diet")] = "   - F3 a selected diet is violated (ruling B14, PLAN §7; contract §3.8 H1 final): the recipe's `animalOrigin` (union of its ingredients' `animalOrigin` tags) contains a tag the diet forbids — vegetarian {meat, pork, beef, chicken, fish-seafood, gelatin}; pescatarian {meat, pork, beef, chicken, gelatin}; no-pork {pork, meat, gelatin}; no-beef {beef, meat}; no-seafood {fish-seafood} — **or** `dietDataComplete = false` (an ingredient with `animalOriginKnown = false`) while ≥ 1 diet is selected (reason `diet-incomplete`). Tags are explicit (no tag implies another; `meat` = species not stated). Allergen ids and categories are **not** used by F3; when both F3 reasons apply the oracle reports both and the comparison checks the set of reasons;";

const a = at("**Pinned origin tags for the synthetic cases**");
const b = at("## 3. Hand-computed cases");
const TAGS = `**Origin tags used by the synthetic cases** = the dictionary's H1-final \`animalOrigin\` values (\`docs/ba/domain-dictionary.md\`, 2026-10-24), pinned in the fixture overlay \`tests/fixtures/dictionary/diet-tags-pinned.json\` so these hand-computed cases do not move if the BA later refines a tag (a transcription test reports any drift from the real dictionary). \`?\` = \`animalOriginKnown: false\`; \`–\` = no animal origin.

| Ingredient | animalOrigin | Ingredient | animalOrigin |
|------------|--------------|------------|--------------|
| ing-egg | egg | ing-chicken-thigh | chicken |
| ing-salmon | fish-seafood | ing-shrimp | fish-seafood |
| ing-bread | dairy, egg, **?** | ing-bread-crumbs | dairy, egg, **?** |
| ing-sausage (ウインナー) | meat, pork | ing-ham | meat, pork |
| ing-ground-mixed | beef, pork | ing-pork | pork |
| ing-macaroni | – | ing-cheese | dairy |
| ing-gelatin | gelatin | ing-chikuwa | fish-seafood |
| ing-dashi (だし) | fish-seafood, **?** | ing-curry-roux (カレールウ) | meat, pork, beef, chicken, dairy, **?** |
| ing-consomme (コンソメ) | beef, chicken, pork, **?** | every other ingredient in §2 and §3b (rice, sugar, spinach, wheat-flour, ginger, soy-sauce, broccoli, sesame, cherry-tomato, lettuce, corn, carrot, nori, salt, onion, ketchup, tofu, green-pepper, cabbage, mandarin, cucumber, potato, kombu) | – |

Per recipe: A {egg}; B {chicken}; C {fish-seafood}; **D incomplete** (bread ?) {dairy, egg, meat, pork}; E {}; **F incomplete** (bread crumbs ?) {beef, pork, dairy, egg}; **G incomplete** (dashi ?) {fish-seafood}; H {pork}; **I incomplete** (bread crumbs ?) {fish-seafood, egg, dairy}; J {dairy, meat, pork}; K {gelatin}; L {fish-seafood}; **M incomplete** (curry roux ?) {meat, pork, beef, chicken, dairy}.

Diet exclusions derived once (F3): vegetarian excludes B, C, D, F, G, H, I, J, K, L, M → survivors A, E; pescatarian excludes B, D, F, G, H, I, J, K, M → survivors A, C, E, L; no-pork excludes D, F, G, H, I, J, K, M → survivors A, B, C, E, L; no-beef excludes D, F, G, I, J (meat), M → survivors A, B, C, E, H, K, L; no-seafood excludes C, D, F, G, I, L, M → survivors A, B, E, H, J, K. (\`diet-incomplete\` applies to D, F, G, I, M for every diet.)
`;
L.splice(a, b - a, ...TAGS.split("\n"));

L[at("| K11 ")] = "| K11 | diet [no-pork, no-beef]; likes ing-salmon; theme sea; none-known | D, F, G, I, M (`diet-incomplete`; D, F, M also forbidden tags), H (pork), J (meat, pork), K (gelatin) | A0 B−1 C3 E0 L0 | **C, E, L** | C E L A B | US-E1-04/AC1, AC2. C = +2 salmon +1 sea = 3 (20 min, no penalty); B = −1 (25 min); zeros by minutes E10, L10, A15. Recomputed for B14 (G and I now excluded as `diet-incomplete`) |";
let k = at("| K12 ");
L[k] = L[k].replace("**G (dashi: fish-seafood)**", "**G (dashi: fish-seafood + `diet-incomplete`)**").replace("**M (curry roux: pork, beef)**", "**M (curry roux: `diet-incomplete` + meat)**").replace("G, which held the disliked pepper, is excluded by its dashi", "G, which held the disliked pepper, is excluded through its dashi");
k = at("| K20 ");
L[k] = L[k].replace("now excluded by its curry roux", "now excluded (`diet-incomplete`, curry roux)");

const s3 = at("### 3b. Hidden animal sources");
const e3 = at("## 4. Properties on the real library");
const SEC3B = `### 3b. Hidden animal sources (ruling B14) — mini library \`tests/fixtures/recipes/synthetic-library-diet.json\`
**SYNTHETIC**, \`"synthetic": true\`, never shipped. Kept apart from §2 so K1–K23 keep their orders. All seven recipes have \`allergenDataComplete = true\` and no theme; the profiles have no likes, dislikes, themes or known allergens, so every score is 0 and the order is minutes, then id. Tags as in §2. n2 and n3 model a recipe whose cited source states the product's ingredients, so the recipe ingredient has \`animalOriginKnown = true\` (tags copied from the dictionary, none removed: contract \`recipe-ingredient-animal-origin\`).

| Key | id | Ingredients | Hidden source → recipe \`animalOrigin\` | complete for diets | min |
|-----|----|-------------|------------------------------------------|--------------------|-----|
| n1 | rcp-syn-n1-dashi | ing-rice, ing-tofu, ing-spinach, ing-dashi (unknown product) | だし → {fish-seafood} | ✘ (\`?\`) | 10 |
| n2 | rcp-syn-n2-katsuodashi | ing-rice, ing-tofu, ing-spinach, ing-dashi (source: かつおだし, \`animalOriginKnown\` true) | だし → {fish-seafood} | ✔ | 10 |
| n3 | rcp-syn-n3-consomme | ing-rice, ing-cabbage, ing-carrot, ing-consomme (source states the product, known) | コンソメ → {beef, chicken, pork} | ✔ | 15 |
| n4 | rcp-syn-n4-curry | ing-rice, ing-potato, ing-carrot, ing-curry-roux (unknown product) | カレールウ → {meat, pork, beef, chicken, dairy} | ✘ (\`?\`) | 15 |
| n5 | rcp-syn-n5-wiener | ing-rice, ing-sausage, ing-broccoli | ウインナー → {meat, pork} | ✔ | 10 |
| n6 | rcp-syn-n6-kombu | ing-rice, ing-kombu, ing-carrot | none (こんぶ is seaweed, \`–\`) | ✔ | 15 |
| n7 | rcp-syn-n7-plain | ing-rice, ing-corn, ing-nori | none | ✔ | 10 |

| # | Diet | Excluded (why) | Expected order (= 「ほかのレシピ」) | Top 3 | Covers |
|---|------|----------------|-------------------------------------|-------|--------|
| H1 | vegetarian | n1, n4 (\`diet-incomplete\`); n2 (fish-seafood); n3 (beef, chicken, pork); n5 (meat, pork) | n7 (10), n6 (15) | **n7, n6** (2件) | all four hidden sources; kombu allowed |
| H2 | pescatarian | n1, n4 (\`diet-incomplete\`); n3; n5 (meat) | n2, n7 (10, by id), n6 (15) | **n2, n7, n6** | stated かつおだし allowed; same dashi with unknown product excluded |
| H3 | no-pork | n1, n4 (\`diet-incomplete\`); n3 (pork); n5 (pork, meat) | n2, n7, n6 | **n2, n7, n6** | コンソメ and ウインナー as hidden pork |
| H4 | no-beef | n1, n4 (\`diet-incomplete\`); n3 (beef); n5 (**meat**) | n2, n7, n6 | **n2, n7, n6** | ウインナー excluded for no-beef because \`meat\` (species not stated) is forbidden |
| H5 | no-seafood | n1 (\`diet-incomplete\` + fish-seafood), n4 (\`diet-incomplete\`); n2 (fish-seafood) | n5, n7 (10), n3, n6 (15) | **n5, n7, n3** | dashi as hidden fish; meat recipes allowed |
| H6 | no-pork + no-beef | n1, n3, n4, n5 | n2, n7, n6 | **n2, n7, n6** | two diets: union of forbidden tags |
| H7 | none | – | n1, n2, n5, n7 (10), n3, n4, n6 (15) | **n1, n2, n5** | \`diet-incomplete\` applies only when a diet is selected; n1 and n4 are not flagged or demoted (their allergen data is complete) |

7 cases; with K11, K12 and K20 on the main library, 10 cases exercise B14.
`;
L.splice(s3, e3 - s3, ...SEC3B.split("\n"));

L[at("- PR6 (B14)")] = "- PR6 (B14) Every ingredient of the real dictionary has an `animalOrigin` value (`–` allowed) and `animalOriginKnown`; for every real recipe, `animalOrigin` = the union of its ingredients' tags, `dietDataComplete` = false iff an ingredient has `animalOriginKnown = false`, and `dietOk` equals the set derived from §1 F3.";
L[at("- PR7 (B14)")] = "- PR7 (B14) For every diet and pair of diets, no suggestion or 「ほかのレシピ」 entry on the real library has a forbidden tag or `dietDataComplete = false`; every excluded recipe shows reason `diet-incomplete` or the diet reason in 「レシピ一覧」 (US-E6-02/AC8).";

const r6 = at("- **B14** diet filter");
L[r6] = "- **B14** + BA final (`animalOrigin`, `animalOriginKnown`, `diet-incomplete`; 7 unknown-origin ingredients): F3 rewritten (§1), tags = dictionary H1 final (§2), K11, K12, K20 recomputed, H1–H7 (§3b), PR6/PR7 (§4).";
const last = at("No ranking case depends on an undecided rule.");
L[last] = "- **OQ-16 collapse** (`ranking-liked-ids`): a recipe's ingredient ids collapse by ancestor/descendant before counting. No §2 recipe holds an ancestor/descendant pair (D's cherry tomato has no tomato beside it), so no K score changes; the random comparison covers it.\n\nNo ranking case depends on an undecided rule.";
fs.writeFileSync(p, L.join("\n"));
console.log("ok");
