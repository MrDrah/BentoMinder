const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-bbc-super-salad-wraps',
  name: T('スーパーサラダラップ', 'Super-salad wraps'),
  shortNameJa: 'サラダラップ',
  shortNameEn: 'Wrap',
  nameKana: 'すーぱーさらだらっぷ',
  style: 'western-inspired',
  themeId: null,
  description: T(
    'トルティーヤにフムスをぬり、レタス、にんじん、きゅうり、トマト、チェダーチーズをのせて巻く、5分でできる野菜たっぷりのラップです。',
    'A 5-minute veggie wrap: a tortilla spread with hummus, then lettuce, carrot, cucumber, tomato and cheddar, rolled up.',
  ),
  yield: T('1人分', '1 serving'),
  minutes: 5,
  ingredients: [
    I('ing-tortilla', 'トルティーヤ', 'tortilla', 1, 'piece'),
    I('ing-hummus', 'フムス', 'hummus', 2, 'tbsp'),
    I('ing-lettuce', 'レタスの葉', 'lettuce leaf', 1, 'piece'),
    I('ing-carrot', 'にんじん（せん切りかすりおろし）', 'carrot (shredded or grated)', 0.25, 'piece'),
    I('ing-cucumber', 'きゅうりのスティック', 'cucumber sticks', 4, 'piece'),
    I('ing-tomato', 'トマト（フレッシュトマトサルサまたは刻んだトマト）', 'tomato (fresh tomato salsa or chopped tomatoes)', 1, 'tbsp'),
    I('ing-cheese', 'チェダーチーズ（すりおろし）', 'grated cheddar', null, 'small-amount'),
  ],
  steps: [
    T('トルティーヤを板の上に広げ、手前の3分の1にフムスをぬってレタスをのせる。', 'Lay the tortilla flat on a board, spread hummus over the nearest third and put the lettuce on it.'),
    T('レタスの上ににんじんときゅうりを重ね、トマトをのせて、チーズをふる。', 'Pile the carrot and cucumber on the lettuce, add the tomato and sprinkle with cheese.'),
    T('手前を具の上に折り返し、両側を折りたたんで、最後まで巻く。', 'Fold the near edge up over the filling, tuck in the sides and roll all the way up.'),
    T('半分か食べやすい大きさに切り、そのまま弁当箱に入れる。半分に切った場合は、先にワックスペーパーで包む。', 'Cut in half or into pieces and put it straight into the lunchbox; if halved, wrap it first in wax paper.'),
  ],
  storage: [
    T('半分に切ったラップは、先にワックスペーパーで包んでから弁当箱に入れます。', 'If the wrap is halved, wrap it in wax paper before it goes into the lunchbox.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、できるだけ早く食べます。生野菜は洗って水けをよく切ってから使います。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat it as soon as you can. Wash the raw vegetables and drain them well first.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、子ども向けのお弁当として紹介されています。分量は元のままです。', 'The source is for 1 serving and is presented as a lunchbox idea for children. Amounts are unchanged.'),
    T('元のレシピは「きゅうりのスティック4本かアボカド2切れ」とあり、ここではきゅうりを記録しています。トマトも「サルサか刻んだトマト」で、トマト大さじ1として記録しました。チーズは「ひとつかみ」のため適量です。', 'The source says 4 cucumber sticks and/or 2 avocado slices; cucumber is recorded here. The tomato is "salsa or chopped tomatoes" and is recorded as 1 tbsp tomato. The cheese is "a handful", so it is an unspecified amount.'),
    T('トルティーヤ、フムス、チェダーチーズは製品の表示が見つからなかったため、アレルゲンは「不明」、トルティーヤの動物由来も「不明」として記録しています。使う製品の表示を必ず確認してください。', 'No labels were found for the tortilla, hummus or cheddar, so their allergen data are unknown and the tortilla animal origin is unknown. Always check the labels of the products you use.'),
    T('元のレシピは英語のページで、日本語名は翻訳です。保存の注意は農林水産省のお弁当の食中毒予防のページも参照しました。', 'The source is an English page, so the Japanese name is a translation. Storage notes also follow the MAFF lunchbox food-poisoning page.'),
  ],
  sources: [
    { id: 'src-bbc-super-salad-wraps', publisher: 'Immediate Media Company Ltd (BBC Good Food)', title: 'Super-salad wraps recipe | Good Food', url: 'https://www.bbcgoodfood.com/recipes/super-salad-wraps', accessed: '2026-11-01', language: 'en', usedFor: ['recipe', 'storage'] },
    SRC.maff(),
  ],
};
