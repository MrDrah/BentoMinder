const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-nhk-jako-onigiri-misoni-plate',
  name: T('じゃこおにぎりと鶏ひき肉のみそ煮プレート', 'Jako rice balls with chicken and cabbage miso simmer plate'),
  shortNameJa: 'じゃこおにぎり',
  shortNameEn: 'Jako',
  nameKana: 'じゃこおにぎりととりひきにくのみそにぷれーと',
  style: 'japanese',
  themeId: null,
  description: T(
    'ちりめんじゃこ・ごま・青のりを混ぜたおにぎりに、白菜とまいたけと鶏ひき肉をみそで煮た温かいおかずを添えます。',
    'Rice balls mixed with whitebait, sesame and aonori, served with chicken, Chinese cabbage and maitake simmered in miso.',
  ),
  yield: T('2人分（おにぎり4個）', '2 servings (4 rice balls)'),
  minutes: 15,
  ingredients: [
    I('ing-rice', '温かいごはん', 'warm cooked rice', 280, 'g'),
    I('ing-whitebait', 'ちりめんじゃこ', 'dried whitebait (chirimen jako)', 1.5, 'tbsp'),
    I('ing-sesame', '白ごま', 'white sesame seeds', 1, 'tbsp'),
    I('ing-aonori', '青のり粉', 'aonori powder', 1, 'tbsp'),
    I('ing-ground-chicken', '鶏ひき肉', 'ground chicken', 120, 'g'),
    I('ing-chinese-cabbage', '白菜', 'Chinese cabbage', 120, 'g'),
    I('ing-maitake', 'まいたけ', 'maitake mushrooms', 60, 'g'),
    I('ing-miso', 'みそ', 'miso', 2, 'tsp', { lab: { poss: ['alg-soybean'] } }),
    I('ing-green-onion', '細ねぎ（小口切り）', 'thin spring onion, sliced', null, 'small-amount', { optional: true }),
    I('ing-oil', 'サラダ油', 'cooking oil', 1, 'tsp'),
  ],
  steps: [
    T('ボウルにちりめんじゃこ、白ごま、青のりを混ぜて、じゃこふりかけを作る。', 'Mix the whitebait, sesame seeds and aonori in a bowl to make the jako furikake.'),
    T('油をなじませた鍋に鶏ひき肉を入れる。白菜とまいたけは小さめに手でちぎり、鍋に足していく。強めの中火で、肉の塊をくずしつつ火を通す。', 'Oil a pan and add the chicken. Tear in the Chinese cabbage and maitake in small pieces and stir-fry over medium-high heat, breaking up the meat.'),
    T('白菜にこんがり色がついたら、水1/4カップを注いでふたをする。沸いたら火を中火に落とし、3分ほど蒸し煮にする。', 'When the cabbage browns, add 1/4 cup of water and cover. After it boils, simmer over medium heat for about 3 minutes.'),
    T('煮ている間に、温かいごはんにじゃこふりかけをさっくり混ぜる。4等分してラップで包み、好きな形ににぎる。', 'While it simmers, fold the furikake into the warm rice, divide it into four, wrap each in cling film and shape as you like.'),
    T('ふたをはずし、みそを溶かして全体にからめる。汁がなくなったら器に盛り、ねぎをふっておにぎりと並べる。', 'Uncover the pan, stir in the miso until the liquid is gone, and serve with the spring onion on top, alongside the rice balls.'),
  ],
  storage: [
    T('ひき肉は中までしっかり火を通し、煮汁は煮詰めて汁けをなくします。', 'Cook the ground chicken through and boil the sauce down until no liquid is left.'),
    T('お弁当にするときは、ごはんもおかずも十分に冷ましてから詰め、保冷剤などで涼しく保ち、早めに食べます。', 'If you pack this in a lunchbox, cool the rice and the simmered topping fully, keep it cool with an ice pack and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは「ワンプレート朝ごはん」で2人分です。幼児向けの分量とは書かれていないので、2人分のまま記録しています。', 'The source is a one-plate breakfast for 2 servings and does not state a child portion, so it is recorded as 2 servings.'),
    T('水1/4カップは材料表に載せていません（手順に書きました）。細ねぎは元のレシピで「あれば」の少量です。', 'The 1/4 cup of water is in the steps, not the ingredient list. The spring onion is optional in the source.'),
    T('弁当にするための保存の注意は、農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The packing notes follow the MAFF lunchbox food-poisoning page, because the source has no storage advice.'),
  ],
  sources: [
    SRC.nhk('src-nhk-jako-onigiri-misoni-plate', 'じゃこおにぎりと鶏ひき肉のみそ煮プレート レシピ 坂本 佳奈さん｜みんなのきょうの料理', 'https://www.kyounoryouri.jp/recipe/43442_じゃこおにぎりと鶏ひき肉のみそ煮プレート.html'),
    SRC.miso(),
    SRC.maff(),
  ],
};
