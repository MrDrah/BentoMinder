import { i, run, S } from './lib.mjs';

const DK = 'デリッシュキッチン (every, Inc.)';
run({
  id: 'rcp-delish-penguin-onigirazu-bento',
  name: { ja: 'ペンギンおにぎらず弁当', en: 'Penguin onigirazu bento' },
  shortNameJa: 'ペンギン弁当',
  shortNameEn: 'Penguin',
  nameKana: 'ぺんぎんおにぎらずべんとう',
  style: 'japanese',
  themeId: 'theme-sea',
  description: {
    ja: 'レンジで作る卵をはさんだおにぎらずを半分に切り、のりの目とケチャップのほっぺでペンギンの顔に。コーンを留めた花形ウインナーと、かぼちゃのごまあえを添えます。',
    en: 'An onigirazu (folded rice sandwich) filled with microwave omelette, cut in half and given penguin faces with nori eyes and ketchup cheeks. With flower-cut sausages holding corn kernels and pumpkin dressed with ground sesame.',
  },
  yield: { ja: '1人分（元のレシピの量）', en: '1 serving (source amounts)' },
  minutes: 15,
  makeAhead: null,
  ingredients: [
    i('ing-rice', '白ごはん（どんぶり1杯）', 'cooked white rice (1 large bowl)', 200, 'g'),
    i('ing-egg', '卵', 'egg', 1, 'piece'),
    i('ing-milk', '牛乳', 'milk', 1, 'tbsp'),
    i('ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 0.5, 'tbsp', { info: 'varies', possible: ['alg-egg', 'alg-soybean'] }),
    i('ing-nori', 'のり', 'nori', 1, 'sheet'),
    i('ing-ketchup', 'ケチャップ', 'tomato ketchup', null, 'small-amount'),
    i('ing-sausage', 'ウインナー', 'wiener sausages', 3, 'stick', { info: 'unknown' }),
    i('ing-corn', 'コーン（冷凍）', 'frozen sweetcorn kernels', 6, 'piece'),
    i('ing-pumpkin', 'かぼちゃ（角切り4個）', 'kabocha squash (4 cubes)', 80, 'g'),
    i('ing-sugar', '砂糖', 'sugar', 1, 'tsp'),
    i('ing-salt', '塩（ひとつまみ）', 'salt (a pinch)', null, 'small-amount'),
    i('ing-sesame', '白すりごま', 'ground white sesame seeds', 1, 'tbsp'),
  ],
  steps: [
    { ja: '深さのある四角い耐熱容器で卵を溶き、牛乳とマヨネーズをよく混ぜ込む。600Wのレンジで1分（500Wなら1分30秒）加熱する。', en: 'Beat the egg in a deep, square heatproof container and mix in the milk and mayonnaise thoroughly. Microwave at 600 W for 1 minute (1 1/2 minutes at 500 W).' },
    { ja: '卵をラップの上に出してきっちり包み、2～3分そのままおいて形をなじませる。', en: 'Turn the egg out onto cling film, wrap it tightly and leave it for 2–3 minutes to settle into shape.' },
    { ja: 'のりの端を切り取り、その切れ端で目を作る。', en: 'Trim a strip off the edge of the nori and cut the eyes from it.' },
    { ja: 'ラップにのりを置き、ごはんの半量、卵、残りのごはんの順に重ねて包む。形を整えて5分ほどおき、半分に切る。', en: 'Lay the nori on cling film and stack half the rice, the egg and the rest of the rice on it, then fold it up. Shape it, leave it for about 5 minutes and cut it in half.' },
    { ja: '切り口に目をつけ、ほっぺの位置にケチャップを少しのせてペンギンにする。', en: 'Stick the eyes on the cut faces and dab on a little ketchup for cheeks to make two penguins.' },
    { ja: 'ウインナーとコーンを耐熱皿にのせてラップをふんわりかけ、600Wで1分30秒（500Wなら2分）加熱する。', en: 'Put the sausages and corn on a heatproof plate, cover loosely with cling film and microwave at 600 W for 1 1/2 minutes (2 minutes at 500 W).' },
    { ja: 'ウインナーを半分に切り、切り口に放射状の切り込みを3本入れて、中心にコーンをはさむ。', en: 'Cut each sausage in half, make three crossing cuts in the cut end like a star and tuck a corn kernel into the centre.' },
    { ja: 'かぼちゃを耐熱容器に入れてラップをふんわりかけ、600Wで4分（500Wなら5分）加熱する。砂糖、塩ひとつまみ、すりごまを加えて混ぜる。', en: 'Put the squash in a heatproof container, cover loosely and microwave at 600 W for 4 minutes (5 minutes at 500 W). Mix in the sugar, a pinch of salt and the ground sesame.' },
  ],
  storage: [
    { ja: '卵は中まで固まっていることを確かめてから、ごはんにはさみます。', en: 'Check that the egg is set all the way through before putting it in the rice.' },
    { ja: '小さな子どもが食べるときは、のどに詰まらせないよう、落ち着いて食べることに集中させましょう。', en: 'When small children eat this, have them sit calmly and focus on eating so they do not choke.' },
  ],
  adaptations: [
    { ja: '分量は元のレシピの1人分のままです（ごはん200g）。電子レンジの加熱時間がこの分量で書かれているため、減らしていません。', en: 'Amounts are the source\'s single serving (200 g rice). They are not reduced because the microwave times are given for these amounts.' },
  ],
  sources: [
    { id: 'src-delish-penguin-onigirazu-bento', publisher: DK, title: 'お子さま大喜び！ ペンギンおにぎらず弁当のレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/159623626746757523', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    S.mayo,
    S.ketchup,
    S.maff,
  ],
});
