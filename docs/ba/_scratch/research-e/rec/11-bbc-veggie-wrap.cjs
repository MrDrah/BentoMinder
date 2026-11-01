const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-bbc-veggie-olive-wrap',
  name: T('ベジタブルとオリーブのラップ', 'Veggie olive wraps with mustard vinaigrette'),
  shortNameJa: 'オリーブラップ',
  shortNameEn: 'Olive',
  nameKana: 'べじたぶるとおりーぶのらっぷ',
  style: 'other',
  themeId: null,
  description: T(
    '細切りの野菜とオリーブをマスタード風味の酢と油であえ、大きなトルティーヤで巻く、火を使わない10分の野菜ラップです。',
    'Shredded vegetables and olives tossed in a mustard dressing and rolled in a large tortilla: a no-cook, 10-minute veg wrap.',
  ),
  yield: T('1人分（大きなトルティーヤ1枚）', '1 serving (1 large tortilla)'),
  minutes: 10,
  ingredients: [
    I('ing-carrot', 'にんじん（細切りまたは粗おろし）', 'carrot, shredded or coarsely grated', 1, 'piece'),
    I('ing-cabbage', '紫キャベツ（くし形、細切り）', 'red cabbage wedge, finely shredded', 80, 'g'),
    I('ing-green-onion', '小ねぎ（薄切り）', 'spring onions, thinly sliced', 2, 'piece'),
    I('ing-zucchini', 'ズッキーニ（細切りまたは粗おろし）', 'courgette (zucchini), shredded or coarsely grated', 1, 'piece'),
    I('ing-basil', 'バジルの葉', 'basil leaves', null, 'small-amount'),
    I('ing-olive', 'グリーンオリーブ（種なし、半分に切る）', 'green olives, pitted and halved', 5, 'piece'),
    I('ing-mustard-powder', 'イングリッシュマスタードパウダー', 'English mustard powder', 0.5, 'tsp'),
    I('ing-oil', 'なたね油（エクストラバージン）', 'extra virgin rapeseed oil', 2, 'tsp'),
    I('ing-vinegar', 'りんご酢', 'cider vinegar', 1, 'tbsp'),
    I('ing-tortilla', 'シード入りの大きなトルティーヤ', 'large seeded tortilla', 1, 'piece'),
  ],
  steps: [
    T('トルティーヤ以外の材料をすべてボウルに入れて、よく混ぜ合わせる。', 'Put everything except the tortilla in a bowl and toss well.'),
    T('広げたアルミホイルにトルティーヤをのせ、片端に沿って具を山盛りにする。多すぎるようでも、しっかり巻けばおさまる。', 'Put the tortilla flat on foil and heap the vegetables along one edge. The pile looks excessive, but rolling firmly squeezes it down.'),
    T('具のある側からしっかり巻き、両端を折り込む。ホイルの両端も折りたたんで具が出ないようにする。', 'Roll from the filling side, tucking in the sides, and fold in the ends of the foil to hold everything in.'),
    T('半分に切ってすぐに食べる。持ち歩くときは切らずに、ベーキングペーパーで包む。', 'Cut in half and eat right away. To carry it, leave it whole and wrap it in baking parchment.'),
  ],
  storage: [
    T('元のレシピでは、切ってすぐに食べるか、持ち歩くときは切らずにベーキングペーパーで包むとされています。', 'The source says to cut it and eat it straight away, or to leave it whole and wrap it in baking parchment for carrying.'),
    T('生野菜が中心なので、よく洗って水けを切ってから使い、冷蔵庫や保冷バッグなど涼しいところに置いて早めに食べます。', 'It is mostly raw vegetables, so wash and drain them well, keep the wrap somewhere cool such as a fridge or cool bag, and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、大人の昼食向けとして紹介されています。幼児向けの量とは書かれていないので、分量は元のままです。', 'The source serves 1 and is presented as an adult lunch. It does not state a child portion, so amounts are unchanged.'),
    T('日本語名は英語の題名を訳したものです。量はg・mlなどに合わせ、バジルは「ひとつかみ」なので量なしとして記録しています。', 'The Japanese name is a translation of the English title. Amounts are in metric units; basil is "a handful" in the source and is recorded without an amount.'),
    T('紫キャベツは辞書の「キャベツ」、小ねぎは「ねぎ」として記録しています。なたね油は「油」です。', 'Red cabbage is recorded as cabbage, spring onions as green onion, and rapeseed oil as cooking oil.'),
    T('トルティーヤ、マスタードパウダー、りんご酢は製品の表示が参照できなかったため、アレルゲンは不明として記録しています。トルティーヤは動物由来も不明で、元のページはヴィーガン向けとしていますが、そのまま採用していません。', 'No labels were found for the tortilla, mustard powder or cider vinegar, so their allergens are recorded as unknown. The tortilla is also unknown for animal origin; the source page calls the dish vegan, but that is not adopted here.'),
    T('保存の注意の一部は農林水産省のお弁当の食中毒予防のページにもとづいています。', 'Part of the storage advice follows the MAFF lunchbox food-poisoning page.'),
  ],
  sources: [
    { id: 'src-bbc-veggie-olive-wraps', publisher: 'Immediate Media Company Ltd (BBC Good Food)', title: 'Veggie olive wraps with mustard vinaigrette recipe | Good Food', url: 'https://www.bbcgoodfood.com/recipes/veggie-olive-wraps-mustard-vinaigrette', accessed: '2026-11-01', language: 'en', usedFor: ['recipe', 'storage'] },
    SRC.maff(),
  ],
};
