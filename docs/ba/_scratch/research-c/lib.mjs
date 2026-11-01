import fs from 'node:fs';
import { createRequire } from 'node:module';
import { derivedDietOk } from '../../../../src/domain/schema/recipe.ts';
const require = createRequire(import.meta.url);
const dict = require('../../../../data/dictionary.json');
const D = Object.fromEntries(dict.ingredients.map((i) => [i.id, i]));
const ACC = '2026-11-01';

// processed-food presets: label-derived allergen data (cited source id in `src`)
export const P = {
  soy: { info: 'varies-by-product', poss: ['alg-wheat', 'alg-soybean'], src: 'src-kikkoman-tokusen-marudaizu-label' },
  ketchup: { info: 'varies-by-product', poss: [], src: 'src-kikkoman-delmonte-ketchup-label' },
  currypowder: { info: 'varies-by-product', poss: [], src: 'src-house-curry-powder-label' },
  ham: { info: 'varies-by-product', poss: ['alg-egg', 'alg-milk', 'alg-soybean', 'alg-pork'], src: 'src-nipponham-irodori-roast-ham-label' },
  sausage: { info: 'varies-by-product', poss: ['alg-pork'], src: 'src-nipponham-schauessen-label' },
  mayo: { info: 'varies-by-product', poss: ['alg-egg', 'alg-soybean'], src: 'src-ajinomoto-pureselect-mayo-label' },
  vinegar: { info: 'varies-by-product', poss: ['alg-wheat'], src: 'src-mizkan-kokumotsu-su' },
  slicecheese: { info: 'varies-by-product', poss: [], src: 'src-meg-snow-torokeru-slice-label' },
  grated: { info: 'varies-by-product', poss: [], src: 'src-meg-snow-konacheese-label' },
  consomme: { info: 'varies-by-product', poss: ['alg-milk', 'alg-wheat', 'alg-beef', 'alg-soybean', 'alg-chicken'], src: 'src-ajinomoto-consomme-granule-label' },
  hondashi: { info: 'varies-by-product', poss: ['alg-milk'], tags: ['dairy'], known: true, src: 'src-ajinomoto-hondashi-label' },
  yakiniku: { info: 'varies-by-product', poss: ['alg-wheat', 'alg-soybean', 'alg-apple'], known: true, src: 'src-kikkoman-cho-yakiniku-label' },
  mentsuyu: { info: 'varies-by-product', poss: ['alg-wheat', 'alg-soybean'], known: true, src: 'src-kikkoman-koidashi-hontsuyu-label' },
  roux: { info: 'varies-by-product', poss: ['alg-milk', 'alg-wheat', 'alg-soybean', 'alg-chicken', 'alg-banana', 'alg-pork', 'alg-apple'], tags: ['meat', 'pork', 'beef', 'chicken', 'dairy'], known: true, src: 'src-house-vermont-curry-label' },
  unknown: { info: 'unknown', poss: [] },
};

export function ing(id, ja, en, quantity, unit, o = {}) {
  const e = D[id];
  if (!e) throw new Error('no dictionary id ' + id);
  const p = o.p ? P[o.p] : null;
  const info = p ? p.info : 'known';
  const tags = [...new Set([...e.animalOrigin, ...(p?.tags ?? [])])];
  const known = p?.known === true ? true : e.animalOriginKnown;
  return {
    ingredientId: id,
    label: { ja, en },
    quantity,
    unit,
    optional: o.opt === true,
    allergenInfo: info,
    allergenIds: [...e.inherentAllergenIds],
    possibleAllergenIds: info === 'varies-by-product' ? [...p.poss] : [],
    animalOrigin: tags,
    animalOriginKnown: known,
    _p: o.p ?? null,
  };
}

const union = (ls) => [...new Set(ls.flat())];

export function rec(o) {
  const ings = o.ingredients;
  const animalOrigin = union(ings.map((i) => i.animalOrigin));
  const dietDataComplete = ings.every((i) => i.animalOriginKnown);
  const presets = ings.map((i) => i._p).filter(Boolean);
  const clean = ings.map(({ _p, ...rest }) => rest);
  return {
    id: o.id,
    name: o.name,
    shortNameJa: o.shortNameJa,
    shortNameEn: o.shortNameEn,
    nameKana: o.nameKana,
    style: o.style,
    themeId: o.themeId ?? null,
    description: o.description,
    yield: o.yield,
    minutes: o.minutes,
    makeAhead: o.makeAhead ?? null,
    ingredients: clean,
    steps: o.steps,
    storage: o.storage,
    allergenIds: union(ings.map((i) => i.allergenIds)),
    mayContainAllergenIds: union(ings.filter((i) => i.allergenInfo === 'varies-by-product').map((i) => i.possibleAllergenIds)),
    allergenDataComplete: !ings.some((i) => i.allergenInfo === 'unknown'),
    allergenScheme: 'caa-2026-04',
    animalOrigin,
    dietDataComplete,
    dietOk: derivedDietOk(animalOrigin, dietDataComplete),
    adaptations: o.adaptations,
    sources: sources(o.sources, presets, o.maff !== false),
    reviewedBy: 'ba-research',
  };
}

