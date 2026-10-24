// One-off editor: PLAN §7 "H1 closing rulings" (A57, S10, O-3, U5, RU1, N3 = OQ-20, AC15) + dictionary definingIngredientId.
const fs = require("fs");
function load(p) { return fs.readFileSync(p, "utf8").split("\n"); }
function mk(L) { return (pre) => { const i = L.findIndex((l) => l.startsWith(pre)); if (i < 0) throw new Error(pre); return i; }; }

// ---------- assessment ----------
{
  const p = "tests/oracle/assessment-oracle.md"; const L = load(p); const at = mk(L);
  L[at("  - (c) nothing else collapses")] = "  - (c) nothing else collapses and grouping is never chained: defining-ingredient links never take part in cross-item collapse, so two dishes in different items are always 2 foods, even with the same defining ingredient (US-E4-01/AC18) and a dish's food never joins a descendant found in another item (から揚げ + 鶏もも肉 = 2 foods, closing ruling O-3). An id identical to a dish's defining ingredient found elsewhere on the day is counted through that dish, not as a food of its own.";
  L[at("- **Assumed `definingIngredientId` values**")] = "- **`definingIngredientId` values used by the cases** (dictionary §5, H1 final: 24 of 55 dishes set, 31 null; reconciled 2026-10-24): dish-corn-soup → ing-corn, dish-saba-miso → ing-mackerel, dish-salted-salmon → ing-salmon, dish-tamagoyaki → ing-egg, dish-karaage → ing-chicken, dish-potato-salad → ing-potato, dish-white-fish-fry → ing-white-fish, dish-ginger-pork → ing-pork, dish-tonjiru → ing-pork; **dish-miso-soup → null** and **dish-curry-rice → null** (QA had assumed ing-miso for みそ汁: A24 and A33 keep their results because ing-miso then is a food of its own with the same verdict). A transcription test reads the values from the dictionary JSON and fails on drift.";
  let i = at("| A57 ");
  L[i] = L[i].replace("**Partly open (O-2):** whether 2026-11-11 is in the refresh's \"needs review\" list is not ruled (B6 covers dates that become no-lunch days, not removed dates); that one assertion runs as `todo` |", "closing ruling A57: the refresh's \"needs review\" list contains 2026-11-11 (asserted) |");
  if (L[i].includes("todo")) throw new Error("A57 not updated");
  L[at("| A60 ")] = "| A60 | PN | 「豚のしょうが焼き」mn 「豚汁」sp 「ごはん」st | item 1: {dish-ginger-pork + ing-pork} disliked, ing-ginger liked; item 2: {dish-tonjiru + ing-pork} disliked. Two dishes in different items never merge, even through the same defining ingredient → **2** disliked foods | 2 | 1 | 0/3 | `low-preference` | `assess.low`; dislikedIds [dish-ginger-pork, dish-tonjiru] | two dishes sharing an ingredient (US-E4-01/AC18); rule 3 |";
  L.splice(at("| A64 ") + 1, 0, "| A65 | PC | 「鶏のから揚げ」mn 「鶏もも肉のてりやき」mn 「ポテトサラダ」sd | {dish-karaage + ing-chicken} (item 1) disliked at level 1; ing-chicken-thigh (item 2) is a separate food (closing ruling O-3), disliked at level 2 (parent ing-chicken); {dish-potato-salad + ing-potato} liked | 2 | 1 | 0/3 | `low-preference` | `assess.low`; dislikedIds [dish-karaage, ing-chicken-thigh] | O-3: a defining-ingredient link never joins a descendant in another item; rule 3 |");
  i = at("Totals: ");
  L[i] = L[i].replace("Totals: **64 cases** (49 from the H1 draft, 6 of them resolved and A26, A52 recomputed for OQ-16, + 15 added: A50–A64). All are asserted; one assertion of A57 runs as `todo` (O-2, §6).", "Totals: **65 cases** (49 from the H1 draft, 6 of them resolved and A26, A52 recomputed for OQ-16, + 16 added: A50–A65). All are asserted; none runs as `todo`.").replace("OQ-16 collapse (A26, A52, A58–A64)", "OQ-16 collapse (A26, A52, A58–A65)");
  if (!L[i].includes("65 cases")) throw new Error("totals");
  const o2 = at("**Still open (not blocking the oracle; one assertion runs as `todo`):**");
  const end = at("Random comparison (§5): the generator now");
  L.splice(o2, end - o2,
    "**Closing rulings (PLAN §7 \"H1 closing rulings\") — nothing is open:**",
    "- **O-2 → A57** a removed date carrying an override is listed in \"needs review\" (asserted).",
    "- **O-3 → A65** defining-ingredient links never take part in cross-item collapse.",
    "- **O-4** `definingIngredientId` is published (24 set, 31 null); §1 reconciled (only みそ汁 differed, no result changed).",
    "- **AC15** precedence ingredient → dish → category wins over the earlier wording (A61); same-level tie → dislike unchanged.",
    "");
  L[at("Random comparison (§5): the generator now")] = "Random comparison (§5): the generator draws profiles whose likes and dislikes sit on one chain (like a category, dislike a member, or the reverse), profiles that name dish ids next to their defining ingredients, and days that repeat a defining ingredient across items or mix an ancestor with several descendants. Refresh events that remove a date carrying an override compare the \"needs review\" list too. No constraint is left for undecided rules.";
  fs.writeFileSync(p, L.join("\n"));
}

