// One-off editor for tests/oracle/ranking-oracle.md (H1 rulings B1, B2, B14). Run from the repo root.
const fs = require("fs");
const p = "tests/oracle/ranking-oracle.md";
let L = fs.readFileSync(p, "utf8").split("\n");
const at = (pre) => { const i = L.findIndex((l) => l.startsWith(pre)); if (i < 0) throw new Error(pre); return i; };

const F3 = "   - F3 a selected diet is violated (ruling B14, PLAN §7): any ingredient carries an animal-origin tag the diet forbids, **or** any ingredient's origin is `unknown` while ≥ 1 diet is selected (incomplete for the diet → excluded, same rule as R-3). Tags: `meat`, `pork`, `beef`, `chicken`, `fish-seafood`, `egg`, `dairy`, `gelatin` (`pork`, `beef`, `chicken` imply `meat`). Forbidden tags, from contract §3.8 mapped category → tag: vegetarian {meat, pork, beef, chicken, fish-seafood, gelatin}; pescatarian {meat, pork, beef, chicken, gelatin}; no-pork {pork, gelatin}; no-beef {beef}; no-seafood {fish-seafood}. Allergen ids (incl. `possibleAllergenIds`) are **not** used by F3 any more; they only feed F1;";

const TAGS = `**Pinned origin tags for the synthetic cases** (fixture dictionary overlay \`tests/fixtures/dictionary/diet-tags-pinned.json\`: the real dictionary with these ingredients' origin tags fixed, so the hand-computed cases do not move when the BA refines the real tags; the real tags are checked by PR6/PR7 in §4). \`[]\` = no animal origin.

| Ingredient | Tags | Ingredient | Tags |
|------------|------|------------|------|
| ing-egg | egg | ing-chicken-thigh | chicken |
| ing-salmon | fish-seafood | ing-shrimp | fish-seafood |
| ing-bread | dairy, egg | ing-bread-crumbs | dairy |
| ing-sausage (ウインナー) | pork | ing-ham | pork |
| ing-ground-mixed | beef, pork | ing-pork | pork |
| ing-macaroni | egg | ing-cheese | dairy |
| ing-gelatin | gelatin | ing-chikuwa | fish-seafood, egg |
| ing-dashi (だし) | fish-seafood | ing-curry-roux (カレールウ) | pork, beef, dairy |
| ing-consomme (コンソメ) | **unknown** | every other ingredient in §2 and §3b (rice, sugar, spinach, wheat-flour, ginger, soy-sauce, broccoli, sesame, cherry-tomato, lettuce, corn, carrot, nori, salt, onion, ketchup, tofu, green-pepper, cabbage, mandarin, cucumber, potato, kombu) | [] |

Diet violations derived once (F3 with the pinned tags): vegetarian excludes B (chicken), C (salmon), D (sausage), F (ground mixed), G (**dashi**), H, I, J (ham), K (gelatin), L (chikuwa), M (**curry roux**) → survivors A, E; pescatarian excludes B, D, F, H, J, K, M; no-pork excludes D, F, H, J, K (gelatin), M; no-beef excludes F, M; no-seafood excludes C, G, I, L. (Before ruling B14, G and M survived vegetarian, M survived pescatarian/no-pork/no-beef, and G survived no-seafood.)`;

const K11 = "| K11 | diet [no-pork, no-beef]; likes ing-salmon; theme sea; none-known | D, F, H, J, K (gelatin), M (curry roux: pork, beef) | A0 B−1 C3 E0 G0 I0 L0 | **C, E, L** | C E L A G I B | US-E1-04/AC1, AC2. C = +2 salmon +1 sea = 3 (20 min, no penalty); I = +1 sea −1 (35 min) = 0; B = −1 (25 min); zeros by minutes E10, L10, A15, G20, I35. M now excluded (B14) |";
const K12 = "| K12 | diet vegetarian; likes ing-carrot; dislikes ing-green-pepper; none-known | B, C, D, F, H, I, J, K, L, **G (dashi: fish-seafood)**, **M (curry roux: pork, beef)** | A0 E2 | **E, A** (「条件に合うレシピは2件です」) | E A | US-E1-04/AC4. **Resolved by B14**: E = +2 carrot (10 min); A = 0 (15 min); G, which held the disliked pepper, is excluded by its dashi |";
const K18 = "| K18 | likes cat-grain; none-known | – | A2 B3 C2 D2 E2 F1 G2 H2 I5 J2 K2 L2 M2 | **I, B, D** | I B D E K L A J C G H F **M** | **Resolved by B1** (distinct found ids): I = rice + wheat-flour + bread-crumbs = 3 × 2 − 1 (35 min) = 5; B = rice + wheat-flour = 4 − 1 (25 min) = 3; F = bread-crumbs 2 − 1 (30 min) = 1; the 2s by minutes D10, E10, K10, L10, A15, J15, C20, G20, H20 |";
const K20 = "| K20 | diet vegetarian; excluded [ing-carrot]; likes ing-corn; none-known | B, C, D, F, G, H, I, J, K, L, M (diet; G via dashi, M via curry roux), E (carrot) | A0 | **A** (「条件に合うレシピは1件です」) | A | Recomputed for B14: M (corn +2, incomplete) was the second result before the ruling and is now excluded by its curry roux. R-3 \"flagged and last\" stays covered by K2, K10, K17, K21 |";
const K23 = "| K23 | likes cat-grain; dislikes ing-rice; none-known | – | A−3 B−2 C−3 D2 E−3 F1 G−3 H−3 I0 J2 K−3 L−3 M−3 | **D, J, F** | D J F I B E K L A C G H **M** | **B2**: rice hits dislike `ing-rice` (itself) and like `cat-grain` (its category) → disliked only, −3 instead of +2. I = flour 2 + crumbs 2 − rice 3 − 1 (35 min) = 0; B = flour 2 − rice 3 − 1 (25 min) = −2; F = crumbs 2 − 1 = 1; D, J = 2 (10 vs 15 min); the −3s by minutes E10, K10, L10, A15, C20, G20, H20; M last (incomplete) |";

