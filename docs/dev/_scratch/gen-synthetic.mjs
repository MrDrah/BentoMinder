// One-off generator for the SYNTHETIC ranking fixtures (oracle §2, §3b). Run: node docs/dev/_scratch/gen-synthetic.mjs
// Origin tags are the pinned table of the oracle (§2), not read from the dictionary.
import { writeFileSync, mkdirSync } from 'node:fs';

const PIN = {
  'ing-egg': ['egg'], 'ing-chicken-thigh': ['chicken'], 'ing-salmon': ['fish-seafood'], 'ing-shrimp': ['fish-seafood'],
  'ing-bread': ['dairy', 'egg'], 'ing-bread-crumbs': ['dairy', 'egg'], 'ing-sausage': ['meat', 'pork'], 'ing-ham': ['meat', 'pork'],
  'ing-ground-mixed': ['beef', 'pork'], 'ing-pork': ['pork'], 'ing-cheese': ['dairy'], 'ing-gelatin': ['gelatin'],
  'ing-chikuwa': ['fish-seafood'], 'ing-dashi': ['fish-seafood'], 'ing-curry-roux': ['meat', 'pork', 'beef', 'chicken', 'dairy'],
  'ing-consomme': ['beef', 'chicken', 'pork'],
};
const UNKNOWN_ORIGIN = new Set(['ing-bread', 'ing-bread-crumbs', 'ing-dashi', 'ing-curry-roux', 'ing-consomme']);
mkdirSync('tests/fixtures/recipes', { recursive: true });
writeFileSync('tests/fixtures/recipes/diet-tags-pinned.json', JSON.stringify({ synthetic: true, animalOrigin: PIN, animalOriginUnknown: [...UNKNOWN_ORIGIN].sort() }, null, 2) + '\n');

// ingredient spec: 'id' | ['id', {a:[allergens], v:[possible], u:true, known:true}]
const R = (key, id, theme, minutes, ings) => ({ key, id, theme, minutes, ings });
const lib = [
  R('A', 'a-tamago', null, 15, [['ing-rice'], ['ing-egg', { a: ['egg'] }], ['ing-sugar'], ['ing-spinach']]),
  R('B', 'b-karaage', 'animals', 25, [['ing-rice'], ['ing-chicken-thigh', { a: ['chicken'] }], ['ing-wheat-flour', { a: ['wheat'] }], ['ing-ginger'], ['ing-soy-sauce', { v: ['wheat', 'soybean'] }]]),
  R('C', 'c-salmon', 'sea', 20, [['ing-rice'], ['ing-salmon', { a: ['salmon'] }], ['ing-broccoli'], ['ing-sesame', { a: ['sesame'] }]]),
  R('D', 'd-sausage', 'vehicles', 10, [['ing-bread', { v: ['wheat', 'milk', 'egg', 'soybean'] }], ['ing-sausage', { v: ['pork', 'milk', 'soybean'] }], ['ing-cherry-tomato'], ['ing-lettuce']]),
  R('E', 'e-veggie', 'flowers', 10, [['ing-rice'], ['ing-corn'], ['ing-carrot'], ['ing-nori'], ['ing-salt']]),
  R('F', 'f-hamburg', 'stars', 30, [['ing-ground-mixed', { a: ['beef', 'pork'] }], ['ing-onion'], ['ing-bread-crumbs', { v: ['wheat'] }], ['ing-egg', { a: ['egg'] }], ['ing-ketchup', { v: ['apple'] }]]),
  R('G', 'g-tofu', null, 20, [['ing-rice'], ['ing-tofu', { a: ['soybean'] }], ['ing-carrot'], ['ing-green-pepper'], ['ing-dashi', { v: ['soybean', 'wheat'] }]]),
  R('H', 'h-pork', null, 20, [['ing-pork', { a: ['pork'] }], ['ing-ginger'], ['ing-cabbage'], ['ing-rice'], ['ing-soy-sauce', { v: ['wheat', 'soybean'] }]]),
  R('I', 'i-shrimp', 'sea', 35, [['ing-shrimp', { a: ['shrimp'] }], ['ing-wheat-flour', { a: ['wheat'] }], ['ing-egg', { a: ['egg'] }], ['ing-bread-crumbs', { v: ['wheat', 'milk'] }], ['ing-rice']]),
  R('J', 'j-macaroni', 'rainbow', 15, [['ing-macaroni', { a: ['wheat'], v: ['egg'] }], ['ing-cheese', { a: ['milk'], v: ['milk'] }], ['ing-ham', { v: ['pork', 'milk', 'soybean'] }], ['ing-broccoli']]),
  R('K', 'k-jelly', 'seasonal', 10, [['ing-rice'], ['ing-nori'], ['ing-gelatin', { a: ['gelatin'] }], ['ing-mandarin', { a: ['orange'] }], ['ing-sugar']]),
  R('L', 'l-chikuwa', 'vehicles', 10, [['ing-chikuwa', { v: ['wheat', 'egg'] }], ['ing-cucumber'], ['ing-rice'], ['ing-nori']]),
  R('M', 'm-corn-curry', 'animals', 15, [['ing-rice'], ['ing-corn'], ['ing-potato'], ['ing-curry-roux', { u: true }]]),
];
const diet = [
  R('n1', 'n1-dashi', null, 10, [['ing-rice'], ['ing-tofu', { a: ['soybean'] }], ['ing-spinach'], ['ing-dashi', { v: ['soybean', 'wheat'] }]]),
  R('n2', 'n2-katsuodashi', null, 10, [['ing-rice'], ['ing-tofu', { a: ['soybean'] }], ['ing-spinach'], ['ing-dashi', { v: ['soybean', 'wheat'], known: true }]]),
  R('n3', 'n3-consomme', null, 15, [['ing-rice'], ['ing-cabbage'], ['ing-carrot'], ['ing-consomme', { v: ['wheat'], known: true }]]),
  R('n4', 'n4-curry', null, 15, [['ing-rice'], ['ing-potato'], ['ing-carrot'], ['ing-curry-roux', { v: ['wheat', 'milk'] }]]),
  R('n5', 'n5-wiener', null, 10, [['ing-rice'], ['ing-sausage', { v: ['pork', 'milk', 'soybean'] }], ['ing-broccoli']]),
  R('n6', 'n6-kombu', null, 15, [['ing-rice'], ['ing-kombu'], ['ing-carrot']]),
  R('n7', 'n7-plain', null, 10, [['ing-rice'], ['ing-corn'], ['ing-nori']]),
];

