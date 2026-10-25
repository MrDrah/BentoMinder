// usage: node build.mjs  -> rebuilds data/_research/batch-b.json from recs/*.mjs (sorted by file name)
// Derives per-ingredient allergen/animal-origin fields from data/dictionary.json plus explicit overrides,
// and the recipe-level unions / derived flags. Checks schema + library rules on the batch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const dict = JSON.parse(fs.readFileSync(path.join(root, 'data/dictionary.json'), 'utf8'));
const ingById = new Map(dict.ingredients.map((i) => [i.id, i]));
const FORBID = { vegetarian: ['meat','pork','beef','chicken','fish-seafood','gelatin'], pescatarian: ['meat','pork','beef','chicken','gelatin'], 'no-pork': ['pork','meat','gelatin'], 'no-beef': ['beef','meat'], 'no-seafood': ['fish-seafood'] };
const uniq = (a) => [...new Set(a)];
function ing([id, ja, en, quantity, unit, o = {}]) {
  const d = ingById.get(id);
  if (!d) throw new Error('unknown ingredient ' + id);
  let info = o.info ?? (d.info === 'known' ? 'known' : null);
  if (!info) throw new Error(`${id} is 'varies' in the dictionary: set info`);
  const possible = info === 'varies-by-product' ? o.possible ?? [] : [];
  if (info === 'varies-by-product' && !possible.length) throw new Error(id + ' needs possible');
  return {
    ingredientId: id, label: { ja, en }, quantity, unit, optional: !!o.optional,
    allergenInfo: info,
    allergenIds: uniq([...d.inherentAllergenIds, ...(o.allergens ?? [])]),
    possibleAllergenIds: possible,
    animalOrigin: uniq([...d.animalOrigin, ...(o.origin ?? [])]),
    animalOriginKnown: d.animalOriginKnown ? true : !!o.originKnown,
  };
}
export function recipe(r) {
  const ingredients = r.ingredients.map(ing);
  const animalOrigin = uniq(ingredients.flatMap((i) => i.animalOrigin));
  const dietDataComplete = ingredients.every((i) => i.animalOriginKnown);
  const out = {
    id: r.id, name: r.name, shortNameJa: r.shortNameJa, shortNameEn: r.shortNameEn, nameKana: r.nameKana,
    style: r.style, themeId: r.themeId ?? null, description: r.description, yield: r.yield ?? { ja: '幼児1人分', en: '1 child portion' },
    minutes: r.minutes, makeAhead: r.makeAhead ?? null, ingredients, steps: r.steps, storage: r.storage,
    allergenIds: uniq(ingredients.flatMap((i) => i.allergenIds)),
    mayContainAllergenIds: uniq(ingredients.filter((i) => i.allergenInfo === 'varies-by-product').flatMap((i) => i.possibleAllergenIds)),
    allergenDataComplete: !ingredients.some((i) => i.allergenInfo === 'unknown'),
    allergenScheme: 'caa-2026-04',
    animalOrigin, dietDataComplete,
    dietOk: dietDataComplete ? Object.keys(FORBID).filter((d) => !FORBID[d].some((t) => animalOrigin.includes(t))) : [],
    adaptations: r.adaptations, sources: r.sources, reviewedBy: 'ba-research',
  };
  return out;
}
const files = fs.readdirSync(path.join(here, 'recs')).filter((f) => f.endsWith('.mjs')).sort();
const recs = [];
for (const f of files) recs.push(recipe((await import(pathToFileURL(path.join(here, 'recs', f)).href)).default));
fs.writeFileSync(path.join(root, 'data/_research/batch-b.json'), JSON.stringify(recs, null, 2) + '\n');
console.log('wrote', recs.length, 'records:', recs.map((r) => r.id).join(', '));
const { recipeSchema, recipeLibraryIssues } = await import(pathToFileURL(path.join(root, 'src/domain/schema/index.ts')).href);
const { APPROVED_HOSTS } = { APPROVED_HOSTS: ['maff.go.jp','pref.kyoto.jp','city.sendai.jp','caa.go.jp','cfa.go.jp','mhlw.go.jp','kyounoryouri.jp','sirogohan.com','orangepage.net','lettuceclub.net','ajinomoto.co.jp','kikkoman.co.jp','housefoods.jp','mizkan.co.jp','kurashiru.com','delishkitchen.tv','justonecookbook.com','bbcgoodfood.com'] };
let bad = 0;
for (const r of recs) {
  const p = recipeSchema.safeParse(r);
  if (!p.success) { bad++; console.log('SCHEMA', r.id, JSON.stringify(p.error.issues.map((i) => [i.path.join('.'), i.message]))); }
}
for (const i of recipeLibraryIssues(recs, dict, APPROVED_HOSTS)) { bad++; console.log('LIB', i.recipeId, i.rule, i.path); }
for (const r of recs) console.log(r.id, '| min', r.minutes, '| alg', r.allergenIds.join(','), '| may', r.mayContainAllergenIds.join(','), '| algComplete', r.allergenDataComplete, '| origin', r.animalOrigin.join(','), '| dietComplete', r.dietDataComplete, '| dietOk', r.dietOk.join(','));
console.log(bad ? `${bad} problems` : 'schema + library rules OK');
