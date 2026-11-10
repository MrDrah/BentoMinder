import { readFileSync, writeFileSync } from 'node:fs';
function edit(f, pairs) { let s = readFileSync(f, 'utf8'); for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(f + ' missing: ' + a.slice(0, 60)); s = s.replace(a, () => b); } writeFileSync(f, s); }

// ---------- components.md ----------
edit('design/components.md', [
['Nothing else is ever drawn on a tile: no assessment symbol, no word, no recipe name, no badge. The "needs review" and "allergen" badges of §2.4 layer 4 are **not on the tile any more** (BA: what a tile shows is only AC3-AC15); the same facts remain in the day sheet, the upcoming summary and the reminders (report, question 3).',
`**Content budget (ruling 2026-11-10, BA AC16): a tile never shows more than the day number (with 「祝」 on a holiday, part of the date) + one state icon + at most one allergen mark (§18.12) + the edge markers (top bar, red dash, and the border / fill of today and tomorrow).** Nothing else is ever drawn on a tile: no assessment symbol, no word, no recipe name, no other badge. The "needs review" badge and the refresh-conflict flag of §2.4 layer 4 are **not on the tile any more**; the same facts remain in the day sheet, the upcoming summary and the reminders. The allergen mark is the only badge that stays (PO, safety). Testable form: a tile element contains the number element, at most the holiday word, at most one icon, at most one \`.cell__allergen\` and at most one \`.cell__dash\`; the top bar is a pseudo-element.`],
['Anatomy (390 px, weekday column; the weekend column is narrower, see §18.4)', 'Anatomy (390 px, weekday column; the weekend column is narrower, see §18.4; the allergen mark of §18.12 sits bottom right)'],
['It explains exactly the icons and markers a tile can show and nothing else: no assessment symbols, no recipe name, no hatch, no badge, no dashed "suggestion" frame.',
 'It explains exactly the icons and markers a tile can show and nothing else: no assessment symbols, no recipe name, no hatch, no dashed "suggestion" frame, and no badge other than the allergen mark (row `legend.allergen`, sample tile 40 x 56 with the mark; the sample mark is 16 px with a 12 px glyph).'],
['5. Sample with a red dash: `legend.dash`.\n6. Sample with a red top bar: `legend.changedEdge`.\n7. Filled sample: `legend.today`.\n8. Framed sample (2 px): `legend.tomorrow`.\n9. Grey sample: `legend.past`.\n10. Number colours: `legend.weekend` (kept).',
 '5. Sample with a red dash: `legend.dash`.\n6. Lunch-box sample with the allergen mark: `legend.allergen` (new, BA AC16).\n7. Sample with a red top bar: `legend.changedEdge`.\n8. Filled sample: `legend.today`.\n9. Framed sample (2 px): `legend.tomorrow`.\n10. Grey sample: `legend.past`.\n11. Number colours: `legend.weekend` (kept).'],
['then the markers as words: 「手動で変更」 when changed and 「お弁当の準備が未定」 when the dash applies.', 'then the markers as words: 「アレルギーに注意」 when the mark applies (with a 16 px copy of the mark in front of the word), 「手動で変更」 when changed and 「お弁当の準備が未定」 when the dash applies.'],
['`{date}[、{holidayName}]、{state}[、手動で変更][、今日|明日|過去の日][、お弁当の準備が未定]` (en with ", ").', '`{date}[、{holidayName}]、{state}[、アレルギーに注意][、手動で変更][、今日|明日|過去の日][、お弁当の準備が未定]` (en with ", "). The allergen part comes right after the state (safety first).'],
['add `data-icon="school|home|unsure|none"`, `data-dash="true"`, `data-changed="true"`, `data-tomorrow="true"`.', 'add `data-icon="school|home|unsure|none"`, `data-dash="true"`, `data-changed="true"`, `data-tomorrow="true"`, `data-allergen="true"` (also the class `has-allergen`).'],
['US-E5-01/AC1-AC4, AC9-AC15; US-E5-02/AC1 (the sheet', 'US-E5-01/AC1-AC4, AC9-AC16; US-E1-05/AC2; US-E5-02/AC1 (the sheet'],
['## 18. Calendar day tile redesign (PO 2026-11-10, PLAN §7 last row; BA: US-E5-01/AC3-AC4, AC9-AC15)', '## 18. Calendar day tile redesign (PO 2026-11-10, PLAN §7 last row; BA: US-E5-01/AC3-AC4, AC9-AC16)'],
['### 18.11 Coverage', `### 18.12 Allergen mark (BA US-E5-01/AC16; PO safety ruling 2026-11-10)

One tiny round badge with a 「!」, the shape of the old §2.4 layer-4 allergen badge (circle, fill, ring, bold "!") reused so the family stays one shape one meaning (the day sheet banner and the recipe warnings use the same \`danger\` family).

**When:** the day is displayed \`school-lunch-planned\` (the \`lunchbox\` tile) and its menu carries the allergen alert of US-E1-05/AC2 for the child's registered allergens (the same predicate as the day-sheet banner \`day-banner-allergen\`). Not on home-bento, unsure, bento-day or number-only tiles, so it can never meet the red dash (the dash exists only on bento days). It can meet the top bar (a changed school day) and every time state.

**Anatomy and position:** a \`span.cell__allergen\`, \`aria-hidden="true"\`, absolutely placed in the **bottom-right corner** of the tile's padding box. Bottom right is the only free corner: the number is top centre (with 「祝」 beside it, which rules out top right), the top bar is the top edge, the dash is bottom centre (never together with the mark) and the icon is centred.

| | 360 / 390 | weekend column (44 wide) | >= 768 | >= 1280 |
|---|---|---|---|---|
| Badge (circle) | 18 px | 18 px | 20 px | 20 px |
| Glyph \`!\` | 12 px (\`text-xs\`) 700 | 12 px | 13 px | 13 px |
| Offset right / bottom | 3 px | 3 px | 4 px | 4 px |
| Ring | 1.5 px | same | same | same |

Measured in the preview (390 geometry, all combinations, \`docs/dev/_scratch/ui-refresh/measure-allergen.mjs\`): the badge never overlaps the number, 「祝」, the drawn lunch-box shape (clearance 2.5 px on tomorrow, 3.5 px on others, 5.6 px in the weekend column) or the selected ring (the badge sits 1 px inside it). At 768 and 1280 the tile grows to 96 and 104 px high, so the clearance is 15 px or more. The 3 px top bar and the 18 px wide dash are far away. The tile's 44 x 44 touch target is unchanged (the mark is not a control).

**Tokens (same names in light and dark; no new colour):** fill \`danger-soft\` (#FBE3E0 / #40242A), ring and glyph \`danger\` (#A3271F / #FF9C92). CSS: \`.cell__allergen { position: absolute; right: 3px; bottom: 3px; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; background: var(--danger-soft); color: var(--danger); border: 1.5px solid var(--danger); display: grid; place-items: center; font-size: var(--text-xs); font-weight: var(--weight-bold); line-height: 1; pointer-events: none; }\` and from 768 \`width: 20px; height: 20px; right: 4px; bottom: 4px; font-size: 13px;\`. It is a child of \`button.cell__btn\`, painted above the selected ring, the top bar and the fill.

**Combinations (the mark keeps its own colours everywhere; it never inverts, greys or hides):**

| Tile state | Treatment |
|---|---|
| default / future | as above on \`surface-2\` (T28) |
| hover, active | unchanged; the ring still reads on \`surface-3\` (T30). No hover on past |
| focus-visible | the global ring is drawn on the tile, the mark is unchanged |
| selected | the 3 px ring (4 px on tomorrow) stays outside the mark; the mark is painted above it |
| today (navy, cream in dark) | the mark keeps its own light fill, so it is a light disc on the filled tile (T31); the ring on navy is decorative |
| tomorrow | as default on \`surface-2\`; sits 1 px inside the 2 px frame and the 4 px selected ring |
| past | **stays in \`danger\` colours** (not grey): a safety fact is not dimmed for a past day (T29). The grey rule of AC9 applies to number and icon |
| changed (top bar) | both shown; no interaction |
| weekend column | same 18 px badge, same corner |
| agenda fallback / 200 % text | row shows the 16 px badge plus the word 「アレルギーに注意」 |

**Not colour-only:** a circle with the glyph 「!」 (shape and character), the words in the accessible name (copy §24.1, \`cell.aria.allergen\`) and in the legend (\`legend.allergen\`). Greyscale check: the disc and the "!" remain distinguishable. Contrast: \`design/a11y-responsive.md\` §12.2, T27-T31.

### 18.11 Coverage`],
]);

