import fs from 'node:fs';
const T = "[CHANGED 2026-11-10 tile redesign]";
const L = (...a) => a.join("\n");
function load(p) { const r = fs.readFileSync(p, 'utf8'); return { nl: r.includes('\r\n') ? '\r\n' : '\n', s: r.replace(/\r\n/g, '\n') }; }
function save(p, o) { fs.writeFileSync(p, o.s.replace(/\n/g, o.nl)); }
function rep(o, a, b) {
  const n = o.s.split(a).length - 1;
  if (n !== 1) throw new Error(`count ${n}: ${a.slice(0, 70)}`);
  o.s = o.s.split(a).join(b);
}
const p = 'C:/Projects/BentoMinder/docs/ba/user-stories.md';
const o = load(p);

rep(o, "  And 2026-11-04 is highlighted as low-preference with an explanation that mentions 2 disliked ingredients\n  And 2026-11-04 still shows the decision 「給食」 (school-lunch-planned)\n",
  `  And ${T} the tile of 2026-11-04 shows the day number and the bento (school lunch) icon only, with no assessment symbol and no text\n  And ${T} the day sheet of 2026-11-04 shows low-preference with an explanation that mentions 2 disliked ingredients, and the decision 「給食」 (school-lunch-planned)\n`);
rep(o, "  Then the calendar cell for 2026-11-04 shows the confirmed-bento marker and the recipe's Japanese name\n",
  `  Then ${T} the tile of 2026-11-04 shows the crossed spoon-and-spatula icon and the red top border (user-changed), with no recipe name; the day sheet shows the recipe's Japanese name\n`);

rep(o, "  Then the day shows low-preference with the label 「手動で変更」\n",
  `  Then ${T} the day sheet shows low-preference with the label 「手動で変更」, and the tile shows the red top border (US-E5-01/AC10) and no assessment symbol\n`);
rep(o, "  Then the calculated state is shown again and the 「手動で変更」 label disappears\n",
  `  Then ${T} the calculated state is shown again in the day sheet, the 「手動で変更」 label disappears, and the tile's red top border disappears unless a stored decision still exists (US-E5-01/AC10)\n`);
{
  const old = "  And a later version 3 that does not change 2026-11-18 does not show the line either\n  # M2 prep: data contract §3.5 menuVersionAtSet.\n```";
  rep(o, old, old.slice(0, -3) + `\nScenario: AC8 ${T} Overrides show on the tile only as the red top border (BR-05)\n  Given 2026-11-12 has an override\n  Then, wherever AC1-AC7 say the day shows an assessment, a label or a line of text, that content is in the day sheet; the tile shows the red top border and no assessment symbol, label or text (US-E5-01/AC3, AC10)\n\`\`\``);
}

rep(o, "  Then November 2026 is shown with 2026-11-15 marked as today\n",
  `  Then November 2026 is shown with 2026-11-15 shown as today ${T} (navy filled tile, white text, US-E5-01/AC11)\n`);
rep(o, "  And November 2026 starts with Sunday 2026-11-01 in the last column of the first row\n",
  `  And November 2026 starts with Sunday 2026-11-01 in the last column of the first row\n  And ${T} the Saturday/Sunday/holiday numeral colours apply only to tiles that are neither today (white on navy) nor past (grey, AC9); a past holiday keeps its text 「祝」\n`);