const uniq = (xs) => [...new Set(xs)];
const alg = (xs) => xs.map((x) => `alg-${x}`);
function build(s) {
  const ingredients = s.ings.map(([id, o = {}]) => {
    const varies = o.v !== undefined || o.u === true ? true : false;
    return {
      ingredientId: id,
      label: { ja: `${id}（テスト）`, en: id },
      quantity: null,
      unit: 'to-taste',
      optional: false,
      allergenInfo: o.u ? 'unknown' : o.v !== undefined ? 'varies-by-product' : 'known',
      allergenIds: alg(o.a ?? []),
      possibleAllergenIds: alg(o.v ?? []),
      animalOrigin: PIN[id] ?? [],
      animalOriginKnown: o.known === true || !UNKNOWN_ORIGIN.has(id),
    };
  });
  const forbid = {
    vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'], pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
    'no-pork': ['pork', 'meat', 'gelatin'], 'no-beef': ['beef', 'meat'], 'no-seafood': ['fish-seafood'],
  };
  const animalOrigin = uniq(ingredients.flatMap((i) => i.animalOrigin));
  const dietDataComplete = ingredients.every((i) => i.animalOriginKnown);
  return {
    synthetic: true,
    id: `rcp-syn-${s.id}`,
    name: { ja: `テスト用 ${s.key}`, en: `Synthetic ${s.key}` },
    shortNameJa: `テスト${s.key}`.slice(0, 8),
    shortNameEn: `Syn ${s.key}`,
    nameKana: 'てすと',
    style: 'other',
    themeId: s.theme === null ? null : `theme-${s.theme}`,
    description: { ja: 'ランキングの試験にだけ使う架空のレシピです。実在のレシピではありません。', en: 'Made-up recipe used only to test ranking.' },
    yield: { ja: '1人分', en: '1 serving' },
    minutes: s.minutes,
    makeAhead: null,
    ingredients,
    steps: [{ ja: 'テスト', en: 'test' }, { ja: 'テスト', en: 'test' }],
    storage: [{ ja: 'テスト', en: 'test' }],
    allergenIds: uniq(ingredients.flatMap((i) => i.allergenIds)),
    mayContainAllergenIds: uniq(ingredients.filter((i) => i.allergenInfo === 'varies-by-product').flatMap((i) => i.possibleAllergenIds)),
    allergenDataComplete: !ingredients.some((i) => i.allergenInfo === 'unknown'),
    allergenScheme: 'caa-2026-04',
    animalOrigin,
    dietDataComplete,
    dietOk: dietDataComplete ? Object.keys(forbid).filter((d) => !forbid[d].some((t) => animalOrigin.includes(t))) : [],
    adaptations: [],
    sources: [],
    reviewedBy: 'ba-research',
  };
}
writeFileSync('tests/fixtures/recipes/synthetic-library.json', JSON.stringify(lib.map(build), null, 2) + '\n');
writeFileSync('tests/fixtures/recipes/synthetic-library-diet.json', JSON.stringify(diet.map(build), null, 2) + '\n');
console.log('ok');