// ---------- a11y-responsive.md ----------
edit('design/a11y-responsive.md', [
['`{date}[、{holidayName}]、{state}[、手動で変更][、今日|明日|過去の日][、お弁当の準備が未定]`\n', '`{date}[、{holidayName}]、{state}[、アレルギーに注意][、手動で変更][、今日|明日|過去の日][、お弁当の準備が未定]`\n'],
['| School lunch, changed by the user, tomorrow (BA example) |', '| School lunch with the allergen alert | 11月19日（木）、給食、アレルギーに注意 | Thu, Nov 19, school lunch, allergen alert |\n| School lunch, allergen alert, changed, today | 11月17日（火）、給食、アレルギーに注意、手動で変更、今日 | Tue, Nov 17, school lunch, allergen alert, changed by you, today |\n| Past school-lunch day with the alert | 11月6日（金）、給食、アレルギーに注意、過去の日 | Fri, Nov 6, school lunch, allergen alert, past day |\n| School lunch, changed by the user, tomorrow (BA example) |'],
['Icons, the red dash and the red top bar are `aria-hidden` decoration;', 'Icons, the allergen mark, the red dash and the red top bar are `aria-hidden` decoration;'],
['Assessment (○ △ ? —), recipe name and badges are no longer on the tile.', 'allergen alert = a circled 「!」 bottom right + 「アレルギーに注意」 (the first fact after the state in the name). Assessment (○ △ ? —), recipe name and every other badge are no longer on the tile.'],
['**26 pairs x 2 themes = 52 checks, 0 failures**', '**31 pairs x 2 themes = 62 checks, 0 failures**'],
['| T25 / T26 |', '| T27 | `danger` on `danger-soft` | allergen mark: the 「!」 glyph on its fill (12-13 px bold, so held to the text 4.5) | 5.99 | 6.93 | 4.5 |\n| T28 | `danger` on `surface-2` | allergen mark ring against a normal or tomorrow tile | 7.20 | 7.59 | 3 |\n| T29 | `danger` on `surface-1` | allergen mark ring against a past (transparent) tile | 7.32 | 8.53 | 3 |\n| T30 | `danger` on `surface-3` | allergen mark ring on the hover / active fill | 6.13 | 6.52 | 3 |\n| T31 | `danger-soft` on `navy-fill` | allergen mark fill against the today tile (the ring there is decorative) | 11.62 | 12.21 | 3 |\n| T25 / T26 |'],
['T01-T26 are not added to the main 68-pair table', 'The lowest allergen-mark pair is T27 (5.99:1). T01-T31 are not added to the main 68-pair table'],
]);

