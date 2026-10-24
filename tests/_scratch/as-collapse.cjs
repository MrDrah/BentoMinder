// One-off editor: OQ-16 collapse (narrowed, not transitive, ancestor folds into each descendant) for the assessment oracle.
const fs = require("fs");
const p = "tests/oracle/assessment-oracle.md";
let L = fs.readFileSync(p, "utf8").split("\n");
const at = (pre) => { const i = L.findIndex((l) => l.startsWith(pre)); if (i < 0) throw new Error(pre); return i; };

const RULE = [
  "- **Foods (PLAN §7 \"OQ-16 overruled\", \"OQ-16 collapse narrowed (not transitive)\" and the collapse detail).** Found ids are grouped into *foods* before counting:",
  "  - (a) **within one lunch item**, a dish id and its **defining ingredient** (dictionary `definingIngredientId`, e.g. コーンスープ → `ing-corn`) are one food; the dish's other name ingredients stay separate foods (豚のしょうが焼き = pork food + ginger food);",
  "  - (b) **across the whole day**, an identical id is one food, and a found ancestor ingredient **folds into each found descendant** (鶏肉 + 鶏もも肉 = 1 food; 鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods: thigh and breast, each carrying 鶏肉); siblings stay separate;",
  "  - (c) nothing else collapses, and grouping is never chained.",
  "  - Representative id (for `matched.likedIds` / `dislikedIds`): the descendant over its ancestor; the dish over its defining ingredient.",
  "- **Verdict per food, most specific entry wins (rulings B2, follow-up, collapse precedence).** Profile entries are checked in this order, and the first level with a hit decides: (1) the food's ingredient ids themselves, descendant first; (2) their dictionary parent ingredients, nearest first; (3) the dish id; (4) the ingredient's category, then that category's ancestors, nearest first. A like and a dislike at the same level → the dislike wins. A food is liked, disliked or neither, never both.",
  "- `D` = number of **disliked foods**; `L` = number of **liked foods** (ruling B1 as narrowed by OQ-16: different foods under one category entry count separately; the same food counts once).",
  "- **Assumed `definingIngredientId` values** (the BA is adding the field; checked against the dictionary when published, see §6 O-4): dish-corn-soup → ing-corn, dish-saba-miso → ing-mackerel, dish-salted-salmon → ing-salmon, dish-tamagoyaki → ing-egg, dish-karaage → ing-chicken, dish-potato-salad → ing-potato, dish-white-fish-fry → ing-white-fish, dish-ginger-pork → ing-pork, dish-tonjiru → ing-pork, dish-miso-soup → ing-miso. No case relies on a dish not in this list.",
];
L.splice(at("- **Most specific entry wins (ruling B2).**"), 2, ...RULE);

L[at("| A26 ")] = "| A26 | PI | 「コーンスープ」sp 「にんじんのグラッセ」sd | {dish-corn-soup + ing-corn} is **one food** (defining ingredient), liked (level 1, ing-corn); ing-carrot ✗ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne`; likedCount **1** | OQ-16 collapse: a dish and its defining ingredient count once (was L 2 under literal B1); rule 5 |";
L[at("| A52 ")] = "| A52 | PJ | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「ごはん」st | ing-chicken folds into ing-chicken-thigh → **one food**; level 1 has like `ing-chicken` and dislike `ing-chicken-thigh` → dislike wins; dislikedIds [ing-chicken-thigh] | 1 | 0 | 0/3 | `low-preference` | `assess.low` | OQ-16 ancestor/descendant collapse + same-level tie → dislike; rule 4 (was D 1, L 1 → mixed under literal B1) |";

