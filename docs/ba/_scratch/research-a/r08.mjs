import { i, run, S, SOY } from './lib.mjs';

const KIK = 'キッコーマン株式会社（ホームクッキング）';
run({
  id: 'rcp-kikkoman-tuna-tamago-soboro-bento',
  name: { ja: 'ツナと卵のそぼろご飯弁当', en: 'Tuna and egg soboro rice bento' },
  shortNameJa: 'ツナ卵そぼろ',
  shortNameEn: 'Tuna egg',
  nameKana: 'つなとたまごのそぼろごはんべんとう',
  style: 'japanese',
  themeId: null,
  description: {
    ja: '電子レンジだけで作るツナのそぼろといり卵を、ご飯の上に並べた2色のそぼろご飯。塩でしんなりさせたキャベツでハムを巻いた一品を添えます。',
    en: 'Two-colour soboro rice: tuna flakes and scrambled egg, both made in the microwave, laid over rice. On the side, ham rolled up in a salted, softened cabbage leaf.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 15,
  makeAhead: null,
  ingredients: [
    i('ing-canned-tuna', 'ツナ缶（小）', 'canned tuna (small can)', 0.5, 'piece', { info: 'unknown' }),
    SOY('しょうゆ', 'soy sauce', 0.5, 'tsp'),
    i('ing-sugar', '砂糖（ツナ用）', 'sugar (for the tuna)', 0.5, 'tsp'),
    i('ing-potato-starch', '片栗粉', 'potato starch', null, 'small-amount'),
    i('ing-egg', '卵', 'egg', 1, 'piece'),
    i('ing-sugar', '砂糖（卵用）', 'sugar (for the egg)', 1, 'tsp'),
    i('ing-salt', '塩', 'salt', null, 'small-amount'),
    i('ing-rice', 'ご飯', 'cooked rice', 100, 'g'),
    i('ing-cabbage', 'キャベツ', 'cabbage leaf', 1, 'slice'),
    i('ing-ham', 'ハム', 'ham', 1, 'slice', { info: 'unknown' }),
  ],
  steps: [
    { ja: 'ツナは缶汁を軽くきってほぐし、耐熱容器に入れる。しょうゆと砂糖を小さじ1/2ずつ、片栗粉を少々加えて軽く混ぜる。', en: 'Lightly drain the tuna, flake it into a heatproof container and stir in 1/2 tsp each of soy sauce and sugar and a pinch of potato starch.' },
    { ja: 'ラップをふんわりかけ、500Wのレンジで40秒ほど加熱する。箸でよく混ぜ、なめらかなそぼろ状にする。', en: 'Cover loosely with cling film and microwave at 500 W for about 40 seconds. Mix well with chopsticks into a smooth, fine crumble.' },
    { ja: '卵を溶いて塩少々と砂糖小さじ1を混ぜ、500Wのレンジで合計1分30秒ほど加熱する。途中で一度出して小さめの泡立て器でかき混ぜ、様子を見ながら続ける。', en: 'Beat the egg with a pinch of salt and 1 tsp sugar and microwave at 500 W for about 1 1/2 minutes in total, taking it out once halfway to whisk with a small whisk and watching it as it cooks.' },
    { ja: '加熱が終わったらもう一度よく混ぜ、中まで固まったいり卵にする。', en: 'Whisk again when it is done, so you have scrambled egg that is set all the way through.' },
    { ja: 'キャベツは芯を除いて皿に置き、塩少々をふる。ラップをふんわりかけて、500Wで30秒ほど温める。', en: 'Cut the hard core out of the cabbage leaf, put it on a plate and sprinkle with a pinch of salt. Cover loosely and microwave at 500 W for about 30 seconds.' },
    { ja: 'キャベツをしっかり冷まして水気をふき取り、ハムを重ねてくるりと巻いて、食べやすい幅に切る。', en: 'Let the cabbage cool completely and pat it dry, lay the ham on it, roll it up and slice into easy pieces.' },
    { ja: 'ご飯をお弁当箱に詰めてツナそぼろといり卵をのせ、ハムのキャベツ巻きを添える。', en: 'Pack the rice, top it with the tuna and egg, and add the cabbage and ham rolls.' },
  ],
  storage: [
    { ja: 'いり卵は半熟の部分を残さず、全体がしっかり固まるまで加熱します。', en: 'Cook the scrambled egg until it is completely set, with no soft parts left.' },
    { ja: 'キャベツは熱がすっかり取れるまで冷まし、水気をふいてからハムを巻きます。', en: 'Let the cabbage cool completely and dry it before rolling the ham.' },
    { ja: 'ハムは加熱せずに巻くレシピです。農林水産省は、そのまま食べられるハムなども、できるだけ加熱して使うようすすめています。', en: 'This recipe uses the ham unheated. Japan\'s Ministry of Agriculture advises heating even ready-to-eat foods such as ham for bentos where possible.' },
  ],
  adaptations: [
    { ja: '分量は元のレシピ（幼稚園児1人分）のままです。調理時間は2品の時間（10分＋5分）を合計しました。', en: 'Amounts are as in the source (one kindergarten child). The time is the sum of the two dishes (10 + 5 minutes).' },
    { ja: '銘柄指定のしょうゆは一般的なしょうゆとして記載しました。ツナ缶（小）1/2缶は「0.5個」として記録しています。', en: 'The branded soy sauce is listed as ordinary soy sauce. Half a small can of tuna is recorded as 0.5 piece.' },
  ],
  sources: [
    { id: 'src-kikkoman-tuna-tamago-soboro-bento', publisher: KIK, title: 'ツナと卵のそぼろご飯弁当 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/lunch/enji/tunatamagosoboro.html', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-tuna-tamago-soboro-gohan', publisher: KIK, title: 'ツナと卵のそぼろご飯（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003042/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-kikkoman-cabbage-ham-roll', publisher: KIK, title: 'キャベツのハムロール（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003043/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    S.soy,
    S.maff,
  ],
});
