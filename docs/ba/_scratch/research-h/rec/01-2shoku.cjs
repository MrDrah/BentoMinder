const { I, SRC, T } = require('../lib.cjs');
const SHOYU = { src: 'shoyu', poss: ['alg-wheat', 'alg-soybean'] };
const DASHI = { src: 'hondashi', poss: ['alg-milk'] };
module.exports = {
  id: 'rcp-delish-2shoku-soboro-bento',
  name: T('レンジで簡単！ 2色そぼろ弁当', 'Microwave two-colour soboro bento'),
  shortNameJa: '2色そぼろ',
  shortNameEn: '2-colour',
  nameKana: 'れんじでかんたんにしょくそぼろべんとう',
  style: 'japanese',
  themeId: null,
  description: T(
    '甘辛い鶏そぼろとやさしい味の卵そぼろを、電子レンジだけで作る2色のそぼろ弁当です。火を使わず、朝の短い時間で仕上がります。',
    'A two-colour soboro bento of sweet-savoury chicken and mild egg crumble, both made entirely in the microwave with no stove, ready in a short morning slot.',
  ),
  yield: T('1人分', '1 serving'),
  minutes: 10,
  ingredients: [
    I('ing-rice', 'ごはん', 'cooked rice', null, 'small-amount'),
    I('ing-ground-chicken', '鶏ひき肉', 'ground chicken', 80, 'g'),
    I('ing-sugar', '砂糖（鶏そぼろ用）', 'sugar (for the chicken)', 0.5, 'tbsp'),
    I('ing-cooking-sake', '酒', 'cooking sake', 0.5, 'tbsp'),
    I('ing-mirin', 'みりん', 'mirin', 0.5, 'tbsp'),
    I('ing-soy-sauce', 'しょうゆ', 'soy sauce', 0.5, 'tbsp', { lab: SHOYU, known: true }),
    I('ing-egg', '卵', 'egg', 1, 'piece'),
    I('ing-sugar', '砂糖（卵そぼろ用）', 'sugar (for the egg)', 0.5, 'tsp'),
    I('ing-salt', '塩（卵そぼろ用）', 'salt (for the egg)', null, 'small-amount'),
    I('ing-dashi', '和風顆粒だし', 'granulated Japanese-style dashi', null, 'small-amount', { lab: DASHI, known: true, tags: ['dairy'] }),
    I('ing-snap-peas', 'スナップえんどう', 'sugar snap pea', 1, 'piece'),
    I('ing-salt', '塩（スナップえんどう用）', 'salt (for the sugar snap pea)', null, 'small-amount'),
  ],
  steps: [
    T('耐熱ボウルにひき肉、砂糖、酒、みりん、しょうゆを入れて混ぜる。', 'Mix the ground chicken, sugar, sake, mirin and soy sauce in a heatproof bowl.'),
    T('ふんわりラップをして電子レンジ（500W）で1分30秒温め、よく混ぜてもう一度1分30秒温め、再び混ぜる。', 'Cover loosely with cling film, microwave at 500 W for 1 minute 30 seconds, stir well, then microwave another 1 minute 30 seconds and stir again.'),
    T('別のボウルに卵、砂糖、塩、だし、水小さじ1を入れて混ぜ、ラップをふんわりかけて500Wで1分温めてよく混ぜる。', 'In another bowl mix the egg, sugar, salt, dashi and 1 tsp water, cover loosely, microwave at 500 W for 1 minute and stir well.'),
    T('スナップえんどうは筋をとって耐熱皿にのせ、少量の水と塩をふる。', 'String the sugar snap pea, place it on a heatproof plate and sprinkle with a little water and salt.'),
    T('ラップをふんわりかけ、500Wで30秒温める。', 'Cover loosely and microwave at 500 W for 30 seconds.'),
    T('弁当箱にごはんを詰め、鶏そぼろと卵そぼろ、スナップえんどうを盛りつける。', 'Pack the rice in the lunchbox and add the chicken soboro, egg soboro and sugar snap pea.'),
  ],
  storage: [
    T('おかずを十分に冷ましてから詰めて、蓋をします。', 'Cool everything thoroughly before packing and closing the lid.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、できるだけ早く食べます。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat it as soon as you can.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けの量とは書かれていません。分量は元のままです。', 'The source is for 1 serving and does not say it is a child portion. Amounts are unchanged.'),
    T('水小さじ1は材料表に載せていません（手順に書きました）。', 'The 1 tsp of water is in the steps, not the ingredient list.'),
    T('ごはんの量は元のレシピに書かれていないため、「適量」として記録しています。', 'The source does not state the amount of rice, so it is recorded as an unspecified small amount.'),
    T('和風顆粒だしは分量が「少々」です。アレルゲンと原材料は、味の素「ほんだし」の表示（乳成分、かつお節粉末・かつおエキス）を参照しました。製品によって違うので、使うものの表示を確認してください。', 'The dashi granules are "a pinch" in the source. Allergens and ingredients follow the Ajinomoto Hondashi label (milk; bonito powder and extract). Products differ, so check your own.'),
    T('だしの表示に乳糖があるため、動物由来に乳（dairy）を加え、魚（fish-seafood）とあわせて記録しています。', 'The label lists lactose, so milk (dairy) is added to the animal-origin tags alongside fish (fish-seafood).'),
    T('しょうゆのアレルゲンはキッコーマン「特選 丸大豆しょうゆ」の表示（小麦・大豆）を参照しました。使う製品の表示を確認してください。', 'The soy sauce allergens follow the Kikkoman Tokusen Marudaizu label (wheat, soy). Check the label of the product you use.'),
    T('元のレシピには、ひき肉は牛・豚・合いびきでも作れるとあります。ここでは鶏ひき肉で記録しています。', 'The source says beef, pork or mixed mince also works; this record uses ground chicken.'),
  ],
  sources: [
    SRC.delish('src-delish-2shoku-soboro', 'レンジで簡単！ 2色そぼろ弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/149927852731531763'),
    SRC.shoyu(),
    SRC.hondashi(),
  ],
};