const new34 = L(
`Scenario: AC3 ${T} Each tile shows the day number and one state icon (BR-01, BR-03)`,
"  Then every tile of a day in the menu shows the day number and exactly one state icon for the displayed decision: school-lunch-planned = bento (lunch box) icon; homemade-bento-planned = crossed spoon and spatula; not-confirmed = crossed spoon and spatula with a question mark",
"  And a no-school-lunch day with reason bento-day shows the crossed spoon and spatula (AC13); every other no-lunch day, a day outside the menu and a day in a month without a confirmed menu show the day number only, with no state icon (DEFAULT, OQ-T1)",
"  And a tile shows no assessment symbol, no text label, no recipe name and no short name; the assessment with its explanation and the recipe name stay in the day sheet (US-E5-02/AC1, US-E4-02)",
"  And the three icons differ in shape, each has an accessible name (AC14) and each is explained in text in the legend (AC15)",
"  # Supersedes the old AC3 (two indicators, assessment state and decision, on every school-day cell).",
"",
`Scenario: AC4 ${T} Suggested vs confirmed is told apart by icon; assessment and name only in the sheet (BR-03)`,
"  Given 2026-11-04 is low-preference with decision school-lunch-planned and 2026-11-11 is homemade-bento-planned",
"  Then the tile of 2026-11-04 shows the bento icon and the tile of 2026-11-11 the crossed spoon-and-spatula icon, differing in shape and not only in colour",
"  And neither tile shows an assessment symbol or any recipe name; the sheet of 2026-11-04 shows low-preference with its explanation and the sheet of 2026-11-11 the recipe's full name",
"  And if the planned recipe is missing from the library (US-E6-06), the tile is unchanged and the sheet shows the stored recipeNameSnapshot",
"  # Retired from the tile: the low-preference marker, the text 「給食」, the filled bento marker, shortNameJa / shortNameEn / recipeShortNameSnapshot (US-E6-07/AC5; data contract §3.6-§3.7 keep them as data, OQ-T4).",
"", "");
{
  const i = o.s.indexOf("Scenario: AC3 Each school day shows assessment and decision separately");
  const j = o.s.indexOf("Scenario: AC5 Month navigation");
  if (i < 0 || j < 0) throw new Error("ac3/4 anchors");
  o.s = o.s.slice(0, i) + new34 + o.s.slice(j);
}
{
  const old = "  And assessments, decisions, the weekly reminder's covered days and the share text are unchanged by the setting\n```";
  const add = L(old.slice(0, -3),
`Scenario: AC9 ${T} Past days are grey (BR-27)`,
"  Given today is 2026-11-10 JST",
"  Then the tiles of 2026-11-09 and earlier show a grey stroke and a grey day number and icon (no hue); the state icon is still visible",
"  And today and later tiles are not grey; a past tile can still be opened (read-only sheet, US-E5-02/AC3)",
"  And a past tile's accessible name says it is past (AC14)",
"",
`Scenario: AC10 ${T} A user-changed day has a red top border (BR-05)`,
"  Given a day with an applied AssessmentOverride (US-E4-03) or a stored DayDecision of any parent event (CONFIRM_RECIPE, DEFER, SET_SCHOOL_LUNCH, MARK_RESERVATION, CHANGE_RECIPE)",
"  Then its tile has a red top border; a day with only the calculated assessment, a dormant override (US-E3-05/AC8) or a derived decision has none",
"  And the border is removed when the override is cleared (「自動判定に戻す」) and no stored decision remains, or when the stored decision is removed (「計画を取り消す」 on a bento-day, US-E5-06)",
"  And a past user-changed day keeps its red top border with grey stroke and content (DEFAULT, OQ-T3)",
"  And the change is not told by colour alone: the accessible name says 「手動で変更」 (en \"changed by you\", AC14) and the legend explains the border in text",
"",
`Scenario: AC11 ${T} Today is a navy filled tile`,
"  Given it is 2026-11-15 JST (BR-15)",
"  Then the tile of 2026-11-15 is filled navy with white day number and icon, in light and dark (contrast, US-NF-02/AC1), and its accessible name says it is today",
"  And at Tokyo midnight the fill moves to the next date without a reload (clock check as US-E7-03/AC3)",
"  And it is the only filled tile (US-E8-05/AC3)",
"",
`Scenario: AC12 ${T} Tomorrow has a navy border`,
"  Given it is 2026-11-15 JST",
"  Then the tile of 2026-11-16 has a navy border and no fill, and its accessible name says it is tomorrow",
"  And tomorrow is the next calendar date, not the next school day: on Saturday 2026-11-14 the tile of Sunday 2026-11-15 has the border",
"  And on 2026-11-30 the border is on 2026-12-01, visible when December is shown",
"",
`Scenario: AC13 ${T} A red dash marks a bento that is needed and not yet planned (BR-02, BR-16)`,
"  Given 2026-11-18 is a no-school-lunch day with reason bento-day and has no stored decision, and today is 2026-11-10 or 2026-11-18",
"  Then its tile shows the crossed spoon-and-spatula icon and a red dash, and its accessible name says 「お弁当の準備が未定」 (en \"bento still to plan\", AC14)",
"  When the parent confirms a recipe for 2026-11-18 (US-E5-08/AC1)",
"  Then the red dash is gone and the tile keeps the icon (plus the red top border, AC10)",
"  When the parent cancels the plan (US-E5-06) the dash returns",
"  And a past bento day shows no dash; a school-lunch-planned day, a not-confirmed day and an ordinary no-lunch day never show one (DEFAULT, OQ-T2)",
"",
`Scenario: AC14 ${T} Accessible name of a tile (BR-03; US-NF-02/AC4)`,
"  Then each tile of a day in the menu has an accessible name made of, in this order: the date with weekday, the state, 「手動で変更」 if user-changed, 「今日」 / 「明日」 / 「過去の日」 if applicable, 「お弁当の準備が未定」 if the red dash shows; in en the same parts (\"changed by you\", \"today\", \"tomorrow\", \"past day\", \"bento still to plan\")",
"  And the state words are 「給食」 / 「手作りお弁当」 / 「未定」 / 「手作りお弁当の日」 (bento-day, no plan) and 「給食なし」 for other no-lunch days (en \"school lunch\", \"homemade bento\", \"undecided\", \"bento day\", \"no school lunch\")",
"  And ja example: 「11月4日（水）、給食、手動で変更、明日」; en example: \"Wednesday, November 4, school lunch, changed by you, tomorrow\"",
"  And the name contains neither the assessment nor a recipe name (they are in the day sheet; DEFAULT, OQ-T5); the tile stays at least 44 x 44 CSS px and reachable by keyboard with a visible focus",
"  And every part is derived from the same data as the visual mark, so visuals and name cannot disagree",
"",
`Scenario: AC15 ${T} Legend 「表示の見かた」 explains every mark in text`,
"  When the parent opens 「表示の見かた」",
"  Then each mark is shown with its icon or sample and a text line: the three state icons, grey past day, red top border, navy filled today, navy border tomorrow, red dash",
"  And it lists no assessment symbol and no recipe name, and its text exists in ja and en (US-E8-02/AC1)",
"```");
  rep(o, old, add);
}

