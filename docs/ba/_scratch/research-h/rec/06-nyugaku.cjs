const { I, SRC, T } = require('../lib.cjs');
const SHOYU = { src: 'shoyu', poss: ['alg-wheat', 'alg-soybean'] };
const HAM = { src: 'ham', poss: ['alg-egg', 'alg-milk', 'alg-soybean', 'alg-pork'] };
module.exports = {
  id: 'rcp-delish-nyugakushiki-bento',
  name: T('春満開！ 入学式のお弁当', 'Cherry-blossom school entrance ceremony bento'),
  shortNameJa: '入学式弁当',
  shortNameEn: 'Sakura',
  nameKana: 'はるまんかいにゅうがくしきのおべんとう',
  style: 'japanese',
  themeId: 'theme-seasonal',
  description: T(
    '鶏そぼろを木の幹に、ゆでブロッコリーを葉に、桜型に抜いたハムを花に見立てて、ごはんの上に春の桜の木を描くお弁当です。',
    'A spring bento where chicken soboro forms a tree trunk, boiled broccoli the leaves and sakura-shaped ham the blossoms, laid over rice.',
  ),
  yield: T('1人分（ごはんお茶碗1杯150g）', '1 serving (150 g rice, one bowl)'),
  minutes: 40,
  ingredients: [
    I('ing-rice', 'ごはん（お茶碗1杯）', 'cooked rice (1 rice bowl)', 150, 'g'),
    I('ing-ham', 'ハム', 'ham', 1, 'slice', { lab: HAM, known: true }),
    I('ing-broccoli', 'ブロッコリー', 'broccoli', 2, 'piece'),
    I('ing-ground-chicken', '鶏ひき肉（鶏そぼろ用）', 'ground chicken (for the soboro)', 80, 'g'),
    I('ing-cooking-sake', '酒（鶏そぼろ用）', 'cooking sake (for the soboro)', 0.5, 'tbsp'),
    I('ing-sugar', '砂糖（鶏そぼろ用）', 'sugar (for the soboro)', 2, 'tsp'),
    I('ing-soy-sauce', 'しょうゆ（鶏そぼろ用）', 'soy sauce (for the soboro)', 2, 'tsp', { lab: SHOYU, known: true }),
  ],
  steps: [
    T('ブロッコリーをさらに小さな小房に分け、ハムは桜の型で抜く。', 'Divide the broccoli into even smaller florets and cut the ham with a cherry-blossom cutter.'),
    T('沸かした湯でブロッコリーを鮮やかな緑になるまで短くゆで、ざるにあげる。', 'Boil water, blanch the broccoli until its colour changes and drain.'),
    T('鍋にひき肉、酒、砂糖、しょうゆ、水小さじ2を入れ、中火で混ぜながら水分がなくなるまで煮つめて鶏そぼろを作る。', 'Put the ground chicken, sake, sugar, soy sauce and 2 tsp water in a pan and cook over medium heat, stirring, until the liquid is gone, to make the soboro.'),
    T('弁当箱にごはんの半量を敷き、そぼろの半量を重ねる。', 'Spread half the rice in the lunchbox and put half the soboro on top.'),
    T('残りのごはんをのせ、残りのそぼろで木の幹と枝の形を作る。', 'Add the rest of the rice and use the remaining soboro to form a trunk and branches.'),
    T('葉の部分にブロッコリーを置き、桜型のハムを花びらのようにのせる。', 'Place the broccoli where the leaves go and dot the sakura-shaped ham on like blossoms.'),
  ],
  storage: [
    T('そぼろもブロッコリーも十分に冷ましてから詰めて、蓋をします。', 'Cool the soboro and broccoli thoroughly before packing and closing the lid.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けの量とは書かれていません。分量は元のままです。調理時間は元のレシピのとおり約40分です。', 'The source is for 1 serving and does not say it is a child portion. Amounts are unchanged. The time is the source figure of about 40 minutes.'),
    T('水小さじ2は材料表に載せていません（手順に書きました）。', 'The 2 tsp of water is in the steps, not the ingredient list.'),
    T('ハムのアレルゲンは日本ハム「彩りキッチン ロースハム」の表示（卵・乳・大豆・豚肉）、しょうゆはキッコーマン「特選 丸大豆しょうゆ」の表示（小麦・大豆）を参照しました。使う製品の表示を確認してください。', 'Ham allergens follow the Nippon Ham Irodori Kitchen roast ham label (egg, milk, soy, pork) and soy sauce the Kikkoman Tokusen Marudaizu label (wheat, soy). Check the label of the product you use.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.delish('src-delish-nyugakushiki', '春満開！ 入学式のお弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/208208666115965984', ['recipe']),
    SRC.ham(),
    SRC.shoyu(),
    SRC.maff(),
  ],
};