const NEW = [
  "| A58 | PL | 「さばのみそ煮」mn 「卵焼き」sd 「ごはん」st | {dish-saba-miso + ing-mackerel} one food, disliked (level 1); {dish-tamagoyaki + ing-egg} one food, liked | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne`; dislikedIds [dish-saba-miso] | collapse: disliking both the dish and its fish counts 1 food (literal B1 gave D 2 → low); rule 5 |",
  "| A59 | PN | 「豚のしょうが焼き」mn 「ごはん」st | {dish-ginger-pork + ing-pork} disliked (level 1, ing-pork); ing-ginger is **not** the defining ingredient → separate food, liked | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | collapse narrowed: しょうが焼き = 2 foods (if every name ingredient collapsed, the tie rule would give D 1, L 0 → low); rule 5 |",
  "| A60 | PN | 「豚のしょうが焼き」mn 「豚汁」sp 「ごはん」st | ing-pork found in two items (defining ingredient of both dishes) → identical id = **one** pork food, disliked; ing-ginger liked | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne`; dislikedCount 1 | two dishes sharing an ingredient: counted once (2 × D would give low); rule 5 |",
  "| A61 | PM | 「さばのみそ煮」mn 「ごはん」st | {dish-saba-miso + ing-mackerel}: level 1 (ingredient) like `ing-mackerel` decides before level 3 (dish) dislike `dish-saba-miso` | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | precedence ingredient → dish; 2 × 0 ≤ 2 → rule 6 |",
  "| A62 | PO | 「さばのみそ煮」mn 「ごはん」st | {dish-saba-miso + ing-mackerel}: no entry at levels 1–2; level 3 like `dish-saba-miso` decides before level 4 dislike `cat-fish` | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | precedence dish → category; rule 6 |",
  "| A63 | PC | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「ポテトサラダ」sd | ing-chicken folds into ing-chicken-thigh → one food, disliked at level 1 (member ing-chicken itself); {dish-potato-salad + ing-potato} liked | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | collapse: 鶏肉 + 鶏もも肉 count 1 (literal B1 gave D 2 → low); rule 5 |",
  "| A64 | PC | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「鶏むね肉のサラダ」sd | ing-chicken folds into **each** descendant → 2 foods {thigh + chicken}, {breast + chicken}; both disliked at level 1 (ing-chicken itself) | 2 | 0 | 0/3 | `low-preference` | `assess.low`; dislikedIds [ing-chicken-thigh, ing-chicken-breast] | siblings stay separate (collapse detail); rule 3 |",
];
L.splice(at("| A57 ") + 1, 0, ...NEW);

const PROF = [
  "| PL | ing-egg | dish-saba-miso, ing-mackerel | none-known |",
  "| PM | ing-mackerel | dish-saba-miso | none-known |",
  "| PN | ing-ginger | ing-pork | none-known |",
  "| PO | dish-saba-miso | cat-fish | none-known |",
];
L.splice(at("| PK ") + 1, 0, ...PROF);

const t = at("Totals: ");
L[t] = L[t]
  .replace("Totals: **57 cases** (49 from the H1 draft, 6 of them now resolved, + 8 added: A50–A57).", "Totals: **64 cases** (49 from the H1 draft, 6 of them resolved and A26, A52 recomputed for OQ-16, + 15 added: A50–A64).")
  .replace("Rulings: B1 (A11, A12, A52)", "Rulings: OQ-16 collapse (A26, A52, A58–A64), B1 (A11, A12, A64)");

const b2 = at("| B2 an id hitting");
L.splice(b2 + 1, 0,
  "| OQ-16 same food counts once (narrowed, not transitive; ancestor folds into each descendant) | Dish + defining ingredient within one item; identical or ancestor/descendant ids across the day; nothing else; precedence ingredient → dish → category. | A26, A52, A58–A64 |");

const o2 = at("- **O-2**");
L.splice(o2 + 1, 0,
  "- **O-3** A dish whose defining ingredient is also the ancestor of an id found in another item (「鶏のから揚げ」 + 「鶏もも肉のてりやき」): (a) puts ing-chicken with dish-karaage, (b) folds ing-chicken into the thigh, and (c) forbids chaining, so it is not stated whether dish-karaage joins the thigh food. QA proposal: the ancestor folds into the descendant and the dish stays with it (1 food). No fixed case uses it; the generator avoids it.",
  "- **O-4** `definingIngredientId` is not yet in the dictionary; §1 lists the values the cases assume. The transcription test checks them against the published dictionary; a mismatch is fixed in the case table, not the engine.",
  "- **Note for the BA:** US-E4-01/AC15 (H1 draft) says a level-1 like on ing-mackerel and a dislike on dish-saba-miso tie and the dislike wins; the later precedence ruling (ingredient → dish → category) gives *liked* (A61). The AC needs the update.");
fs.writeFileSync(p, L.join("\n"));
console.log("ok");
