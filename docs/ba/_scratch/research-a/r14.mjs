import { i, run, S, SOY } from './lib.mjs';

const KIK = 'キッコーマン株式会社（ホームクッキング）';
run({
  id: 'rcp-kikkoman-niku-yasaimaki-bento',
  name: { ja: '肉の野菜巻き弁当', en: 'Beef-wrapped vegetable bento' },
  shortNameJa: '肉の野菜巻き',
  shortNameEn: 'Beefroll',
  nameKana: 'にくのやさいまきべんとう',
  style: 'japanese',
  themeId: null,
  description: {
    ja: '水菜とにんじん、棒状に切ったチーズを薄切り牛肉で巻き、甘辛いたれを煮からめた肉巻き。赤と黄のパプリカが入ったキャベツのしょうゆあえを添えます。',
    en: 'Thin-sliced beef rolled around mizuna, carrot and a stick of cheese, glazed in a sweet soy sauce, with a side of cabbage and red and yellow pepper dressed with soy sauce.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 30,
  makeAhead: null,
  ingredients: [
    i('ing-beef', '牛肉（薄切り）', 'thinly sliced beef', 1, 'slice'),
    i('ing-cheese', 'プロセスチーズ', 'processed cheese', 10, 'g', { info: 'unknown' }),
    i('ing-mizuna', '水菜', 'mizuna', 20, 'g'),
    i('ing-carrot', 'にんじん', 'carrot', 10, 'g'),
    SOY('しょうゆ（肉巻き用）', 'soy sauce (for the beef rolls)', 1, 'tsp'),
    i('ing-mirin', 'みりん', 'mirin', 2, 'tsp'),
    i('ing-cabbage', 'キャベツ', 'cabbage leaf', 0.5, 'slice'),
    i('ing-salt', '塩', 'salt', null, 'small-amount'),
    i('ing-paprika', 'パプリカ（赤）', 'red bell pepper', 5, 'g'),
    i('ing-paprika', 'パプリカ（黄）', 'yellow bell pepper', 5, 'g'),
    SOY('しょうゆ（副菜用）', 'soy sauce (for the side dish)', null, 'small-amount'),
  ],
  steps: [
    { ja: 'にんじんを細いせん切りにし、水菜と合わせて500Wのレンジで30秒ほど温める。', en: 'Cut the carrot into fine matchsticks and microwave it with the mizuna at 500 W for about 30 seconds.' },
    { ja: 'チーズは7mm角の棒に切る。', en: 'Cut the cheese into a 7 mm square stick.' },
    { ja: '牛肉を広げて野菜とチーズを芯に並べ、はみ出さないようにきっちり巻く。', en: 'Spread out the beef, lay the vegetables and cheese on it as the filling and roll it up tightly so nothing pokes out.' },
    { ja: 'フライパン（フッ素樹脂加工）を温めて肉巻きを入れ、転がしながら全体をこんがり焼く。', en: 'Heat a non-stick frying pan and brown the roll all over, turning it.' },
    { ja: 'しょうゆ小さじ1、みりん小さじ2、水大さじ1を混ぜて回し入れる。肉巻きを転がしてたれをからめ、汁気が残らなくなるまで煮詰める。', en: 'Mix 1 tsp soy sauce, 2 tsp mirin and 1 tbsp water and pour it in. Keep turning the roll in the sauce until no liquid is left.' },
    { ja: '十分に冷めたら一口サイズに切り分け、ピックでとめる。', en: 'Once it has cooled, cut it into bite-size pieces and secure each with a food pick.' },
    { ja: '副菜を作る。キャベツを短めのせん切りにして塩少々をまぶし、しんなりしてきたら、ぎゅっと水気をしぼる。', en: 'For the side dish, shred the cabbage into short strips, toss with a pinch of salt and, once it softens, squeeze out the liquid firmly.' },
    { ja: 'パプリカは赤と黄とも長さ2～3cm、幅5mmの細切りにし、キャベツと合わせてしょうゆ少々であえる。', en: 'Cut both peppers into strips 2–3 cm long and 5 mm wide, combine with the cabbage and dress with a dash of soy sauce.' },
  ],
  storage: [
    { ja: '肉巻きは中まで火を通し、たれは汁気がなくなるまで煮詰めます。切るのは冷めてからにします。', en: 'Cook the beef roll through and reduce the sauce until no liquid is left. Slice it only after it has cooled.' },
    { ja: 'キャベツは水気をしっかりしぼってから詰めます。', en: 'Squeeze the cabbage well before packing it.' },
  ],
  adaptations: [
    { ja: '分量は元のレシピ（幼稚園児1人分）のままです。調理時間は2品の時間（20分＋10分）を合計しました。', en: 'Amounts are as in the source (one kindergarten child). The time is the sum of the two dishes (20 + 10 minutes).' },
    { ja: '銘柄指定のしょうゆ・みりんは、一般的なしょうゆ・みりんとして記載しました。水大さじ1は手順に記載しています。', en: 'The branded soy sauce and mirin are listed as ordinary soy sauce and mirin. The 1 tbsp water is given in the steps.' },
  ],
  sources: [
    { id: 'src-kikkoman-niku-yasaimaki-bento', publisher: KIK, title: '肉の野菜巻き弁当 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/lunch/enji/nikuyasaimaki.html', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-yasai-cheese-gyuniku-maki', publisher: KIK, title: '野菜とチーズの牛肉巻き（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00002988/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-kikkoman-cabbage-shoyu-ae', publisher: KIK, title: 'キャベツのほんのりしょうゆ和え（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00002989/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    S.soy,
    S.maff,
  ],
});
