const { I, SRC, T } = require('../lib.cjs');
const VIN = { src: 'vinegar', poss: ['alg-wheat'] };
module.exports = {
  id: 'rcp-delish-inari-zukinchan-bento',
  name: T('稲荷ずきんちゃん', 'Little Red Inari-hood'),
  shortNameJa: '稲荷ずきん',
  shortNameEn: 'Inari',
  nameKana: 'いなりずきんちゃん',
  style: 'japanese',
  themeId: null,
  description: T(
    '酢飯を稲荷揚げに詰め、のりで目と口をつけて、ずきんをかぶった顔に見立てるかわいいお弁当。2個を並べて詰めます。',
    'A cute bento of vinegared rice stuffed into two inari pouches, with nori eyes and mouths so each looks like a face in a hood.',
  ),
  yield: T('1人分（ごはんお茶碗1杯150g）', '1 serving (150 g rice, one bowl)'),
  minutes: 15,
  ingredients: [
    I('ing-rice', 'ごはん（お茶碗1杯）', 'cooked rice (1 rice bowl)', 150, 'g'),
    I('ing-inari-age', '稲荷揚げ', 'seasoned fried tofu pouches (inari-age)', 2, 'piece'),
    I('ing-nori', '焼きのり', 'toasted nori', null, 'to-taste'),
    I('ing-sugar', '砂糖', 'sugar', 0.5, 'tsp'),
    I('ing-vinegar', '酢', 'vinegar', 2, 'tsp', { lab: VIN, known: true }),
    I('ing-salt', '塩', 'salt', null, 'small-amount'),
  ],
  steps: [
    T('砂糖、酢、塩をボウルで混ぜ合わせ、温かいごはんにさっくり切り混ぜて、冷ましながら酢飯に仕上げる。', 'Mix the sugar, vinegar and salt in a bowl, add the warm rice and fold it in with cutting strokes, then let it cool to make sushi rice.'),
    T('酢飯を2等分し、丸くまとめる。', 'Divide the sushi rice into two and shape each into a ball.'),
    T('稲荷揚げは片側を開いて袋状にし、酢飯をつめて形を整えたら弁当箱に並べる。', 'Cut a slit along one side of each inari pouch, stuff in the rice, tidy the shape and put them in the lunchbox.'),
    T('のりで髪、目、鼻、口を作り、のせて顔に仕上げる。', 'Cut nori into hair, eyes, a nose and a mouth and place them on to make the faces.'),
  ],
  storage: [
    T('酢飯をしっかり冷ましてから弁当箱に詰め、蓋をします。', 'Cool the sushi rice well before packing it and closing the lid.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、できるだけ早く食べます。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat it as soon as you can.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けの量とは書かれていません。分量は元のままです。', 'The source is for 1 serving and does not say it is a child portion. Amounts are unchanged.'),
    T('稲荷揚げは味つき油揚げの袋で、元のレシピは製品を特定していません。表示が見つからなかったため、アレルゲンは「不明」、動物由来も「不明」として記録しています（大豆は含みます）。使う製品の表示を確認してください。', 'Inari-age is a pre-seasoned tofu pouch and the source names no product. No label was found, so its allergen data and animal origin are recorded as unknown (it does contain soy). Check the label of the product you use.'),
    T('酢のアレルゲンはミツカン「穀物酢」の表示を参照しました。使う製品の表示を確認してください。塩は元のレシピで「少々」、のりは「適量」です。', 'The vinegar allergens follow the Mizkan Kokumotsu-su label; check your own product. Salt is "a pinch" and nori "as needed" in the source.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.delish('src-delish-inari-zukinchan', 'お子様も喜ぶ！ 稲荷ずきんちゃんのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/163827359407931795', ['recipe']),
    SRC.vinegar(),
    SRC.maff(),
  ],
};
