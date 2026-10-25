import { i, run, S, SOY } from './lib.mjs';

const KIK = 'キッコーマン株式会社（ホームクッキング）';
run({
  id: 'rcp-kikkoman-tori-tamago-onigiri-bento',
  name: { ja: '鶏と卵のおにぎり弁当', en: 'Chicken and egg rice ball bento' },
  shortNameJa: 'とりたまおにぎり',
  shortNameEn: 'Onigiri',
  nameKana: 'とりとたまごのおにぎりべんとう',
  style: 'japanese',
  themeId: null,
  description: {
    ja: 'いり卵と鶏そぼろを具にして、ラップで丸くにぎったおにぎり2個。ぽろぽろしがちなそぼろもまとまって食べやすくなります。きゅうりのしょうゆ漬けを添えます。',
    en: 'Two round rice balls filled with scrambled egg and chicken soboro, shaped in cling film so the crumbly fillings hold together and are easy to eat. Served with soy-pickled cucumber.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 30,
  makeAhead: null,
  ingredients: [
    i('ing-rice', 'ご飯（温かいもの）', 'warm cooked rice', 100, 'g'),
    i('ing-egg', '卵', 'egg', 0.5, 'piece'),
    i('ing-salt', '塩', 'salt', null, 'small-amount'),
    i('ing-sugar', '砂糖（いり卵用）', 'sugar (for the egg)', null, 'small-amount'),
    i('ing-ground-chicken', '鶏ひき肉', 'minced chicken', 20, 'g'),
    SOY('しょうゆ（そぼろ用）', 'soy sauce (for the soboro)', 0.5, 'tsp'),
    i('ing-sugar', '砂糖（そぼろ用）', 'sugar (for the soboro)', 0.5, 'tsp'),
    i('ing-cucumber', 'きゅうり（5cm）', 'cucumber (a 5 cm piece)', 1, 'piece'),
    SOY('しょうゆ（漬け用）', 'soy sauce (for the pickle)', 0.5, 'tbsp'),
  ],
  steps: [
    { ja: '小鍋に卵、塩少々、砂糖少々を入れて混ぜ、かき混ぜながら加熱していり卵にする。', en: 'Mix the egg with a pinch each of salt and sugar in a small pan and cook, stirring, into scrambled egg.' },
    { ja: '別の小鍋に鶏ひき肉、しょうゆと砂糖を小さじ1/2ずつ入れ、混ぜながら火を通してそぼろにする。', en: 'In another small pan, cook the minced chicken with 1/2 tsp each of soy sauce and sugar, stirring, into a fine crumble.' },
    { ja: 'ラップを広げて中央にいり卵とそぼろを半量ずつ置き、ご飯の半量を上に重ねる。ラップごと包み込み、しっかり力を入れて丸いおにぎりにする。', en: 'Spread out a sheet of cling film, put half the egg and half the soboro in the centre and half the rice on top. Wrap it up and press firmly into a round rice ball.' },
    { ja: '残りの材料で、もう1個同じように作る。', en: 'Make a second one the same way with the rest.' },
    { ja: 'きゅうりに1～2mm間隔の切り込みを、底を残して入れてから、1cmずつに切り分ける。', en: 'Make cuts 1–2 mm apart in the cucumber without slicing all the way through, then cut it into 1 cm pieces.' },
    { ja: 'しょうゆ大さじ1/2をまぶしておき、やわらかくなったら漬け汁を捨てる。', en: 'Coat with 1/2 tbsp soy sauce, and when the cucumber has softened, pour off the liquid.' },
  ],
  storage: [
    { ja: 'いり卵とそぼろは、中までしっかり火を通します。', en: 'Cook the scrambled egg and the soboro all the way through.' },
    { ja: 'きゅうりのしょうゆ漬けは、汁気をよくきってから詰めます。', en: 'Drain the soy-pickled cucumber well before packing it.' },
  ],
  adaptations: [
    { ja: '分量は元のレシピ（幼稚園児1人分）のままです。調理時間は2品の時間（20分＋10分）を合計しました。', en: 'Amounts are as in the source (one kindergarten child). The time is the sum of the two dishes (20 + 10 minutes).' },
    { ja: '銘柄指定のしょうゆは一般的なしょうゆとして記載しました。「きゅうり 5cm」は5cm分の1切れとして記録しています。', en: 'The branded soy sauce is listed as ordinary soy sauce. "5 cm of cucumber" is recorded as one 5 cm piece.' },
  ],
  sources: [
    { id: 'src-kikkoman-tori-tamago-onigiri-bento', publisher: KIK, title: '鶏と卵のおにぎり弁当 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/lunch/enji/toritamago.html', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-tori-tamago-wrap-onigiri', publisher: KIK, title: '鶏と卵のラップおにぎり（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00002947/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-kyuri-shoyuzuke', publisher: KIK, title: 'きゅうりのしょうゆ漬け（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00002948/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    S.soy,
    S.maff,
  ],
});
