const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-nhk-jako-yasai-pasta-bento',
  name: T('じゃこと野菜のパスタ弁当', 'Whitebait and vegetable pasta bento'),
  shortNameJa: 'じゃこパスタ',
  shortNameEn: 'Jako',
  nameKana: 'じゃことやさいのぱすたべんとう',
  style: 'western-inspired',
  themeId: null,
  description: T(
    'ちりめんじゃこの塩けとうまみで味つけする、しめじと水菜入りのスパゲッティ弁当。前の晩にパスタをゆでておくこともできます。',
    'A spaghetti bento with shimeji and mizuna, seasoned by the saltiness and savour of dried whitebait. The pasta can even be boiled the night before.',
  ),
  yield: T('1人分', '1 serving'),
  minutes: 20,
  ingredients: [
    I('ing-spaghetti', 'スパゲッティ（あれば1.6mm）', 'spaghetti (1.6 mm if possible)', 100, 'g'),
    I('ing-whitebait', 'ちりめんじゃこ', 'dried whitebait (chirimen-jako)', 15, 'g'),
    I('ing-shimeji', 'しめじ（1/2パック）', 'shimeji mushrooms (1/2 pack)', 50, 'g'),
    I('ing-mizuna', '水菜（1/2株）', 'mizuna (1/2 bunch)', 20, 'g'),
    I('ing-salt', '塩（ゆで湯に小さじ1と1/2、仕上げに小さじ1/2）', 'salt (1 1/2 tsp in the boiling water, 1/2 tsp to finish)', 2, 'tsp'),
    I('ing-olive-oil', 'オリーブ油', 'olive oil', 0.5, 'tbsp'),
    I('ing-pepper', '黒こしょう（粗びき）', 'coarsely ground black pepper', null, 'small-amount'),
  ],
  steps: [
    T('大きめの鍋に水約1Lを入れて強火にかける。しめじは石づきを切って小房にほぐし、水菜は3〜4cm長さに切る。', 'Bring about 1 litre of water to the boil in a large pot. Trim the shimeji and separate into small clusters, and cut the mizuna into 3-4 cm lengths.'),
    T('沸騰したら塩小さじ1と1/2を入れてスパゲッティを沈め、表示どおりにゆでる。', 'When it boils, add 1 1/2 tsp salt, submerge the spaghetti and boil for the time on the packet.'),
    T('オリーブ油を引いたフライパンを中火にかけ、じゃこをカリッとするまで炒めてからしめじを足し、しんなりしたら火を止める。', 'Heat the olive oil in a pan over medium heat, fry the whitebait until crisp, add the shimeji and turn off the heat when they soften.'),
    T('ゆで上げて水けを切ったパスタをフライパンに加えて中火で炒め、油がなじんだら水菜を加える。', 'Add the drained spaghetti to the pan over medium heat, toss until coated in oil, then add the mizuna.'),
    T('塩小さじ1/2と黒こしょうをふってさっと混ぜ、皿に取って冷まし、弁当箱に詰める。', 'Season with 1/2 tsp salt and pepper, toss quickly, move to a plate to cool and pack in the lunchbox.'),
  ],
  storage: [
    T('パスタは皿に広げて冷ましてから弁当箱に詰めます。', 'Spread the pasta on a plate to cool before packing it.'),
    T('前夜にゆでておく場合は、冷蔵庫で保管します。', 'If you boil it the night before, keep it in the fridge.'),
    T('保冷剤と保冷バッグを使うか冷蔵庫に入れて、できるだけ早く食べます。', 'Use an ice pack and a cool bag or keep it in the fridge, and eat it as soon as you can.'),
  ],
  adaptations: [
    T('元のレシピは「大人のパスタ」の1人分（480kcal）で、幼児向けの量や味つけとは書かれていません。分量は元のままです。', 'The source is a 1-serving "adult pasta" (480 kcal) and does not say it is a child portion or seasoning. Amounts are unchanged.'),
    T('塩は小さじ2で、ゆで湯に小さじ1と1/2、仕上げに小さじ1/2です。ちりめんじゃこも塩けがあるので、幼児には量を減らす必要があるかもしれません。', 'Salt is 2 tsp: 1 1/2 tsp in the boiling water and 1/2 tsp to finish. The dried whitebait is salty too, so for a young child you may want less.'),
    T('スパゲッティは製品の表示が見つからなかったため、アレルゲンは「不明」とし、小麦のみ原材料として記録しています。使う製品の表示を確認してください。', 'No label was found for the spaghetti, so its allergen data is recorded as unknown, with only wheat listed as an ingredient. Check the label of the product you use.'),
    T('保存の注意は元のレシピの手順（冷ましてから詰める、前夜にゆでてもよい）にもとづいています。冷蔵庫での保管は農林水産省のお弁当の食中毒予防のページを参照しました。', 'The storage notes follow the source steps (cool before packing; may be boiled the night before). Fridge storage follows the MAFF lunchbox page.'),
  ],
  sources: [
    SRC.nhk('src-nhk-jako-yasai-pasta', 'じゃこと野菜のパスタ弁当 レシピ 髙城 順子さん｜みんなのきょうの料理', 'https://www.kyounoryouri.jp/recipe/17107_じゃこと野菜のパスタ弁当.html', ['recipe', 'storage']),
    SRC.maff(),
  ],
};
