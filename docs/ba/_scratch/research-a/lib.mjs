// Helper for research agent A: builds a Recipe from a compact spec, derives allergen/animal
// fields from the dictionary, checks it with the project's schema + library rules, saves it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { recipeSchema, recipeLibraryIssues } from '../../../../src/domain/schema/index.ts';

const root = 'C:/Projects/BentoMinder';
const APPROVED_HOSTS = ['maff.go.jp', 'pref.kyoto.jp', 'city.sendai.jp', 'caa.go.jp', 'cfa.go.jp', 'mhlw.go.jp',
  'kyounoryouri.jp', 'sirogohan.com', 'orangepage.net', 'lettuceclub.net', 'ajinomoto.co.jp', 'kikkoman.co.jp',
  'housefoods.jp', 'mizkan.co.jp', 'kurashiru.com', 'delishkitchen.tv', 'justonecookbook.com', 'bbcgoodfood.com'];
const dict = JSON.parse(readFileSync(join(root, 'data/dictionary.json'), 'utf8'));
const ING = new Map(dict.ingredients.map((x) => [x.id, x]));
const DIETS = {
  vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'],
  pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
  'no-pork': ['pork', 'meat', 'gelatin'],
  'no-beef': ['beef', 'meat'],
  'no-seafood': ['fish-seafood'],
};
const uniq = (a) => [...new Set(a)];

// i(id, ja, en, quantity, unit, { info: 'known'|'varies'|'unknown', possible: [], optional, origin: [] })
export function i(id, ja, en, quantity, unit, o = {}) {
  const d = ING.get(id);
  if (!d) throw new Error('unknown ingredient ' + id);
  const info = o.info ?? 'known';
  return {
    ingredientId: id,
    label: { ja, en },
    quantity,
    unit,
    optional: !!o.optional,
    allergenInfo: info === 'varies' ? 'varies-by-product' : info,
    allergenIds: uniq([...d.inherentAllergenIds, ...(o.allergens ?? [])]),
    possibleAllergenIds: info === 'varies' ? o.possible : [],
    animalOrigin: uniq([...d.animalOrigin, ...(o.origin ?? [])]),
    animalOriginKnown: o.originKnown ?? d.animalOriginKnown,
  };
}

export function build(r) {
  const ings = r.ingredients;
  const animalOrigin = uniq(ings.flatMap((x) => x.animalOrigin));
  const dietDataComplete = ings.every((x) => x.animalOriginKnown);
  return {
    id: r.id,
    name: r.name,
    shortNameJa: r.shortNameJa,
    shortNameEn: r.shortNameEn,
    nameKana: r.nameKana,
    style: r.style,
    themeId: r.themeId ?? null,
    description: r.description,
    yield: r.yield ?? { ja: '幼児1人分', en: '1 child portion' },
    minutes: r.minutes,
    makeAhead: r.makeAhead ?? null,
    ingredients: ings,
    steps: r.steps,
    storage: r.storage,
    allergenIds: uniq(ings.flatMap((x) => x.allergenIds)),
    mayContainAllergenIds: uniq(ings.filter((x) => x.allergenInfo === 'varies-by-product').flatMap((x) => x.possibleAllergenIds)),
    allergenDataComplete: !ings.some((x) => x.allergenInfo === 'unknown'),
    allergenScheme: 'caa-2026-04',
    animalOrigin,
    dietDataComplete,
    dietOk: dietDataComplete ? Object.keys(DIETS).filter((d) => !DIETS[d].some((t) => animalOrigin.includes(t))) : [],
    adaptations: r.adaptations ?? [],
    sources: r.sources,
    reviewedBy: 'ba-research',
  };
}

const cp = (s) => [...s.normalize('NFC')].length;

export function split(s) {
  const segs = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(s)].map((x) => x.segment);
  const n = cp(s);
  const problems = [];
  if (n <= 4) return { lines: [s], segs, problems };
  let best = null;
  let pos = 0;
  for (let k = 0; k < segs.length - 1; k++) {
    pos += cp(segs[k]);
    if (pos <= 4 && n - pos <= 4 && (best === null || Math.abs(pos - n / 2) < Math.abs(best - n / 2))) best = pos;
  }
  if (best === null) {
    problems.push(`short-name split: no phrase boundary in ${s} (${segs.join('|')})`);
    best = 4;
  }
  const a = [...s];
  return { lines: [a.slice(0, best).join(''), a.slice(best).join('')], segs, problems };
}