// ---------- copy.md ----------
edit('design/copy.md', [
['## 24. Calendar day tile redesign (components §18; BA US-E5-01/AC3-AC4, AC9-AC15; PO 2026-11-10)', '## 24. Calendar day tile redesign (components §18; BA US-E5-01/AC3-AC4, AC9-AC16; PO 2026-11-10)'],
['| cell.aria.dash |', '| cell.aria.allergen | 、アレルギーに注意 | , allergen alert | Suffix right after the state, when the allergen mark is shown (school-lunch day; BA wording verbatim). Also the visible word in the agenda row (developer strips the separator) | US-E5-01/AC16, US-E1-05/AC2 |\n| cell.aria.dash |'],
['Suffix order: 手動で変更、今日|明日|過去の日、お弁当の準備が未定.', 'Suffix order: アレルギーに注意、手動で変更、今日|明日|過去の日、お弁当の準備が未定.'],
['| legend.changedEdge |', '| legend.allergen | ！：登録したアレルギーに注意が必要な給食の日 | ! mark: school lunch day that needs allergen attention (your registered allergens) | Row with the lunch-box-and-mark sample | US-E5-01/AC16, AC15 |\n| legend.changedEdge |'],
['Reused unchanged: `cell.aria.override`', '`cell.flag.allergen` (「アレルゲン注意」, §8) is **not used on the tile**; the tile uses `cell.aria.allergen` (BA wording 「アレルギーに注意」). The row stays for the day-sheet banner and reminders only; recommendation: do not use both words for the same fact on one screen (PO may prefer to retire the row). Reused unchanged: `cell.aria.override`'],
["No new strings are needed for the tile's visible parts", "The mark itself is the character 「!」, not a string. No other new strings are needed for the tile's visible parts"],
]);