const S = (id, publisher, title, url, usedFor, language = 'ja', accessed = ACC) => ({ id, publisher, title, url, accessed, language, usedFor });
const KIK = 'キッコーマン株式会社（ホームクッキング）';
export const SRC = {
  maff: S('src-maff-lunchbox', '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', 'お弁当づくりによる食中毒を予防するために：農林水産省', 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html', ['storage']),
  'src-kikkoman-tokusen-marudaizu-label': S('src-kikkoman-tokusen-marudaizu-label', KIK, 'キッコーマン 特選 丸大豆しょうゆ', 'https://www.kikkoman.co.jp/products/K05/detail/K051005.html', ['allergen'], 'ja', '2026-10-25'),
  'src-kikkoman-delmonte-ketchup-label': S('src-kikkoman-delmonte-ketchup-label', KIK, 'デルモンテ トマトケチャップ', 'https://www.kikkoman.co.jp/products/K45/detail/K451000.html', ['allergen'], 'ja', '2026-10-25'),
  'src-house-curry-powder-label': S('src-house-curry-powder-label', 'ハウス食品株式会社', 'カレーパウダー | 商品カタログトップ | ハウス食品', 'https://housefoods.jp/products/catalog/cd_1,090700,spice,curpd,house.html', ['allergen'], 'ja', '2026-10-25'),
  'src-nipponham-irodori-roast-ham-label': S('src-nipponham-irodori-roast-ham-label', '日本ハム株式会社', '彩りキッチン® ロースハム - ハム | 日本ハム', 'https://www.nipponham.co.jp/products/ham_sausages/ham/roast/2106/', ['allergen'], 'ja', '2026-10-30'),
  'src-nipponham-schauessen-label': S('src-nipponham-schauessen-label', '日本ハム株式会社', 'シャウエッセン® - ソーセージ | 日本ハム', 'https://www.nipponham.co.jp/products/ham_sausages/sausages/win/2125/', ['allergen'], 'ja', '2026-10-30'),
  'src-ajinomoto-pureselect-mayo-label': S('src-ajinomoto-pureselect-mayo-label', '味の素株式会社', '【味の素KK】「ピュアセレクト」｜新鮮キープボトル', 'https://www.ajinomoto.co.jp/pureselect/products/shinsenkeep/', ['allergen'], 'ja', '2026-10-25'),
  'src-mizkan-kokumotsu-su': S('src-mizkan-kokumotsu-su', '株式会社Mizkan', '穀物酢 | 商品情報 | ミツカングループ', 'https://www.mizkan.co.jp/product/group/?gid=01001', ['allergen'], 'ja', '2026-10-25'),
  'src-meg-snow-torokeru-slice-label': S('src-meg-snow-torokeru-slice-label', '雪印メグミルク株式会社', '雪印とろけるスライス（7枚入り） | 商品のご案内 | 雪印メグミルク', 'https://www.meg-snow.com/products/detail.php?p=torokeru_slice', ['allergen']),
  'src-meg-snow-konacheese-label': S('src-meg-snow-konacheese-label', '雪印メグミルク株式会社', '粉チーズ マイルド | 商品のご案内 | 雪印メグミルク', 'https://www.meg-snow.com/products/detail.php?p=konacheese', ['allergen']),
  'src-ajinomoto-consomme-granule-label': S('src-ajinomoto-consomme-granule-label', '味の素株式会社', '味の素KKコンソメ＜顆粒タイプ＞｜商品｜味の素株式会社', 'https://www.ajinomoto.co.jp/products/detail/?ProductName=consomme_3', ['allergen']),
  'src-ajinomoto-hondashi-label': S('src-ajinomoto-hondashi-label', '味の素株式会社', 'ほんだし®｜商品｜味の素株式会社', 'https://www.ajinomoto.co.jp/products/detail/?ProductName=hondashi', ['allergen']),
  'src-kikkoman-cho-yakiniku-label': S('src-kikkoman-cho-yakiniku-label', KIK, 'キッコーマン 超 焼肉のたれ 甘口 | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K20/detail/K200580.html', ['allergen']),
  'src-kikkoman-koidashi-hontsuyu-label': S('src-kikkoman-koidashi-hontsuyu-label', KIK, 'キッコーマン 濃いだし 本つゆ | キッコーマン株式会社', 'https://www.kikkoman.co.jp/products/K15/detail/K150504.html', ['allergen']),
  'src-house-vermont-curry-label': S('src-house-vermont-curry-label', 'ハウス食品株式会社', '１１５ｇ バーモントカレー 甘口 | 商品カタログトップ | ハウス食品', 'https://housefoods.jp/products/catalog/cd_1,090602,curry,roux,vmt.html', ['allergen']),
};
export const recipeSrc = (id, publisher, title, url, usedFor = ['recipe', 'storage']) => S(id, publisher, title, url, usedFor);

function sources(recipeSources, presets, withMaff) {
  const out = [...recipeSources];
  if (withMaff) out.push(SRC.maff);
  for (const p of [...new Set(presets)]) {
    const id = P[p]?.src;
    if (id) out.push(SRC[id]);
  }
  return out;
}

export function write(file, recs) {
  fs.writeFileSync(file, JSON.stringify(recs, null, 2) + '\n');
}
export const L = (ja, en) => ({ ja, en });
export const NHK = 'NHKエデュケーショナル（みんなのきょうの料理）';
export const DEL = 'デリッシュキッチン (every, Inc.)';
export { KIK };
