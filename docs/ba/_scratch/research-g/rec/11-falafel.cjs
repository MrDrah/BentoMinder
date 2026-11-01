const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-bbc-falafel-lunchbox',
  name: T('ファラフェル・ランチボックス', 'Falafel lunchbox'),
  shortNameJa: 'ファラフェル',
  shortNameEn: 'Falafel',
  nameKana: 'ふぁらふぇるらんちぼっくす',
  style: 'other',
  themeId: null,
  description: T(
    '火を使わず、調理済みの雑穀に生野菜、ファラフェル、フムスをのせるだけで作る、ベジタリアン向けのお弁当風サラダです。',
    'A no-cook, vegetarian bento-style salad: ready-cooked grains topped with raw vegetables, falafel and hummus, packed in separate compartments.',
  ),
  yield: T('3人分（大人2人と子ども2人分としても）', '3 servings (or 2 adults and 2 children)'),
  minutes: 10,
  ingredients: [
    I('ing-quinoa', '調理済みの雑穀またはレンズ豆のパウチ（キヌアを使用）', 'pouch of cooked grains or lentils (quinoa used)', 250, 'g'),
    I('ing-spinach', 'ベビーほうれんそう', 'baby spinach', null, 'small-amount'),
    I('ing-cucumber', 'きゅうり（刻む）', 'cucumber, chopped', 0.25, 'piece'),
    I('ing-cherry-tomato', 'ミニトマト（半分に切る）', 'cherry tomatoes, halved', null, 'small-amount'),
    I('ing-carrot', 'にんじん（すりおろす）', 'carrots, grated', 2, 'piece'),
    I('ing-pomegranate', 'ざくろ（実だけ）', 'pomegranate, seeds only', 1, 'piece'),
    I('ing-olive', 'オリーブ', 'olives', 10, 'piece', { optional: true }),
    I('ing-falafel', 'ファラフェル（市販品でもよい）', 'falafel (shop-bought is fine)', 12, 'piece'),
    I('ing-hummus', 'フムス', 'hummus', 4, 'tbsp'),
    I('ing-olive-oil', 'オリーブオイル（かける）', 'olive oil (drizzle)', null, 'small-amount', { optional: true }),
    I('ing-lemon', 'レモン（4等分）', 'lemon, quartered', 0.5, 'piece'),
  ],
  steps: [
    T('雑穀をお弁当箱3つに分けて入れる。', 'Divide the grains between three lunchboxes.'),
    T('野菜、ファラフェル、フムス、あればオリーブオイルを少々のせる。仕切りのあるお弁当箱なら、材料を区画ごとに分けて詰める。', 'Top each with vegetables, falafel, hummus and, if using, a little olive oil; with a compartment box, pack each ingredient in its own section.'),
    T('食べる直前に絞れるよう、レモンを1切れずつ添える。', 'Add a lemon wedge to each box to squeeze just before eating.'),
  ],
  storage: [
    T('生の野菜は洗って水けをきってから詰めます。冷蔵庫か保冷剤を入れた保冷バッグで保管し、早めに食べます。', 'Wash raw vegetables and drain them before packing. Keep the box in the fridge or a cool bag with an ice pack and eat it soon.'),
    T('温かいものを使った場合は、十分に冷ましてから詰めて蓋を閉めます。', 'If any part was warm, cool it fully before packing and closing the lid.'),
  ],
  adaptations: [
    T('元のレシピは3人分（大人2人と子ども2人でもよい）で、幼児1人分ではありません。分量は変えていません。', 'The source serves 3 (or 2 adults and 2 children), not one child; amounts are unchanged.'),
    T('元のレシピの「ひとつかみ」のベビーほうれんそうとミニトマトは、少量として記録しています。ざくろは1個分の実、レモンは1/2個を4等分です。', 'A "handful" of baby spinach and cherry tomatoes is recorded as a small amount. The pomegranate is seeds from one fruit; the lemon is half a fruit in quarters.'),
    T('調理済みの穀物は元のレシピで250gのパウチで、赤と白のキヌアが使われています。ファラフェルとフムスは市販品のため、メーカー表示がなくアレルゲンを不明として記録しています（ごまなどを含む場合があります）。', 'The grains are a 250 g pouch of red and white quinoa. No labels were found for the falafel or hummus, so their allergens are unknown (they may contain sesame, for example).'),
    T('元のレシピは調理時間なしで準備10分です。', 'The source gives 10 minutes of preparation and no cooking.'),
  ],
  sources: [
    { id: 'src-bbc-falafel-lunchbox', publisher: 'Immediate Media Company Ltd (BBC Good Food)', title: 'Falafel lunchbox recipe | Good Food', url: 'https://www.bbcgoodfood.com/recipes/falafel-lunchbox', accessed: '2026-11-01', language: 'en', usedFor: ['recipe'] },
    SRC.maff(),
  ],
};
