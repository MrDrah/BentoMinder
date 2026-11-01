const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-delish-nasigoreng-style-bento',
  name: T('ナシゴレン風弁当', 'Nasi-goreng-style bento'),
  shortNameJa: 'ナシゴレン',
  shortNameEn: 'NasiGor',
  nameKana: 'なしごれんふうべんとう',
  style: 'other',
  themeId: null,
  description: T(
    '鶏ひき肉と赤パプリカ、コーンをレンジで火を通してごはんに混ぜ、ゆで卵をのせる、朝に手早く作れるインドネシア風のごはん弁当です。',
    'A quick Indonesian-style rice bento: chicken, red pepper and corn cooked in the microwave, mixed into rice and topped with a boiled egg.',
  ),
  yield: T('1人分（ごはん150g）', '1 serving (150 g rice)'),
  minutes: 20,
  ingredients: [
    I('ing-rice', '白ごはん（お茶碗1杯）', 'cooked white rice (1 rice bowl)', 150, 'g'),
    I('ing-ground-chicken', '鶏ひき肉（むね）', 'ground chicken (breast)', 80, 'g'),
    I('ing-egg', 'ゆで卵', 'boiled egg', 1, 'piece'),
    I('ing-paprika', '赤パプリカ', 'red bell pepper', 50, 'g'),
    I('ing-corn', '冷凍コーン', 'frozen corn', 20, 'g'),
    I('ing-soy-sauce', 'しょうゆ', 'soy sauce', 0.5, 'tsp', { lab: { poss: ['alg-wheat', 'alg-soybean'] } }),
    I('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
    I('ing-ketchup', 'ケチャップ', 'ketchup', 0.5, 'tbsp', { lab: { poss: [] } }),
    I('ing-ginger', 'おろししょうが', 'grated ginger', 0.5, 'tsp'),
  ],
  steps: [
    T('赤パプリカをみじん切りにする。冷凍コーンは先に解凍しておく。', 'Finely chop the red pepper and thaw the frozen corn beforehand.'),
    T('ゆで卵を縦半分に切る。卵は半熟にせず、しっかり火が通るまでゆでておく。', 'Cut the boiled egg in half lengthwise. The egg must be boiled hard, not soft.'),
    T('耐熱ボウルに鶏ひき肉、パプリカ、コーン、しょうゆ、こしょう、ケチャップ、しょうがを入れてよく混ぜる。', 'Mix the chicken, red pepper, corn, soy sauce, pepper, ketchup and ginger well in a heatproof bowl.'),
    T('ふんわりラップをかけ、肉に火が通るまで（600Wで約3分）温める。取り出したらごはんを混ぜ込み、完全に冷ます。', 'Cover loosely and microwave at 600 W for about 3 minutes, until the meat is cooked. Mix in the rice and cool it thoroughly.'),
    T('冷めたナシゴレン風ごはんを弁当箱に入れ、ゆで卵を飾る。', 'Pack the nasi-goreng-style rice in the lunchbox and put the boiled egg on top.'),
  ],
  storage: [
    T('卵は半熟を避け、中までしっかり火を通したものを使います。', 'Use an egg that is cooked through to the centre, never soft-boiled.'),
    T('ごはんが完全に冷めてから蓋を閉め、保冷剤・保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Cool the rice completely before packing and closing the lid, keep it cold with an ice pack and cool bag or in the fridge, and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、ごはんは茶碗1杯の150gです。幼児向けの量とは書かれていないので、分量は変えていません。', 'The source is for 1 serving (one rice bowl, 150 g) and does not call itself a child portion. Amounts are unchanged.'),
    T('ゆで卵のゆで方は書かれておらず、あらかじめゆでたものを使います。こしょうは「少々」なので量なしで登録しています。', 'The source does not explain how to boil the egg, so use one boiled beforehand. The pepper is "a little", entered without an amount.'),
    T('しょうゆとケチャップは参照した製品表示（キッコーマン、デルモンテ）によります。使う製品の表示を確認してください。', 'Soy sauce and ketchup follow the cited product labels (Kikkoman, Del Monte). Check the labels of your own products.'),
  ],
  sources: [
    SRC.delish('src-delish-nasigoreng-style', '忙しい朝におすすめ！ ナシゴレン風弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/364472701244408221', ['recipe', 'storage']),
    SRC.shoyu(),
    SRC.ketchup(),
    SRC.maff(),
  ],
};