// ---------- decision ----------
{
  const p = "tests/oracle/decision-state-oracle.md"; const L = load(p); const at = mk(L);
  L[at("| S10 ")] = "| S10 | Menu refresh removes 2026-11-11 (NC) from the menu entirely | NC record byte-identical and **dormant**: not shown, no action offered (G2); 2026-11-11 is in the refresh's \"needs review\" list (NC records are listed) | BR-13, closing ruling S10 |";
  L.splice(at("| S22 ") + 1, 0,
    "| S23 | Menu refresh removes 2026-11-12 (SL stored, flag true), then a later refresh lists 2026-11-12 as a school day again | dormant while removed (not shown, no actions, **not** listed in \"needs review\": only NC records are); SL with flag true returns unchanged | closing ruling S10 |");
  L.splice(at("| T54 ") + 1, 0,
    "| T55 | school 2026-11-12 NC record; refresh turns 11-12 into an お弁当の日 (NC dormant, displayed NSL 「お弁当の日」) | `CONFIRM(R1)` | accepted: HB R1 **replaces** the dormant NC record (`plannedAt` = now); a later refresh back to a school day shows HB R1, no NC returns | ✓ | closing ruling U5 |",
    "| T56 | school 2026-11-04 HB R1 (`plannedAt` P1) | `LATER`, then `CONFIRM(R2)` | after `LATER`: NC, `plannedAt` **cleared**; after `CONFIRM(R2)`: HB R2, new `plannedAt` = now | ✗ then ✓/✗ by the new `plannedAt` (reminder RM41) | closing ruling RU1 |");
  const u = at("**Still open (no fixed case depends on them; the random generator avoids them):**");
  L.splice(u, 3,
    "**Closing rulings (PLAN §7 \"H1 closing rulings\") — nothing is open:**",
    "- **U4 → S10, S23** NC/SL records on a removed date stay dormant (not shown, no actions) and return unchanged if the date reappears; NC ones are listed in \"needs review\".",
    "- **U5 → T55** an explicit `CONFIRM_RECIPE` on an お弁当の日 replaces any dormant record for that date.",
    "- **RU1 → T56** `plannedAt` is cleared when the day leaves HB; planning again sets a new one.");
  let i = at("Added at the H1 rulings:");
  L[i] = L[i].replace(" Refresh events are drawn from menu variants that add, remove and convert dates; the generator does not produce the two open situations of §4 (U4: NC/SL on a removed date; U5: `CONFIRM` on an お弁当の日 carrying a dormant record) until they are ruled.", " (P9) `plannedAt` is absent on every non-HB record. Refresh events are drawn from menu variants that add, remove and convert dates, including removal of NC/SL dates and `CONFIRM` on an お弁当の日 that carries a dormant record; no situation is excluded.");
  L[i] = L[i].replace("(P7) `plannedAt` changes only on a `CONFIRM` into HB;", "(P7) `plannedAt` is set only by a `CONFIRM` into HB and cleared when the day leaves HB;");
  i = at("Case count:");
  L[i] = "Case count: **56 transitions** (T01–T56; T42–T56 added at the rulings) + **23 system events** (S01–S23; S20–S23 added). All asserted; none runs as `todo`.";
  // model text for plannedAt
  i = at("**`plannedAt` (ruling B10).**");
  L[i] = "**`plannedAt` (rulings B10, RU1).** Set to `now` by the `CONFIRM` that creates the HB state; unchanged by `CHANGE`; cleared when the day leaves HB (`LATER`, `TO_SCHOOL_OK`, `CLEAR_OK`); `decidedAt` is updated by every accepted event. Used only by the reminder oracle.";
  fs.writeFileSync(p, L.join("\n"));
}

