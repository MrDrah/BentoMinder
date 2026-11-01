const { I, SRC, T } = require('../lib.cjs');
const MAYO = { src: 'mayo', poss: ['alg-egg', 'alg-soybean'] };
const SUSHISU = { src: 'sushisu', poss: [] };
module.exports = {
  id: 'rcp-delish-nanohana-ebi-onigiri',
  name: T('菜の花とえびの春色おにぎり', 'Spring nanohana and shrimp onigiri'),
  shortNameJa: '菜の花えび',
  shortNameEn: 'Nanohana',
  nameKana: 'なのはなとえびのはるいろおにぎり',
  style: 'japanese',
  themeId: 'theme-seasonal',
  description: T(
    'すし酢で味つけしたごはんに、きざんだ菜の花とゆでえび、マヨネーズ、ごまを混ぜた春らしい三角おにぎり。3個できます。',
    'Triangular onigiri for spring: rice seasoned with sushi vinegar and mixed with chopped nanohana, boiled shrimp, mayonnaise and sesame. Makes 3.',
  ),
  yield: T('おにぎり3個分（ごはんお茶碗2杯300g）', '3 onigiri (300 g rice, two bowls)'),
  minutes: 15,
  ingredients: [
    I('ing-rice', 'ごはん（お茶碗2杯）', 'cooked rice (2 rice bowls)', 300, 'g'),
    I('ing-sushi-vinegar', 'すし酢', 'sushi vinegar', 2, 'tbsp', { lab: SUSHISU, known: true }),
    I('ing-nanohana', '菜の花', 'nanohana (rapeseed blossoms)', 6, 'piece'),
    I('ing-shrimp', 'むきえび', 'peeled shrimp', 10, 'piece'),
    I('ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 2, 'tsp', { lab: MAYO, known: true }),
    I('ing-sesame', '白いりごま', 'toasted white sesame seeds', 1, 'tbsp'),
  ],
  steps: [
    T('湯を沸かして塩を加え、菜の花を30秒ほどゆでて水にとり、水けをしっかり切る。同じ湯でえびを白っぽくなるまでゆで、水けを切って冷ます。', 'Boil water with salt and blanch the nanohana for about 30 seconds, then cool in water and drain well. Boil the shrimp in the same water until they turn whitish, drain and cool.'),
    T('菜の花はみじん切り、えびは1cm幅に切る。', 'Finely chop the nanohana and cut the shrimp into 1 cm pieces.'),
    T('ごはんが温かいうちにすし酢をまわしかけ、しゃもじで切り混ぜる。', 'Put the warm rice and sushi vinegar in a bowl and fold together with cutting strokes.'),
    T('菜の花、えび、マヨネーズ、ごまを加えてさっくり混ぜる。', 'Add the nanohana, shrimp, mayonnaise and sesame and mix lightly.'),
    T('ラップにごはんの3分の1をのせて包み、三角ににぎる。同様に3個作る。', 'Place a third of the rice on cling film, wrap and shape into a triangle. Make 3 in total.'),
  ],
  storage: [
    T('えびにはしっかり火を通し、おにぎりは十分に冷ましてから弁当箱に詰めて蓋をします。', 'Cook the shrimp through, and cool the onigiri fully before packing them and closing the lid.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Use an ice pack and a cool bag or keep them in the fridge, and eat soon.'),
  ],
  adaptations: [
    T('元のレシピはおにぎり3個分で、幼児向けの量とは書かれていません。分量は元のままです。', 'The source makes 3 onigiri and does not say it is a child portion. Amounts are unchanged.'),
    T('ゆで湯の塩は元のレシピで「分量外」のため、材料表に入れていません。', 'The salt for the boiling water is "not in the amounts" in the source, so it is not in the ingredient list.'),
    T('すし酢のアレルゲンはミツカン「すし酢」の表示（原材料に特定原材料なし）、マヨネーズは味の素「ピュアセレクト」の表示（卵・大豆）を参照しました。使う製品の表示を確認してください。', 'Sushi vinegar follows the Mizkan Sushi-su label (no allergen item among its ingredients) and mayonnaise the Ajinomoto Pure Select label (egg, soy). Check the label of the product you use.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.delish('src-delish-nanohana-ebi-onigiri', '菜の花とえびの春色おにぎりのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/136509158718439691', ['recipe']),
    SRC.sushisu(),
    SRC.mayo(),
    SRC.maff(),
  ],
};
