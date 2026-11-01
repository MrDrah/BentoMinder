const { I, SRC, T } = require('../lib.cjs');
const MAYO = { src: 'mayo', poss: ['alg-egg', 'alg-soybean'] };
const HAM = { src: 'ham', poss: ['alg-egg', 'alg-milk', 'alg-soybean', 'alg-pork'] };
const CHEESE = { src: 'slice', poss: [] };
module.exports = {
  id: 'rcp-delish-tamagoyakiki-5min-bento',
  name: T('卵焼き器５分弁当', '5-minute omelette-pan bento'),
  shortNameJa: '5分弁当',
  shortNameEn: '5-min',
  nameKana: 'たまごやきき5ふんべんとう',
  style: 'japanese',
  themeId: null,
  description: T(
    '卵焼き器ひとつで3品を作る時短のおかず弁当。はんぺん入りのふわふわ卵焼き、ハムチーズのはさみ焼き、ピーマンと桜えびのマヨ炒めです。',
    'A quick side-dish bento made in a single tamagoyaki pan: fluffy hanpen omelette, ham-and-cheese hanpen pockets and a green pepper and sakura shrimp mayo stir-fry.',
  ),
  yield: T('2人分', '2 servings'),
  minutes: 5,
  ingredients: [
    I('ing-egg', '卵（卵焼き用）', 'egg (for the omelette)', 1, 'piece'),
    I('ing-mirin', 'みりん（卵焼き用）', 'mirin (for the omelette)', 1, 'tbsp'),
    I('ing-salt', '塩（卵焼き用）', 'salt (for the omelette)', null, 'small-amount'),
    I('ing-hanpen', 'はんぺん（卵焼き用）', 'hanpen (for the omelette)', 0.5, 'piece'),
    I('ing-oil', 'サラダ油', 'cooking oil', 1, 'tbsp'),
    I('ing-hanpen', 'はんぺん（ハムチーズ焼き用）', 'hanpen (for the ham and cheese pockets)', 0.5, 'piece'),
    I('ing-ham', 'ハム', 'ham', 1, 'slice', { lab: HAM, known: true }),
    I('ing-cheese', 'スライスチーズ', 'sliced cheese', 1, 'slice', { lab: CHEESE, known: true }),
    I('ing-green-pepper', 'ピーマン', 'green pepper', 1, 'piece'),
    I('ing-shrimp', '桜えび', 'sakura shrimp (dried)', 1, 'tbsp'),
    I('ing-pepper', '黒こしょう', 'black pepper', null, 'small-amount'),
    I('ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 1, 'tbsp', { lab: MAYO, known: true }),
  ],
  steps: [
    T('ポリ袋の中ではんぺん（卵焼き用）をつぶしてなめらかにし、卵、みりん、塩を加えてもみ混ぜる。', 'Put the first half of the hanpen in a plastic bag and knead until smooth, then add the egg, mirin and salt and knead again.'),
    T('残りのはんぺんは横から包丁を入れて袋状にし、二つ折りのハムとチーズをはさんで半分に切る。', 'Cut a pocket into the side of the other half of the hanpen, tuck in the folded ham and cheese and cut it in half.'),
    T('ピーマンを縦半分にして中身を除き、細く切る。', 'Halve the green pepper, remove the seeds and pith and cut into thin strips.'),
    T('卵焼き器に油を熱して1を入れ、弱火で1分ほど焼いて巻き、取り出して食べやすく切る。', 'Heat the oil in the pan, pour in mixture 1 and cook on low for about a minute, roll it up, take it out and cut into pieces.'),
    T('同じ卵焼き器を中火で熱し、ハムチーズのはんぺんを返しながら弱火で焼き色がつくまで焼く。', 'Heat the pan on medium, cook the stuffed hanpen on low, turning, until browned.'),
    T('ピーマンと桜えびを卵焼き器に入れて中火で炒め、しんなりしたらマヨネーズと黒こしょうで調味する。', 'Stir-fry the green pepper and sakura shrimp in the pan over medium heat until soft, then season with mayonnaise and black pepper.'),
  ],
  storage: [
    T('おかずを十分に冷ましてから弁当箱に詰めて蓋をします。', 'Cool all the dishes thoroughly before packing and closing the lid.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、できるだけ早く食べます。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat it as soon as you can.'),
  ],
  adaptations: [
    T('元のレシピは2人分で、幼児向けの量とは書かれていません。分量は元の2人分のままです。', 'The source is for 2 servings and does not say it is a child portion. Amounts are kept as the source states them for 2.'),
    T('ごはんは元のレシピに含まれていません。おかずだけの弁当です。', 'Rice is not part of the source; this is a side-dish-only bento.'),
    T('桜えびは辞書では「えび」として記録しています。はんぺんの原材料は製品の表示が見つからなかったため、アレルゲンは「不明」としています（魚と卵由来の可能性があります）。', 'Sakura shrimp are recorded under the generic shrimp entry. No label was found for the hanpen, so its allergen data is unknown (it may contain fish and egg).'),
    T('ハムは日本ハム「彩りキッチン ロースハム」、チーズは雪印メグミルク「とろけるスライス」、マヨネーズは味の素「ピュアセレクト」の表示を参照しました。使う製品の表示を確認してください。', 'Ham follows the Nippon Ham Irodori Kitchen label, cheese the Snow Brand Megmilk Torokeru Slice label and mayonnaise the Ajinomoto Pure Select label. Check the products you use.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.delish('src-delish-tamagoyakiki-5min', 'ねぼすけも助かる！ 卵焼き器５分弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/188357489878630822', ['recipe']),
    SRC.ham(),
    SRC.slicecheese(),
    SRC.mayo(),
    SRC.maff(),
  ],
};
