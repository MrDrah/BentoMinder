const fs=require('fs');const p='docs/ba/data-contract.md';let s=fs.readFileSync(p,'utf8');
function rep(a,b){if(!s.includes(a)){console.error('MISSING:',a.slice(0,80));process.exit(1)}s=s.replace(a,b);}
rep('`school-lunch-planned` and `not-confirmed` are never stored for a no-lunch date (US-E5-08/AC3).','no parent action writes `school-lunch-planned` or `not-confirmed` for a no-lunch date (US-E5-08/AC3); a stored decision that a later menu refresh puts on a no-lunch date is kept and flagged (BR-13).');
rep('| `nameKana` | string | ✔ | hiragana reading for sorting | `くまさんおにぎりべんとう` |',
'| `shortNameJa` | string | ✔ | 1–8 characters (Unicode code points, after NFC and trim), shown in calendar cells (US-E5-01/AC4); a curated short form written by the BA, not a mechanical cut of `name.ja`; no spaces at either end; unique across the library (`recipe-short-name`, `recipe-short-name-unique`) | `くまおにぎり` |\n| `shortNameEn` | string | ✔ | 1–8 characters, same rules, shown in cells when the language is en | `Bear rice` |\n| `nameKana` | string | ✔ | hiragana reading for sorting | `くまさんおにぎりべんとう` |');
rep('| `mayContainAllergenIds` | string[] | ✔ | union of `ingredients[].possibleAllergenIds` of varies-by-product ingredients | `["alg-egg","alg-milk"]` |',
'| `mayContainAllergenIds` | string[] | ✔ | union of `ingredients[].possibleAllergenIds` of varies-by-product ingredients (`recipe-may-contain-union`) | `["alg-egg","alg-milk"]` |\n| `allergenDataComplete` | boolean | ✔ | `false` iff any ingredient has `allergenInfo = "unknown"`; derived and checked by the validator (`recipe-allergen-complete-derived`). Drives the R-3 rule in §4 `ranking-incomplete-allergen` | `true` |');
{const L=s.split('\n');const i=L.findIndex(l=>l.startsWith('| `allergenInfo` | enum'));if(i<0){console.error('MISSING allergenInfo');process.exit(1)}const before=L[i];L[i]=L[i].replace(/\) \| `known` \|$/,'; typical label allergens cited in `possibleAllergenIds`) \\| `unknown` (processed food whose label allergens no cited source establishes) | `known` |');if(L[i]===before){console.error('NOCHANGE allergenInfo');process.exit(1)}s=L.join('\n');}
rep('| `possibleAllergenIds` | string[] | ✔ | non-empty iff `varies-by-product`; from the source or typical product labels, cited | `["alg-pork","alg-milk","alg-soybean"]` |',
'| `possibleAllergenIds` | string[] | ✔ | non-empty iff `varies-by-product`; empty for `known` and `unknown`; from the source or typical product labels, cited (`recipe-possible-allergens`) | `["alg-pork","alg-milk","alg-soybean"]` |');
rep('Gelatin is excluded for vegetarian, pescatarian and no-pork because its animal origin is not stated on most products (flag for PO in OQ-11).',
'Gelatin is excluded for vegetarian, pescatarian and no-pork because its animal origin is not stated on most products (OQ-11, decided 2026-10-24). A diet filter also applies to ingredients with `allergenInfo = "unknown"` through their category (an unknown processed meat product is still `cat-meat-processed`).');
rep('| `settings.nextMonthPromptFromDay` | integer | ✔ | 1–28 (US-E3-06/AC2) | `20` |',
'| `settings.nextMonthPromptFromDay` | integer | ✔ | 1–28 (US-E3-06/AC2, OQ-15) | `20` |\n| `settings.weekStartsOn` | enum | ✔ | `monday` \| `sunday`; display only, never changes dates, reminders or assessments (US-E5-01/AC2, AC8; PO 2026-10-24) | `monday` |\n| `settings.theme` | enum | ✔ | `auto` \| `light` \| `dark` (US-E8-05) | `auto` |');
rep('| `export-roundtrip` |',
'| `ranking-hard-filter` | A recipe is excluded from suggestions, 「ほかのレシピ」 and planning if any `allergenIds` or `mayContainAllergenIds` id is in `knownAllergenIds`, any ingredient (or dictionary parent/category) is in `excludedIngredientIds`, or it violates a selected diet (§3.8) (BR-06, OQ-13). |\n| `ranking-incomplete-allergen` | A recipe with `allergenDataComplete = false` is excluded like the above when `knownAllergenIds` is non-empty; otherwise it stays, flagged, ordered after every recipe with complete data (R-3, US-E6-02/AC5–AC6). |\n| `ai-call-budget` | One import action makes at most 2 provider calls: call 1 primary model; call 2 either one repair retry on the primary (malformed output) or one call to the fallback model (rate limit, 5xx, timeout), never both; 0 calls when `source.sha256` already has an extraction (BR-10, R-1). |\n| `export-roundtrip` |');
rep('## 7. v1: ownership and persistence','## 7. v1: ownership and persistence\nRecord metadata (`ownerId`, `createdAt`, `updatedAt`, §2) exists from v1 of the contract so that sync needs no migration of meaning; tombstones (`deletedAt`) and `updatedBy` are added with the v1 sync contract, not in the MVP.\n');
s=s.trimEnd()+`

## 8. H1 changes (2026-10-24)
| Change | Why |
|--------|-----|
| Status final; this contract named the source of all entity, field and state names | R-2 |
| \`§2 Record metadata\` (\`ownerId\`, \`createdAt\`, \`updatedAt\`) and root \`deviceId\` | PLAN §1 identity seam, ADR 003 |
| \`DayDecision\`: retired ADR 004 state names listed; rule \`decision-bento-day-remove\` | R-2; US-E5-08/AC3 |
| \`Recipe.shortNameJa\` / \`shortNameEn\` (1–8 chars, curated, unique), rules \`recipe-short-name\`, \`recipe-short-name-unique\` | Designer gap (direction.md §11 item 5) |
| \`RecipeIngredient.allergenInfo\` gains \`unknown\`; \`Recipe.allergenDataComplete\` (derived) | R-3 |
| \`settings.weekStartsOn\` (default \`monday\`), \`settings.theme\` (default \`auto\`) | PO 2026-10-24; Designer gap |
| \`consent.aiNoticeVersion\` 1 defined as the facts in US-E2-08/AC4; \`aiUsage\` and \`source.model\` follow the 2-call budget | PO 2026-10-24 (free tier, Japan); R-1 |
| §4 rules \`ranking-hard-filter\`, \`ranking-incomplete-allergen\`, \`ai-call-budget\` | BR-06, BR-10, R-1, R-3 |
| §3.8 gelatin note: OQ-11 decided | PO 2026-10-24 |
`;
fs.writeFileSync(p,s+'\n');console.log('ok');