rep(o, "  Then a sheet shows 「11月4日（水）」, the menu items, the assessment with its explanation, the current decision, and only the actions allowed by the state machine\n",
  `  Then a sheet shows 「11月4日（水）」, the menu items, the assessment with its explanation (and the label 「手動で変更」 when overridden), the current decision, the recipe's full name when planned, and only the actions allowed by the state machine ${T} (these no longer appear on the tile)\n`);
rep(o, "  And the calendar cell shows the recipe name\n",
  `  And ${T} the tile shows the crossed spoon-and-spatula icon and the red top border, no recipe name; the day sheet shows the recipe name\n`);
rep(o, "  Then the decision is not-confirmed and the cell shows 「未定」 with an outline (not filled) bento marker\n",
  `  Then the decision is not-confirmed and ${T} the tile shows the crossed spoon-and-spatula icon with a question mark and the red top border, no text; the day sheet shows 「未定」\n`);
rep(o, "  Then the cell shows the stored recipeShortNameSnapshot, the sheet shows",
  `  Then ${T} the tile is unchanged (crossed spoon-and-spatula icon, no name), the sheet shows`);
rep(o, "Scenario: AC5 Every recipe has calendar short names\n", `Scenario: AC5 Every recipe has calendar short names ${T} (data only: no longer shown on the tile, OQ-T4)\n`);
rep(o, "  Then the top of the calendar screen shows <text>\n", `  Then ${T} the today card, placed below the calendar, shows <text>\n`);
rep(o, "  Then in light and in dark, homemade-bento-planned is the only solid-filled cell, and the axe and contrast checks of US-NF-02 pass in both themes\n",
  `  Then ${T} in light and in dark, today (navy filled, white text) is the only solid-filled tile, and the axe and contrast checks of US-NF-02 pass in both themes, including grey past tiles, the red top border, the navy border, the red dash and the three icons\n`);
