const { I, SRC, T } = require('../lib.cjs');
const SHOYU = { src: 'shoyu', poss: ['alg-wheat', 'alg-soybean'] };
module.exports = {
  id: 'rcp-delish-soboro-edamame-gohan',
  name: T('甘辛そぼろの枝豆ごはん', 'Sweet-savoury soboro and edamame rice'),
  shortNameJa: 'そぼろ枝豆',
  shortNameEn: 'Soboro',
  nameKana: 'あまからそぼろのえだまめごはん',
  style: 'japanese',
  themeId: null,
  description: T(
    '豚ひき肉を調味料と一緒に電子レンジで加熱してそぼろにし、枝豆とあたたかいごはんに混ぜる、火も包丁も使わない混ぜごはんです。',
    'A no-knife, no-stove mixed rice: pork mince is cooked with seasonings in the microwave, then folded into warm rice with edamame.',
  ),
  yield: T('2人分（ごはん300g）', '2 servings (300 g rice)'),
  minutes: 10,
  ingredients: [
    I('ing-rice', 'ごはん（お茶碗2杯・あたたかいもの）', 'warm cooked rice (2 rice bowls)', 300, 'g'),
    I('ing-ground-pork', '豚ひき肉', 'pork mince', 100, 'g'),
    I('ing-edamame', '冷凍枝豆（解凍してさやから出す）', 'frozen edamame (thawed, shelled)', 60, 'g'),
    I('ing-cooking-sake', '酒', 'cooking sake', 1, 'tsp'),
    I('ing-sugar', '砂糖', 'sugar', 1, 'tsp'),
    I('ing-soy-sauce', 'しょうゆ', 'soy sauce', 0.5, 'tbsp', { lab: SHOYU }),
    I('ing-ginger', 'おろししょうが', 'grated ginger', 0.33, 'tsp'),
    I('ing-sesame', '白いりごま', 'toasted white sesame seeds', null, 'to-taste'),
  ],
  steps: [
    T('解凍した枝豆をさやから出しておく。', 'Take the thawed edamame out of their pods.'),
    T('耐熱容器にひき肉、酒、砂糖、しょうゆ、しょうがを入れ、肉をほぐすように混ぜ合わせる。', 'Put the mince, sake, sugar, soy sauce and ginger in a heatproof dish and mix, breaking up the meat.'),
    T('ふんわりラップをかけ、600Wで2〜3分、ひき肉に火が通るまで温める。ラップを外し、全体を混ぜ合わせる。', 'Cover loosely with cling film and microwave at 600 W for 2 to 3 minutes until the meat is cooked through; remove the film and stir.'),
    T('あたたかいごはんと枝豆を加えてさっくり混ぜ、器に盛ってごまをふる。', 'Add the warm rice and edamame, fold lightly, serve and sprinkle with sesame.'),
  ],
  storage: [
    T('お弁当に詰めるときは、ごはんもおかずも十分に冷ましてから蓋を閉めます。', 'For a lunchbox, cool the rice and topping completely before closing the lid.'),
    T('冷蔵庫か保冷剤を入れた保冷バッグで保管し、早めに食べます。', 'Keep it in the fridge or in a cool bag with an ice pack and eat it soon.'),
    T('ひき肉は中心まで火が通ったことを確かめてから使います。', 'Make sure the mince is cooked through to the centre before you use it.'),
  ],
  adaptations: [
    T('元のレシピは2人分（ごはんお茶碗2杯・300g）で、幼児向けとは書かれていません。分量は変えずに記録しています。', 'The source is for 2 servings (two bowls, 300 g rice) and does not call itself a child portion; amounts are unchanged.'),
    T('元のレシピは調理時間約10分で、おにぎりにして軽食にもできると紹介しています。お弁当用の特別な手順はありません。', 'The source gives about 10 minutes and says the rice can also be shaped into rice balls. It has no bento-specific steps.'),
    T('白いりごまは元のレシピで「適量」です。生の枝豆を使う場合はゆでてから混ぜるとよいとされています。', 'Sesame is "as needed" in the source, which adds that fresh edamame should be boiled first.'),
    T('しょうゆの原材料は製品で違うため、参照した製品の表示（小麦・大豆）にもとづいて記録しています。使う製品の表示を確認してください。', 'Soy sauce differs by product; the allergens come from the cited label (wheat, soy), so check the label of the one you use.'),
  ],
  sources: [
    SRC.delish('src-delish-soboro-edamame', '簡単おいしい！ 甘辛そぼろの枝豆ごはんのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/303010139479212367', ['recipe']),
    SRC.maff(),
    SRC.shoyu(),
  ],
};