// ---------- reminder ----------
{
  const p = "tests/oracle/reminder-oracle.md"; const L = load(p); const at = mk(L);
  let i = at("**Visibility at instant `now`**");
  L[i] = L[i].replace("**and** its key has no `shownAt`/`dismissedAt` in `reminderLog`.", "**and** its key has no `dismissedAt` in `reminderLog` (OQ-20: a shown but undismissed reminder shows again on every open until dismissed or expired). A settings change re-plans the due instant but never fires a key a second time as a new reminder.");
  L[at("| RM22 ")] = "| RM22 | 2026-11-04 HB; shown at 17:30 and **dismissed** 17:31, then day-before time changed to 19:15 | 2026-11-03 19:15 | Asia/Tokyo | key unchanged, due now 2026-11-03T10:15:00Z | none (dismissed) | US-E7-04/AC2 \"not shown again\" |";
  L.splice(at("| RM40 ") + 1, 0,
    "| RM41 | 2026-11-04 HB R1 planned 2026-11-02 12:00; `LATER` at 2026-11-03 17:00 (`plannedAt` cleared, key removed); `CONFIRM(R2)` at 2026-11-03 18:00 (new `plannedAt` 09:00Z > due 08:30Z) | 2026-11-03 18:00 | Asia/Tokyo | no `day-before:2026-11-04` | none; the 11-04 today card names R2 | closing ruling RU1 (decision T56) |",
    "| RM42 | 2026-11-04 HB; reminder shown at 17:30, app closed without dismissing | reopen 2026-11-03 19:00; reopen 2026-11-04 07:00 | Asia/Tokyo | as RM01 | 19:00: day-before:2026-11-04 shown again (label 17:30); 07:00: none (expired 2026-11-03T15:00Z) | OQ-20 (N3) |",
    "| RM43 | as RM42, but the day-before time was changed to 19:15 at 18:00 | reopen 2026-11-03 18:30 | Asia/Tokyo | key unchanged, due now 2026-11-03T10:15:00Z | day-before:2026-11-04 (already shown at 17:30, undismissed: OQ-20 keeps it; the time change does not hide it and does not make it a new reminder) | OQ-20 + US-E7-04/AC2 |");
  L[at("40 cases (RM34–RM40 added at the H1 rulings).")] = "43 cases (RM34–RM43 added at the H1 rulings).";
  const r = at("- **RU1 — `plannedAt` after the day left HB");
  L.splice(r - 1, 3,
    "**Closing rulings (PLAN §7 \"H1 closing rulings\") — nothing is open:**",
    "- **RU1 → RM41** `plannedAt` is cleared when the day leaves HB; planning it again sets a new one.",
    "- **N3 = OQ-20 → RM42, RM43** a shown, undismissed reminder shows again until dismissed or expired; RM22 now dismisses explicitly. The generator writes shown-only and dismissed log entries and re-plans after `LATER`/`TO_SCHOOL`/`CLEAR` followed by `CONFIRM` before and after the due instant.");
  i = at("Case count: **40**");
  L[i] = "Case count: **43** (RM01–RM33 + RM34–RM43).";
  fs.writeFileSync(p, L.join("\n"));
}
console.log("ok");
