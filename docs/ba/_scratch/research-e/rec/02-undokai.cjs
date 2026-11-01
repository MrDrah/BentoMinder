const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-delish-undokai-ouen-onigiri',
  name: T('運動会応援弁当', 'Sports-day cheer rice balls'),
  shortNameJa: '応援おにぎり',
  shortNameEn: 'Cheer',
  nameKana: 'うんどうかいおうえんべんとう',
  style: 'japanese',
  themeId: 'theme-seasonal',
  description: T(
    '丸いおにぎりに、のりで髪・目・口をつけ、かにかまのはちまきを巻いた笑顔のおにぎりです。運動会の日のお弁当向けです。',
    'Round rice balls given nori hair, eyes and mouths and a crab-stick headband. Made for a sports-day lunch.',
  ),
  yield: T('1人分（おにぎり2個）', '1 serving (2 rice balls)'),
  minutes: 30,
  ingredients: [
    I('ing-rice', '白ごはん（お茶碗1杯）', 'cooked white rice (1 rice bowl)', 150, 'g'),
    I('ing-salt', '塩', 'salt', null, 'small-amount'),
    I('ing-nori', '焼きのり', 'toasted nori', null, 'to-taste'),
    I('ing-crab-stick', 'かにかま', 'crab-flavoured fish stick', 1, 'piece'),
  ],
  steps: [
    T('ボウルにごはんと塩を入れて混ぜる。ラップにごはんの半量をのせて包み、丸くにぎる。同じものをもう1個作る。', 'Mix the rice and salt in a bowl. Wrap half of the rice in cling film and shape a round ball; make a second one the same way.'),
    T('焼きのりを切り抜いて、髪2枚、目4枚、口2枚のパーツを作り、おにぎりにのせる。', 'Cut the nori into two pieces of hair, four eyes and two mouths, and place them on the rice balls.'),
    T('かにかまは600Wで20〜30秒温め、中心まで熱くなったか確かめて冷ます。', 'Microwave the crab stick at 600 W for 20 to 30 seconds, check that the middle is hot, then let it cool.'),
    T('かにかまを赤い外側と白い内側に分け、5mm幅に細く裂く。', 'Separate the red outside from the white inside of the crab stick and tear each into 5 mm strips.'),
    T('2色のかにかまをはちまきのようにおにぎりの頭にのせる。好きなおかずと一緒に弁当箱に詰める。', 'Lay the two colours across the head of each ball like a headband. Pack with any sides you like.'),
  ],
  storage: [
    T('かにかまは電子レンジで加熱して、粗熱をとってから使います。', 'Heat the crab stick in the microwave and let it cool a little before using it.'),
    T('十分に冷ましてから詰め、保冷剤や保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Pack only when cool, keep it cold with an ice pack and cool bag or in the fridge, and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、ごはんはお茶碗1杯（150g）から2個作ります。幼児向けの量とは書かれていないので、分量は変えていません。', 'The source is for 1 serving: one bowl (150 g) of rice makes two balls. It does not call itself a child portion, so amounts are unchanged.'),
    T('のりの量は元のレシピで「適量」、塩は「少々」です。パーツの枚数（髪2・目4・口2）は手順に書きました。', 'The source gives the nori as "as needed" and the salt as a pinch; the number of nori pieces (2 hair, 4 eyes, 2 mouths) is in the steps.'),
    T('おかずは元のレシピで指定がなく、好みのものとされています。ここには含めていません。', 'The source leaves the sides to the cook, so none are included here.'),
    T('かにかまは製品によって原材料が違います。参照できるメーカー表示がないため、アレルゲンは不明として記録しています。使う製品の表示を確認してください。', 'Crab sticks differ by product. No manufacturer label was found, so their allergens are recorded as unknown; check the label of the product you use.'),
  ],
  sources: [
    SRC.delish('src-delish-undokai-ouen', 'かけっこ一等賞！ 運動会応援弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/162515636432404972'),
  ],
};
