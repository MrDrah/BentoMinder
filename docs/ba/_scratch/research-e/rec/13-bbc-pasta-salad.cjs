const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-bbc-lunchbox-pasta-salad',
  name: T('ランチボックス・パスタサラダ', 'Lunchbox pasta salad'),
  shortNameJa: 'パスタサラダ',
  shortNameEn: 'Pasta',
  nameKana: 'らんちぼっくすぱすたさらだ',
  style: 'western-inspired',
  themeId: null,
  description: T(
    'ゆでたパスタをバジルペーストであえ、冷めてからマヨネーズとヨーグルト、ゆで野菜、ミニトマトを混ぜて、鶏肉をのせる子ども向けの弁当サラダです。',
    'Cooked pasta tossed in pesto, then mixed with mayonnaise, yogurt, cooked vegetables and cherry tomatoes once cool, topped with chicken: a salad for children\'s lunchboxes.',
  ),
  yield: T('4人分', '4 servings'),
  minutes: 26,
  ingredients: [
    I('ing-macaroni', 'パスタ（ショートパスタなど）', 'pasta', 400, 'g'),
    I('ing-pesto', 'バジルペースト（生タイプ、大さじ4〜5）', 'fresh basil pesto (4 to 5 tbsp)', null, 'to-taste'),
    I('ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 1, 'tbsp', { lab: { poss: ['alg-egg', 'alg-soybean'] } }),
    I('ing-yogurt', 'ギリシャヨーグルト', 'Greek yogurt', 2, 'tbsp'),
    I('ing-lemon', 'レモン（果汁）', 'lemon (juice)', 0.5, 'piece'),
    I('ing-mixed-vegetables', 'ゆでた野菜（グリーンピース、いんげん、ズッキーニなど）', 'cooked mixed vegetables such as peas, green beans and courgette', 200, 'g'),
    I('ing-cherry-tomato', 'ミニトマト（4つ切り）', 'cherry tomatoes, quartered', 100, 'g'),
    I('ing-chicken', '加熱した鶏肉', 'cooked chicken', 200, 'g'),
  ],
  steps: [
    T('パスタを袋の表示どおり、歯ごたえが残る程度に約11分ゆでる。湯をきってボウルに入れ、ペーストを混ぜて冷ます。', 'Cook the pasta in boiling water for about 11 minutes, until it still has some bite (check the pack). Drain, transfer to a bowl, coat with the pesto and leave to cool.'),
    T('さやいんげんとズッキーニは、グリーンピースほどの大きさに細かく切る。', 'Cut the green beans and courgette small, about the size of peas.'),
    T('パスタが冷めたら、マヨネーズ、ヨーグルト、レモン汁、野菜、ミニトマトを混ぜ合わせる。', 'When the pasta has cooled, mix in the mayonnaise, yogurt, lemon juice, vegetables and cherry tomatoes.'),
    T('弁当箱かお皿に盛り、加熱した鶏肉をのせる。持ち運ぶ場合は食べるときまで冷やしておく。', 'Spoon into lunchboxes or onto plates and put the cooked chicken on top. If it is for a packed lunch, chill it until eating.'),
  ],
  storage: [
    T('元のレシピでは、弁当にするときは食べるまで冷やしておくとされています。', 'The source says to chill it until eating if it is for a packed lunch.'),
    T('鶏肉は中心までしっかり火を通したものを使います。生野菜やミニトマトはよく洗い、水けを切ってから混ぜます。', 'Use chicken cooked right through. Wash raw vegetables and cherry tomatoes and drain them before mixing in.'),
    T('保冷剤や保冷バッグで涼しく保ち、早めに食べます。', 'Keep it cool with an ice pack or cool bag and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは4人分で、幼児向けの1人分は書かれていません。分量は元のままです。', 'The source serves 4 and gives no child-sized share. Amounts are unchanged.'),
    T('日本語名は英語の題名を訳したものです。元のレシピのたんぱく質はハム、えび、ゆで卵、チーズでもよいとされていますが、手順で最初に挙げられている鶏肉200gで記録しています。', 'The Japanese name is a translation of the English title. The source also allows ham, prawns, boiled egg or cheese as the protein; this record uses the chicken (200 g) that the method names first.'),
    T('ペーストは元のレシピで大さじ4〜5と幅があるため、量なしとして幅を名前に書きました。ゆで野菜200gは種類ごとの量が書かれていないため、辞書の「ミックスベジタブル」として1行にしています。', 'Pesto is a range (4 to 5 tbsp), so it has no single amount, with the range in the name. The 200 g of cooked vegetables has no per-vegetable amounts, so it is one line using the dictionary\'s mixed-vegetables entry.'),
    T('マヨネーズは味の素「ピュアセレクト」の表示を参照しました。パスタ、バジルペースト、ヨーグルトは製品の表示が参照できなかったため、アレルゲンは不明として記録しています（パスタは小麦、ヨーグルトは乳を含みます）。ペーストは動物由来も不明です。', 'The mayonnaise follows the Ajinomoto Pure Select label. No labels were found for the pasta, pesto or yogurt, so their allergens are recorded as unknown (pasta contains wheat, yogurt milk). The pesto is also unknown for animal origin.'),
    T('パスタは辞書の「マカロニ」として記録しています。', 'Pasta is recorded using the dictionary\'s macaroni entry.'),
  ],
  sources: [
    { id: 'src-bbc-lunchbox-pasta-salad', publisher: 'Immediate Media Company Ltd (BBC Good Food)', title: 'Lunchbox pasta salad recipe | Good Food', url: 'https://www.bbcgoodfood.com/recipes/lunchbox-pasta-salad', accessed: '2026-11-01', language: 'en', usedFor: ['recipe', 'storage'] },
    SRC.mayo(),
    SRC.maff(),
  ],
};
