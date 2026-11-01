// QA coverage report generator (not a test): how many of the library's recipes survive each single allergen and realistic pairs.
// Uses the QA oracle only. Run: node tests/oracle/impl/coverage-m5.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRDict, RankOracle, type RProfile, type RRecipe } from './ranking.ts';

const root = process.cwd();
const dict = JSON.parse(readFileSync(join(root, 'data', 'dictionary.json'), 'utf8')) as { allergens: { id: string; ja: string; retired?: boolean }[] };
const lib = JSON.parse(readFileSync(join(root, 'data', 'library.json'), 'utf8')) as RRecipe[];
const o = new RankOracle(loadRDict(), lib);
const base: RProfile = { likedIds: [], dislikedIds: [], knownAllergenIds: [], excludedIngredientIds: [], diet: [], themeIds: [] };
const surv = (known: string[]) => o.run({ ...base, knownAllergenIds: known }, [], '2026-11-18').order.length;
const rows: string[] = [];
rows.push(`Library recipes: ${lib.length}. Survivors = recipes shown (suggestable and listed in ほかのレシピ) for a child with only that allergen, from the QA oracle.`, '', '| allergen id | ja | survivors | flag |', '|---|---|---|---|');
const thin: string[] = [];
const single: { id: string; n: number }[] = [];
for (const a of dict.allergens) {
  const n = surv([a.id]);
  single.push({ id: a.id, n });
  const flag = n < 8 ? 'THIN (< 8)' : '';
  if (n < 8) thin.push(`${a.id} (${n})`);
  rows.push(`| ${a.id}${a.retired ? ' (retired)' : ''} | ${a.ja} | ${n} | ${flag} |`);
}
const pairs: [string, string][] = [
  ['alg-egg', 'alg-milk'], ['alg-egg', 'alg-wheat'], ['alg-milk', 'alg-wheat'], ['alg-peanut', 'alg-walnut'], ['alg-shrimp', 'alg-crab'],
  ['alg-egg', 'alg-soybean'], ['alg-wheat', 'alg-soybean'], ['alg-salmon', 'alg-mackerel'], ['alg-peanut', 'alg-egg'], ['alg-sesame', 'alg-wheat'],
];
rows.push('', '10 realistic pairs (plus one triple)', '', '| pair | survivors | flag |', '|---|---|---|');
for (const [a, b] of pairs) {
  const ids = [a, b];

  const n = surv(ids);
  rows.push(`| ${ids.join(' + ')} | ${n} | ${n < 8 ? 'THIN (< 8)' : ''} |`);
}
writeFileSync(join(root, 'tests', 'reports', 'm5-processed-coverage-table.md'), rows.join('\n') + '\n');
console.log(`thin: ${thin.join(', ')}`);
console.log(rows.join('\n'));
console.log(`triple egg+milk+wheat: ${surv(['alg-egg', 'alg-milk', 'alg-wheat'])}; egg+milk+wheat+soybean: ${surv(['alg-egg', 'alg-milk', 'alg-wheat', 'alg-soybean'])}`);