// ---------- ui-refresh-2026-11.md ----------
edit('design/ui-refresh-2026-11.md', [
['5. `cellLabel` builds the name from copy §24: `cell.aria.tile`, then `cell.aria.override`,', '5. `cellLabel` builds the name from copy §24: `cell.aria.tile`, then `cell.aria.allergen` (when the mark shows), then `cell.aria.override`,'],
['**CSS** (`src/ui/styles/calendar.css`; replaces', `**Allergen mark** (components §18.12; BA US-E5-01/AC16): inside \`button.cell__btn\`, after the icon, render \`span.cell__allergen[aria-hidden]\` containing the character \`!\` when the day is displayed school-lunch-planned AND the existing day-sheet allergen predicate (\`day-banner-allergen\`, US-E1-05/AC2) is true; add class \`has-allergen\` and \`data-allergen="true"\`. \`FlagBadge\` may be reused for it (restyled with the CSS below); needs-review and refresh-conflict stay off the tile. Content budget: a tile contains the number, optional 「祝」, at most one icon, at most one \`.cell__allergen\`, at most one \`.cell__dash\`; nothing else.
\`\`\`css
.cell__allergen { position: absolute; right: 3px; bottom: 3px; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; background: var(--danger-soft); color: var(--danger); border: 1.5px solid var(--danger); display: grid; place-items: center; font-size: var(--text-xs); font-weight: var(--weight-bold); line-height: 1; pointer-events: none; }
@media (min-width: 768px) { .cell__allergen { width: 20px; height: 20px; right: 4px; bottom: 4px; font-size: 13px; } }
\`\`\`
No state overrides: the mark keeps its colours on today, tomorrow, past, hover, selected (it paints above the ring). Legend sample (40 x 56): 16 px mark, 12 px glyph, \`right: 2px; bottom: 2px\`.

**CSS** (\`src/ui/styles/calendar.css\`; replaces`],
['a tile contains only the number, 「祝」 and one icon.', 'a tile contains only the number, 「祝」, one icon, and at most one allergen mark and one dash (content budget, components §18.2). New for AC16: mark present only on a school-lunch day with the alert (name gains 「アレルギーに注意」 / "allergen alert" right after the state; no mark on home, unsure, bento-day, number-only, needs-review or refresh-conflict days); present on past, today and tomorrow tiles; mark and red dash never together; `data-allergen`; the legend has the `legend.allergen` row.'],
['(8 in §24.1; 9 legend keys in §24.2:', '(9 in §24.1 incl. `cell.aria.allergen`; 10 legend keys in §24.2 incl. `legend.allergen`:'],
['`dash`, `changedEdge`,', '`dash`, `allergen`, `changedEdge`,'],
['re-run `docs/dev/_scratch/ui-refresh/shoot.mjs` and compare with `after-design/`.', 're-run `docs/dev/_scratch/ui-refresh/shoot.mjs` and compare with `after-design/`; axe with an allergen tile present in light and dark; contrast pairs T27-T31 (`tile-contrast.mjs`, 0 failures).'],
]);

// ---------- flows.md ----------
edit('design/flows.md', [
['| F21.11 | Refresh conflict or allergen warning on a planned day | the tile does not show it any more;', '| F21.11 | Refresh conflict or needs-review on a planned day | the tile does not show it;'],
['| F21.12 |', '| F21.11a | School-lunch day whose menu carries the allergen alert for the registered allergens | number + `lunchbox` + one small 「!」 mark bottom right; name 「11月19日（木）、給食、アレルギーに注意」; shown on past, today and tomorrow tiles too; the day sheet banner explains it; never together with the red dash; no other alert is on the tile | US-E5-01/AC16, US-E1-05/AC2 |\n| F21.12 |'],
['and nine rows (three icons, dash, top bar,', 'and ten rows (three icons, dash, allergen mark, top bar,'],
]);
console.log('done');