export function check(rec) {
  const problems = [];
  const p = recipeSchema.safeParse(rec);
  if (!p.success) problems.push(...p.error.issues.map((x) => `${x.message} @ ${x.path.join('.')}`));
  for (const x of recipeLibraryIssues([rec], dict, APPROVED_HOSTS)) problems.push(`${x.rule} @ ${x.path}`);
  if (cp(rec.description.ja) < 20 || cp(rec.description.ja) > 120) problems.push('description length ' + cp(rec.description.ja));
  for (const s of rec.steps) if (cp(s.ja) > 120) problems.push('step too long ' + cp(s.ja));
  const walk = (o, path) => {
    if (o && typeof o === 'object') {
      if ('ja' in o && !('en' in o)) problems.push('missing en @ ' + path);
      for (const [k, v] of Object.entries(o)) walk(v, path + '.' + k);
    }
  };
  walk(rec, 'r');
  problems.push(...split(rec.shortNameJa).problems);
  if (cp(rec.shortNameEn) > 8) problems.push('shortNameEn too long');
  return problems;
}

export function save(rec) {
  const file = join(root, 'data/_research/batch-a.json');
  const arr = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const k = arr.findIndex((x) => x.id === rec.id);
  if (k >= 0) arr[k] = rec;
  else arr.push(rec);
  writeFileSync(file, JSON.stringify(arr, null, 2) + '\n');
  return arr.length;
}

export function run(r) {
  const rec = build(r);
  const problems = check(rec);
  const sp = split(rec.shortNameJa);
  console.log(`${rec.id}: short ${sp.lines.join(' / ')} (${sp.segs.join('|')}); allergens ${rec.allergenIds.join(',')}; may ${rec.mayContainAllergenIds.join(',')}; complete ${rec.allergenDataComplete}; origin ${rec.animalOrigin.join(',')}; diets ${rec.dietOk.join(',')}`);
  if (problems.length) {
    console.log('PROBLEMS:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
    return;
  }
  writeFileSync(join(root, 'docs/ba/_scratch/research-a/rec', rec.id + '.json'), JSON.stringify(rec, null, 2) + '\n');
  if (process.env.SAVE === '1') console.log('saved; batch-a now has ' + save(rec) + ' record(s)');
  else console.log('draft written to rec/' + rec.id + '.json (SAVE=1 to add to batch-a)');
}

// Shared sources (fetched 2026-10-25; HTML in pages/).
export const S = {
  soy: { id: 'src-kikkoman-tokusen-marudaizu-label', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'キッコーマン 特選 丸大豆しょうゆ', url: 'https://www.kikkoman.co.jp/products/K05/detail/K051005.html', accessed: '2026-10-25', language: 'ja', usedFor: ['allergen'] },
  ketchup: { id: 'src-kikkoman-delmonte-ketchup-label', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'デルモンテ トマトケチャップ', url: 'https://www.kikkoman.co.jp/products/K45/detail/K451000.html', accessed: '2026-10-25', language: 'ja', usedFor: ['allergen'] },
  mayo: { id: 'src-ajinomoto-pureselect-mayo-label', publisher: '味の素株式会社（味の素パーク）', title: '【味の素KK】「ピュアセレクト」｜新鮮キープボトル', url: 'https://www.ajinomoto.co.jp/pureselect/products/shinsenkeep/', accessed: '2026-10-25', language: 'ja', usedFor: ['allergen'] },
  curry: { id: 'src-house-curry-powder-label', publisher: 'ハウス食品株式会社', title: 'カレーパウダー | 商品カタログトップ | ハウス食品', url: 'https://housefoods.jp/products/catalog/cd_1,090700,spice,curpd,house.html', accessed: '2026-10-25', language: 'ja', usedFor: ['allergen'] },
  maff: { id: 'src-maff-lunchbox', publisher: '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', title: 'お弁当づくりによる食中毒を予防するために：農林水産省', url: 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html', accessed: '2026-10-25', language: 'ja', usedFor: ['storage'] },
  kikkomanPortion: null,
};

export const SOY = (ja, en, q, unit) => i('ing-soy-sauce', ja, en, q, unit, { info: 'varies', possible: ['alg-wheat', 'alg-soybean'] });