rep(o, "  Then assessment and decision states are distinguishable without color, and every touch target is at least 44 × 44 CSS px at 360 px width\n",
  `  Then ${T} the tile marks (state icon, past, user-changed, today, tomorrow, red dash) are distinguishable without colour, the assessment states are distinguishable without colour in the day sheet, and every touch target is at least 44 × 44 CSS px at 360 px width\n`);
rep(o, "  Then each school-day cell has an accessible name like 「11月4日（水）、苦手かも、給食」\n",
  `  Then ${T} each tile of a day in the menu has an accessible name as in US-E5-01/AC14, e.g. 「11月4日（水）、給食、手動で変更、明日」 (the assessment is no longer part of it)\n`);

const sec = L(
"### Calendar day tile redesign (2026-11-10; PO decision in PLAN §7, last row; 73 / 359 -> 73 / 367 ACs)",
"Only where and how the calendar day tile shows things changes; BR-01..BR-27, the assessment, decisions, overrides and reminders do not. No AC was renumbered; changed ACs carry `" + T + "`; new ACs take the next number.",
"",
"| Why | Changed | Added | Retired (superseded text, number kept) |",
"|-----|---------|-------|---------|",
"| PO: tile = day number + one state icon; no assessment symbol, no recipe name; past grey; user-changed red top border; today navy filled; tomorrow navy border; red dash = bento needed, not planned | US-E5-01/AC1, AC2, AC3, AC4; US-E5-02/AC1; US-E5-03/AC2; US-E5-05/AC1; US-E4-03/AC1, AC3; US-E6-06/AC1; US-E6-07/AC5 (note); US-E7-03/AC1 (card below the calendar); US-E8-05/AC3; US-NF-02/AC3, AC4; US-E0-01/AC1; data contract recipeShortNameSnapshot and shortNameJa/shortNameEn wording | US-E5-01/AC9-AC15; US-E4-03/AC8 | Old US-E5-01/AC3 (two indicators per school-day cell), old US-E5-01/AC4 text (low-preference marker, 「給食」 text, recipe short name on the cell), old US-NF-02/AC4 name with the assessment, old US-E8-05/AC3 (bento cell is the only filled one) |",
"", "");
rep(o, "## Conventions used in the ACs\n", sec + "## Conventions used in the ACs\n");
rep(o, "- A scenario title ending in `(BR-xx)`",
  `- ${T} Calendar tiles: wherever an older AC says a calendar day or cell "shows" an assessment, a label such as 「手動で変更」, a flag line such as 「献立が変わりました」 or a recipe name, that content is in the day sheet (and the lists and cards), not on the tile; what a tile shows is only US-E5-01/AC3-AC15.\n- A scenario title ending in \`(BR-xx)\``);
rep(o, "| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 36 |", "| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 37 |");
rep(o, "| E5 Calendar & family decisions | US-E5-01 … 08 | 8 | 33 |", "| E5 Calendar & family decisions | US-E5-01 … 08 | 8 | 40 |");
rep(o, "| **359 (49 v1)** |", "| **367 (49 v1)** |");
save(p, o);

const p2 = 'C:/Projects/BentoMinder/docs/ba/data-contract.md';
const d = load(p2);
rep(d, "shown in the calendar cell when the recipe no longer resolves (US-E5-01/AC4, US-E6-06)", `kept as data; since the 2026-11-10 tile redesign it is no longer shown on the calendar tile (no recipe name on the tile, US-E5-01/AC4, US-E6-06) ${T}`);
rep(d, "shown in calendar cells (US-E5-01/AC4);", `kept as data; not shown on the calendar tile since the 2026-11-10 tile redesign (US-E5-01/AC4) ${T};`);
rep(d, "curated from `name.en`, shown in cells when the language is en;", `curated from \`name.en\`, kept as data, not shown on the calendar tile since 2026-11-10 ${T};`);
save(p2, d);
console.log("ok");
