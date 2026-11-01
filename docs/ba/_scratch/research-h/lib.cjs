const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../../..');
const dict = JSON.parse(fs.readFileSync(path.join(root, 'data/dictionary.json'), 'utf8'));
const byId = new Map(dict.ingredients.map((i) => [i.id, i]));
const FORBID = {
  vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'],
  pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
  'no-pork': ['pork', 'meat', 'gelatin'],
  'no-beef': ['beef', 'meat'],
  'no-seafood': ['fish-seafood'],
};
const uniq = (a) => [...new Set(a)];
const ACC = '2026-11-01';

// Existing label sources (copied exactly from batches a/b) + new ones.
const prior = {};
for (const f of ['batch-a.json','batch-b.json','batch-c.json','batch-d.json','batch-e.json']) {
  for (const r of JSON.parse(fs.readFileSync(path.join(root, 'data/_research', f), 'utf8'))) for (const s of r.sources) prior[s.id] = s;
}
const PRIOR = (id, usedFor) => {
  if (!prior[id]) throw new Error('no prior source ' + id);
  return { ...prior[id], usedFor };
};
const kk = (id, title, url, usedFor = ['allergen']) => ({ id, publisher: 'キッコーマン株式会社', title, url, accessed: ACC, language: 'ja', usedFor });
const SRC = {
  maff: () => ({ id: 'src-maff-lunchbox', publisher: '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', title: 'お弁当づくりによる食中毒を予防するために：農林水産省', url: 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html', accessed: ACC, language: 'ja', usedFor: ['storage'] }),
  delish: (id, title, url, usedFor = ['recipe', 'storage']) => ({ id, publisher: 'デリッシュキッチン (every, Inc.)', title, url, accessed: ACC, language: 'ja', usedFor }),
  nhk: (id, title, url, usedFor = ['recipe']) => ({ id, publisher: 'NHKエデュケーショナル（みんなのきょうの料理）', title, url, accessed: ACC, language: 'ja', usedFor }),
  kkRecipe: (id, title, url, usedFor = ['recipe', 'storage']) => kk(id, title, url, usedFor),
  hontsuyu: () => kk('src-kikkoman-koidashi-hontsuyu-label', 'キッコーマン 濃いだし 本つゆ | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K15/detail/K150504.html'),
  uster: () => kk('src-kikkoman-delicious-uster-label', 'キッコーマン デリシャスソース ウスター | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K45/detail/K450505.html'),
  chunou: () => kk('src-kikkoman-delicious-chunou-label', 'キッコーマン デリシャスソース 中濃 | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K45/detail/K450510.html'),
  tonkatsu: () => kk('src-kikkoman-delicious-tonkatsu-label', 'キッコーマン デリシャスソース とんかつ | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K45/detail/K450515.html'),
  oyster: () => kk('src-kikkoman-oyster-sauce-label', 'キッコーマン オイスターソース | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K40/detail/K400505.html'),
  hondashi: () => ({ id: 'src-ajinomoto-hondashi-label', publisher: '味の素株式会社', title: 'ほんだし®｜商品｜味の素株式会社', url: 'https://www.ajinomoto.co.jp/products/detail/?ProductName=hondashi', accessed: ACC, language: 'ja', usedFor: ['allergen'] }),
  marudori: () => ({ id: 'src-ajinomoto-marudorigara-label', publisher: '味の素株式会社', title: '丸鶏がらスープ™｜商品｜味の素株式会社', url: 'https://www.ajinomoto.co.jp/products/detail/?ProductName=marudorigara_1', accessed: ACC, language: 'ja', usedFor: ['allergen'] }),
  shoyu: () => PRIOR('src-kikkoman-tokusen-marudaizu-label', ['allergen']),
  ketchup: () => PRIOR('src-kikkoman-delmonte-ketchup-label', ['allergen']),
  miso: () => PRIOR('src-marukome-ryotei-nama-miso-label', ['allergen']),
  mayo: () => PRIOR('src-ajinomoto-pureselect-mayo-label', ['allergen']),
  currypowder: () => PRIOR('src-house-curry-powder-label', ['allergen']),
  vinegar: () => PRIOR('src-mizkan-kokumotsu-su', ['allergen']),
};

/**
 * I(id, ja, en, quantity, unit, opts)
 * opts.lab = { src, poss:[alg…], extraTags:[…] } -> varies-by-product with the cited label
 * opts.unknown = true -> allergenInfo 'unknown' (no label found)
 * opts.optional, opts.tags (extra animal-origin tags), opts.known (animalOriginKnown true because the cited source states the product)
 */
function I(id, ja, en, quantity, unit, o = {}) {
  const d = byId.get(id);
  if (!d) throw new Error('unknown ingredient ' + id);
  let allergenInfo = 'known';
  let possible = [];
  if (o.lab) {
    allergenInfo = 'varies-by-product';
    possible = o.lab.poss;
  } else if (d.info === 'varies') {
    allergenInfo = 'unknown';
  }
  const animalOrigin = uniq([...d.animalOrigin, ...(o.tags || [])]);
  const animalOriginKnown = d.animalOriginKnown || o.known === true;
  return {
    ingredientId: id,
    label: { ja, en },
    quantity,
    unit,
    optional: !!o.optional,
    allergenInfo,
    allergenIds: uniq([...d.inherentAllergenIds, ...(o.allergens || [])]),
    possibleAllergenIds: possible,
    animalOrigin,
    animalOriginKnown,
  };
}

function finish(spec) {
  const ings = spec.ingredients;
  const r = {
    id: spec.id,
    name: spec.name,
    shortNameJa: spec.shortNameJa,
    shortNameEn: spec.shortNameEn,
    nameKana: spec.nameKana,
    style: spec.style,
    themeId: spec.themeId ?? null,
    description: spec.description,
    yield: spec.yield,
    minutes: spec.minutes,
    makeAhead: spec.makeAhead ?? null,
    ingredients: ings,
    steps: spec.steps,
    storage: spec.storage,
    allergenIds: uniq(ings.flatMap((i) => i.allergenIds)),
    mayContainAllergenIds: uniq(ings.filter((i) => i.allergenInfo === 'varies-by-product').flatMap((i) => i.possibleAllergenIds)),
    allergenDataComplete: !ings.some((i) => i.allergenInfo === 'unknown'),
    allergenScheme: 'caa-2026-04',
    animalOrigin: uniq(ings.flatMap((i) => i.animalOrigin)),
    dietDataComplete: ings.every((i) => i.animalOriginKnown),
    dietOk: [],
    adaptations: spec.adaptations,
    sources: spec.sources,
    reviewedBy: 'ba-research',
  };
  r.dietOk = r.dietDataComplete ? Object.keys(FORBID).filter((d) => !FORBID[d].some((t) => r.animalOrigin.includes(t))) : [];
  return r;
}
const T = (ja, en) => ({ ja, en });
SRC.salmonflakes = () => PRIOR("src-nissui-yakisake-arahogushi-label", ["allergen"]);
SRC.ham = () => PRIOR("src-nipponham-irodori-roast-ham-label", ["allergen"]);
SRC.sausage = () => PRIOR("src-nipponham-schauessen-label", ["allergen"]);
SRC.cheese6p = () => PRIOR("src-meg-snow-6p-cheese-label", ["allergen"]);
SRC.konacheese = () => PRIOR("src-meg-snow-konacheese-label", ["allergen"]);
SRC.slicecheese = () => PRIOR("src-meg-snow-torokeru-slice-label", ["allergen"]);
SRC.tuna = () => PRIOR("src-hagoromo-seachicken-l-flake-label", ["allergen"]);
SRC.consomme = () => PRIOR("src-ajinomoto-consomme-granule-label", ["allergen"]);
SRC.yakiniku = () => PRIOR("src-kikkoman-cho-yakiniku-label", ["allergen"]);
SRC.sushisu = () => ({ id: "src-mizkan-sushisu-label", publisher: "株式会社Mizkan（ミツカングループ）", title: "すし酢 | 商品情報 | ミツカングループ", url: "https://www.mizkan.co.jp/product/group/?gid=02001", accessed: ACC, language: "ja", usedFor: ["allergen"] });
module.exports = { I, finish, SRC, T, ACC, root, PRIOR };
