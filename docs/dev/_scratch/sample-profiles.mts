import { readFileSync } from 'node:fs';
import { createRanker } from '../../../src/domain/recommend/rank.ts';
const dict = JSON.parse(readFileSync('data/dictionary.json', 'utf8'));
const lib = JSON.parse(readFileSync('data/library.json', 'utf8'));
const rank = createRanker(dict, lib);
const b = { likedIds: [], dislikedIds: [], knownAllergenIds: [], excludedIngredientIds: [], diet: [], themeIds: [] };
const ps: Record<string, any> = {
  none: b,
  'milk+egg+wheat': { ...b, knownAllergenIds: ['alg-milk', 'alg-egg', 'alg-wheat'] },
  'vegetarian+sesame': { ...b, diet: ['vegetarian'], knownAllergenIds: ['alg-sesame'] },
};
for (const [n, p] of Object.entries(ps)) {
  const r = rank({ profile: p, decisions: [], targetDate: '2026-11-18' as any });
  console.log(n, 'survive', r.all.length, 'incomplete', r.all.filter((x) => !x.complete).length);
}
