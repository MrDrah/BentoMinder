const { I, SRC, T } = require('../lib.cjs');
const SHOYU = { poss: ['alg-wheat', 'alg-soybean'] };
module.exports = {
  id: 'rcp-delish-hanabatake-lion',
  name: T('お花畑ライオン', 'Flower-garden lion bento'),
  shortNameJa: 'ライオン',
  shortNameEn: 'Lion',
  nameKana: 'おはなばたけらいおん',
  style: 'western-inspired',
  themeId: 'theme-animals',
  description: T(
    'カレー風味のソーセージごはんを丸くにぎり、ソーセージのたてがみとチーズ・のりの顔でライオンにして、ピーマンの花の目玉焼きを添えます。',
    'A round curry-flavoured sausage rice ball turned into a lion with a sausage mane and cheese-and-nori face, beside pepper-ring "flowers" with quail eggs.',
  ),
  yield: T('1人分（ごはん150g）', '1 serving (150 g rice)'),
  minutes: 20,
  ingredients: [
    I('ing-sausage', 'ソーセージ', 'sausages', 3, 'piece', { lab: { poss: ['alg-pork'] } }),
    I('ing-rice', 'ごはん（お茶碗1杯）', 'cooked rice (1 rice bowl)', 150, 'g'),
    I('ing-nori', 'のり', 'nori', null, 'to-taste'),
    I('ing-cheese', 'スライスチーズ', 'sliced cheese', null, 'to-taste', { lab: { poss: [] } }),
    I('ing-curry-powder', 'カレー粉', 'curry powder', 0.5, 'tsp', { lab: { poss: [] } }),
    I('ing-soy-sauce', 'しょうゆ', 'soy sauce', 0.5, 'tsp', { lab: SHOYU }),
    I('ing-ketchup', 'ケチャップ', 'ketchup', 0.5, 'tsp', { lab: { poss: [] } }),
    I('ing-green-pepper', 'ピーマン（輪切り2切れ）', 'green pepper (2 rings)', 2, 'piece'),
    I('ing-quail-egg', 'うずらの卵', 'quail eggs', 2, 'piece'),
    I('ing-oil', 'サラダ油', 'cooking oil', 0.5, 'tbsp'),
  ],
  steps: [
    T('ソーセージ1本は両端を落として細かく刻む。ほかの2本には2mm間隔で深めの切れ目を入れる。', 'Trim the ends of one sausage and mince it. Cut deep slits 2 mm apart in the other two.'),
    T('ボウルにごはん、刻んだソーセージ、カレー粉、しょうゆ、ケチャップを入れて混ぜ、ふんわりラップをして600Wで3分温める。', 'Mix the rice, minced sausage, curry powder, soy sauce and ketchup, cover loosely and microwave at 600 W for 3 minutes.'),
    T('ラップに包んで丸くにぎる。', 'Wrap in cling film and shape into a round ball.'),
    T('フライパンに油を薄くのばして熱し、切れ目入りのソーセージとピーマンの輪を並べる。輪のなかへうずら卵を1個ずつ落とし、ふたをかぶせて弱火で火を通す。', 'Heat the oil in a pan, spreading it thin, and set the slit sausages and pepper rings in it. Crack a quail egg into each ring, cover and cook on low.'),
    T('切れ目が開いて卵に火が通ったら弁当箱に詰め、ごはんにチーズとのりを飾ってライオンの顔に仕立てる。', 'When the slits open and the eggs are cooked, pack them and decorate the rice with cheese and nori for the lion face.'),
  ],
  storage: [
    T('お弁当にするときは、卵は半熟にせず、しっかり火を通します。', 'For a lunchbox, cook the eggs fully, never soft or runny.'),
    T('チーズはレンジで20秒ほど（600W）加熱して、粗熱をとってから使います。中心まで十分に温まったか確かめ、時間は加減します。', 'Microwave the cheese about 20 seconds at 600 W and let it cool before using; check it is hot in the middle and adjust the time.'),
    T('十分に冷ましてから詰めます。夏場や梅雨の時期は避け、保冷剤と保冷バッグを使うか冷蔵庫で保管して、早めに食べます。', 'Pack only when fully cool. Avoid the hot, humid season; use an ice pack in a cool bag or the fridge and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けとは書かれていません。分量は変えていません。', 'The source is for 1 serving and does not call itself a child portion; amounts are unchanged.'),
    T('のりとスライスチーズは元のレシピで「適量」です。ピーマンは輪切り2切れ、ソーセージは3本です。', 'Nori and sliced cheese are "as needed" in the source. Pepper is 2 rings and sausages are 3.'),
    T('ソーセージ、カレー粉、しょうゆ、ケチャップ、スライスチーズの原材料は製品で違うため、参照した製品の表示にもとづいて記録しています。使う製品の表示を確認してください。', 'Sausage, curry powder, soy sauce, ketchup and sliced cheese differ by product; they follow the cited labels, so check the labels of the ones you use.'),
  ],
  sources: [
    SRC.delish('src-delish-hanabatake-lion', '初級キャラ弁！ お花畑ライオンのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/171100703702385132'),
    SRC.sausage(),
    SRC.currypowder(),
    SRC.shoyu(),
    SRC.ketchup(),
    SRC.torokeru(),
  ],
};