const SEC3B = `
### 3b. Hidden animal sources (ruling B14) — mini library \`tests/fixtures/recipes/synthetic-library-diet.json\`
**SYNTHETIC**, \`"synthetic": true\`, never shipped. Kept apart from §2 so K1–K23 keep their orders. All six recipes have \`allergenDataComplete = true\` and no theme; the profiles have no likes, dislikes, themes or known allergens, so every score is 0 and the order is minutes, then id. Tags as pinned in §2.

| Key | id | Ingredients | Hidden source | min |
|-----|----|-------------|---------------|-----|
| n1 | rcp-syn-n1-dashi | ing-rice, ing-tofu, ing-spinach, v:ing-dashi | だし → fish-seafood | 10 |
| n2 | rcp-syn-n2-consomme | ing-rice, ing-cabbage, ing-carrot, v:ing-consomme | コンソメ → **unknown** origin | 10 |
| n3 | rcp-syn-n3-curry | ing-rice, ing-potato, ing-carrot, v:ing-curry-roux | カレールウ → pork, beef, dairy | 15 |
| n4 | rcp-syn-n4-wiener | ing-rice, v:ing-sausage, ing-broccoli | ウインナー → pork | 10 |
| n5 | rcp-syn-n5-plain | ing-rice, ing-corn, ing-nori | none | 10 |
| n6 | rcp-syn-n6-kombu | ing-rice, ing-kombu, ing-carrot | none (こんぶ is \`cat-seaweed\`, not seafood) | 15 |

| # | Diet | Excluded (why) | Expected order (= 「ほかのレシピ」) | Top 3 | Covers |
|---|------|----------------|-------------------------------------|-------|--------|
| H1 | vegetarian | n1 (dashi: fish-seafood), n2 (consommé: unknown), n3 (roux: pork, beef ⇒ meat), n4 (sausage: pork ⇒ meat) | n5 (10), n6 (15) | **n5, n6** (2件) | B14, all four hidden sources; kombu is not seafood |
| H2 | pescatarian | n2 (unknown), n3 (meat), n4 (meat) | n1, n5 (10, by id), n6 (15) | **n1, n5, n6** | fish dashi allowed; unknown origin excluded |
| H3 | no-pork | n2 (unknown), n3 (pork), n4 (pork) | n1, n5, n6 | **n1, n5, n6** | curry roux and ウインナー as hidden pork |
| H4 | no-beef | n2 (unknown), n3 (beef) | n1, n4, n5 (10, by id), n6 (15) | **n1, n4, n5** | ウインナー (pork only) allowed; roux excluded for beef |
| H5 | no-seafood | n1 (fish-seafood), n2 (unknown) | n4, n5 (10), n3, n6 (15) | **n4, n5, n3** | dashi as hidden fish; kombu allowed |
| H6 | no-pork + no-beef | n2, n3, n4 | n1, n5, n6 | **n1, n5, n6** | two diets: union of forbidden tags |
| H7 | none | – | n1, n2, n4, n5 (10), n3, n6 (15) | **n1, n2, n4** | unknown origin matters only when a diet is selected |

7 cases; with K11, K12 and K20 on the main library, 10 cases exercise B14.`;

L[at("   - F3 a selected diet")] = F3;
L.splice(at("Diet violations derived once"), 1, ...TAGS.split("\n"));
L.splice(at("| K11 "), 2, K11, K12);
L[at("| K18 ")] = K18;
L[at("| K20 ")] = K20;
L.splice(at("| K22 ") + 1, 0, K23);
const c = at("22 cases, 18 distinct");
L[c] = L[c].replace("22 cases, 18 distinct child profiles", "**23 cases** (K23 added for B2; K11, K12, K18, K20 resolved or recomputed at the H1 rulings), 19 distinct child profiles");
L.splice(c + 1, 0, ...SEC3B.split("\n"));
fs.writeFileSync(p, L.join("\n"));
console.log("ok");
