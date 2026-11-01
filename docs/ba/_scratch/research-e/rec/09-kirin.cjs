const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-delish-kirin-tamagoyaki-deco-bento',
  name: T('卵焼きを使って！ キリンさんのデコ弁', 'Giraffe deco bento from tamagoyaki'),
  shortNameJa: 'キリン弁当',
  shortNameEn: 'Giraffe',
  nameKana: 'たまごやきをつかってきりんさんのでこべん',
  style: 'japanese',
  themeId: 'theme-animals',
  description: T(
    '卵焼きを切って組み合わせ、のりで模様と目をつけてごはんの上にキリンの形に並べる、立体的なキャラ弁です。',
    'Tamagoyaki slices fitted together on rice into a giraffe, with nori spots and eyes: a raised character bento.',
  ),
  yield: T('1人分（ごはん200g）', '1 serving (200 g rice)'),
  minutes: 20,
  ingredients: [
    I('ing-egg', '卵', 'egg', 2, 'piece'),
    I('ing-sugar', '砂糖', 'sugar', 0.5, 'tsp'),
    I('ing-dashi', '和風顆粒だし', 'granulated Japanese-style dashi', null, 'small-amount', { lab: { poss: ['alg-milk'] }, known: true, tags: ['dairy'] }),
    I('ing-oil', 'サラダ油', 'cooking oil', 1, 'tbsp'),
    I('ing-nori', '焼きのり', 'toasted nori', 0.25, 'sheet'),
    I('ing-rice', '白ごはん（どんぶり1杯）', 'cooked white rice (1 donburi bowl)', 200, 'g'),
  ],
  steps: [
    T('ボウルに卵を割りほぐし、砂糖と和風顆粒だしを混ぜる。', 'Beat the eggs in a bowl and mix in the sugar and dashi granules.'),
    T('フライパンに油を熱し、卵液の1/3量を流して奥から手前に巻く。これをあと2回くり返し、粗熱をとる。', 'Heat the oil in the pan, pour in a third of the egg and roll it up from the far side. Repeat twice more, then let it cool a little.'),
    T('卵焼きを6切れにし、うち1切れは斜めに半分にする。のりをちぎったり切ったりして模様と目を作り、卵焼きに貼る。', 'Cut the tamagoyaki into six pieces and cut one of them in half on the diagonal. Make spots and eyes from nori and put them on the pieces.'),
    T('弁当箱にごはんを詰め、卵焼きをキリンの形に盛りつける。', 'Pack the rice in the lunchbox and arrange the tamagoyaki on top in the shape of a giraffe.'),
  ],
  storage: [
    T('卵焼きは半熟にせず、中まで完全に火を通します。', 'Cook the tamagoyaki all the way through; do not leave it soft or runny.'),
    T('ごはんも卵焼きも冷ましてから詰め、保冷剤や保冷バッグで涼しく保って早めに食べます。', 'Cool both the rice and the tamagoyaki before packing, keep it cool with an ice pack or cool bag and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分（ごはんはどんぶり1杯200g）で、幼児向けの量とは書かれていません。分量は元のままです。', 'The source is for 1 serving (200 g rice in a donburi bowl) and does not state a child portion. Amounts are unchanged.'),
    T('和風顆粒だしは分量が「少々」です。アレルゲンと原材料は、味の素「ほんだし」の表示（乳成分、かつお節粉末・かつおエキス）を参照しました。製品によって違うので、使うものの表示を確認してください。', 'The dashi granules are "a pinch" in the source. Allergens and ingredients follow the Ajinomoto Hondashi label (milk; bonito powder and extract). Products differ, so check your own.'),
    T('だしの表示に乳糖があるため、動物由来に乳（dairy）を加え、魚（fish-seafood）とあわせて記録しています。', 'The label lists lactose, so milk (dairy) is added to the animal-origin tags alongside fish (fish-seafood).'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.delish('src-delish-kirin-tamagoyaki-deco', '卵焼きを使って！ キリンさんのデコ弁のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/163962188447351187', ['recipe']),
    SRC.hondashi(),
    SRC.maff(),
  ],
};
