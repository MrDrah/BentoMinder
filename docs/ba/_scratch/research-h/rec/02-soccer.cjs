const { I, SRC, T } = require('../lib.cjs');
const SF = { src: 'sf', poss: ['alg-soybean'] };
module.exports = {
  id: 'rcp-delish-soccer-ball-onigiri-bento',
  name: T('サッカーボールおにぎり弁当', 'Soccer ball onigiri bento'),
  shortNameJa: 'サッカー',
  shortNameEn: 'Soccer',
  nameKana: 'さっかーぼーるおにぎりべんとう',
  style: 'japanese',
  themeId: null,
  description: T(
    '鮭フレーク入りの丸いおにぎり2個に、五角形に切ったのりをのせてサッカーボールに見立てる、手早く作れるキャラ弁です。',
    'A quick character bento: two round onigiri filled with salmon flakes, topped with pentagon-shaped nori so they look like soccer balls.',
  ),
  yield: T('1人分（ごはん160g）', '1 serving (160 g rice)'),
  minutes: 15,
  ingredients: [
    I('ing-rice', 'ごはん', 'cooked rice', 160, 'g'),
    I('ing-salmon-flakes', '鮭フレーク', 'salmon flakes', 10, 'g', { lab: SF, known: true }),
    I('ing-nori', '焼きのり', 'toasted nori', null, 'to-taste'),
    I('ing-salt', '塩', 'salt', 0.25, 'tsp'),
  ],
  steps: [
    T('ボウルにごはんと塩を入れて混ぜ、2等分する。', 'Mix the rice and salt in a bowl and divide it into two equal portions.'),
    T('ラップにごはんを広げ、中心に鮭フレークを半量のせて包み、丸くにぎる。同じようにもう1個作る。', 'Spread one portion on cling film, put half the salmon flakes in the centre, wrap and shape into a ball. Make a second one the same way.'),
    T('のりを小さな五角形に12枚切る。', 'Cut 12 small pentagons from the nori.'),
    T('おにぎりを弁当箱に入れ、のりをサッカーボールの模様のようにのせる。', 'Put the onigiri in the lunchbox and arrange the nori pentagons like the pattern of a soccer ball.'),
  ],
  storage: [
    T('おにぎりは少し冷ましてから弁当箱に入れます。', 'Let the onigiri cool a little before packing them.'),
    T('蓋をする前にしっかり冷まし、保冷剤と保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Cool them fully before closing the lid, use an ice pack and a cool bag or the fridge, and eat soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けの量とは書かれていません（ごはん160g）。分量は元のままです。', 'The source is for 1 serving and does not say it is a child portion (160 g rice). Amounts are unchanged.'),
    T('のりは元のレシピで「適量」です。鮭フレークのアレルゲンは、ニッスイ「焼さけあらほぐし」の表示（さけ・大豆）を参照しました。使う製品の表示を確認してください。', 'The nori is "as needed" in the source. The salmon flakes allergens follow the Nissui Yakisake Arahogushi label (salmon, soy); check the label of the product you use.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています。', 'The storage notes also follow the MAFF lunchbox food-poisoning page.'),
  ],
  sources: [
    SRC.delish('src-delish-soccer-onigiri', '簡単にキャラ弁！ サッカーボールおにぎり弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/202304490034954662'),
    SRC.salmonflakes(),
    SRC.maff(),
  ],
};
