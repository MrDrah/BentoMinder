// rank 10: nhk-juicy-hamberg-bento
const A = '2026-10-25';
export default {
  id: 'rcp-nhk-juicy-hamburg-bento',
  name: { ja: 'ジューシーハンバーグ弁当', en: 'Juicy hamburger steak bento' },
  shortNameJa: 'ハンバーグ',
  shortNameEn: 'Hamburg',
  nameKana: 'じゅーしーはんばーぐべんとう',
  style: 'western-inspired',
  themeId: null,
  description: {
    ja: 'すりおろしにんじん入りで冷めても柔らかい小さなハンバーグに、はちみつをからめたかぼちゃとおかかキャベツを合わせた子ども弁当です。',
    en: 'Small hamburger patties made moist with grated carrot stay soft when cold; served with honey-glazed pumpkin and cabbage dressed with bonito flakes.',
  },
  minutes: 30,
  ingredients: [
    ['ing-ground-mixed', '合いびき肉', 'mixed ground beef and pork', 30, 'g'],
    ['ing-bread-crumbs', 'パン粉', 'panko breadcrumbs', 1, 'tbsp', { info: 'unknown' }],
    ['ing-carrot', 'にんじん（すりおろし）', 'carrot, grated', 1, 'tbsp'],
    ['ing-milk', '牛乳', 'milk', 1, 'tsp'],
    ['ing-salt', '塩', 'salt', null, 'small-amount'],
    ['ing-oil', 'サラダ油（ハンバーグ用）', 'vegetable oil (for the patties)', 1, 'tsp'],
    ['ing-ketchup', 'トマトケチャップ', 'tomato ketchup', 0.5, 'tsp', { info: 'known' }],
    ['ing-pumpkin', 'かぼちゃ（3cm角1切れ）', 'kabocha squash (one 3 cm cube)', 25, 'g'],
    ['ing-honey', 'はちみつ', 'honey', 1, 'tsp'],
    ['ing-oil', 'サラダ油（かぼちゃ用）', 'vegetable oil (for the pumpkin)', 1.5, 'tbsp'],
    ['ing-cabbage', 'キャベツ（1/3枚）', 'cabbage (1/3 leaf)', 20, 'g'],
    ['ing-bonito-flakes', '削り節（ひとつまみ）', 'bonito flakes (a pinch)', null, 'small-amount'],
    ['ing-soy-sauce', 'しょうゆ', 'soy sauce', null, 'small-amount', { info: 'varies-by-product', possible: ['alg-wheat', 'alg-soybean'] }],
  ],
  steps: [
    { ja: 'パン粉、すりおろしたにんじん、牛乳を混ぜ、なじませておきます。', en: 'Mix the panko with the grated carrot and milk and let it soak in.' },
    { ja: 'ボウルにひき肉と1を入れ、塩を加えて粘りが出るまで練ります。3つに分けて楕円形にし、真ん中を軽くへこませます。', en: 'Put the mince and the panko mix in a bowl, add the salt and knead until sticky. Shape into 3 small ovals and press a dip in the middle of each.' },
    { ja: 'フライパンに油小さじ1を中火で温めてハンバーグを並べ、弱火にして両面に焼き色がつくまで4分ほど焼きます。', en: 'Warm 1 tsp oil in a frying pan over medium heat, add the patties, turn the heat down and cook for about 4 minutes until browned on both sides.' },
    { ja: 'おかずカップにケチャップを敷き、ハンバーグをのせます。', en: 'Spread the ketchup in a small paper cup and set the patties on top.' },
    { ja: 'かぼちゃは種とわたを取り、厚さ5mmほどのいちょう形に切ります。', en: 'Scoop out the seeds and pulp of the pumpkin and cut it into quarter-rounds about 5 mm thick.' },
    { ja: 'フライパンに油大さじ1と1/2を中火で温め、傾けて油を片側に集めます。かぼちゃを入れたら弱火にし、両面を2〜3分焼きます。油をしっかりきり、はちみつをからめます。', en: 'Heat 1.5 tbsp oil over medium heat and tilt the pan so the oil pools at one side. Add the pumpkin, lower the heat and cook both sides for 2 to 3 minutes. Drain well and coat with the honey.' },
    { ja: 'キャベツはさっとゆで、水けを固く絞ってから細かく切ります。削り節としょうゆであえます。', en: 'Blanch the cabbage briefly, squeeze out the water firmly, chop it small and toss with the bonito flakes and soy sauce.' },
  ],
  storage: [
    { ja: 'ゆでたキャベツはよく水けを取り、小さな子でも口に入れやすい大きさに刻んでから詰めます。', en: 'Squeeze the boiled cabbage well and cut it small so a young child can eat it easily.' },
  ],
  adaptations: [
    { ja: '元のレシピがもともと1人分の子ども弁当なので、分量はそのままです。', en: 'The source is already one child-size bento, so amounts are unchanged.' },
    { ja: 'パン粉は製品ごとに原材料（小麦、卵、乳など）が違い、参照できる表示がないため、アレルゲンと動物性原料は「不明」としています。使う製品の表示を確認してください。', en: 'Panko ingredients (wheat, egg, milk and so on) vary by product and no label was cited, so its allergens and animal origin are recorded as unknown. Check the label of the product you use.' },
    { ja: 'しょうゆは製品によって原材料が違います。アレルギーがある場合は表示を確認してください。ケチャップのアレルゲンは参照した製品表示によります。', en: 'Soy sauce ingredients vary by product; check the label if your child has allergies. The ketchup allergen data come from the product label cited.' },
  ],
  sources: [
    { id: 'src-nhk-juicy-hamburg-bento', publisher: 'NHKエデュケーショナル（みんなのきょうの料理）', title: 'ジューシーハンバーグ弁当 レシピ 上田 淳子さん｜みんなのきょうの料理', url: 'https://www.kyounoryouri.jp/recipe/7844_%E3%82%B8%E3%83%A5%E3%83%BC%E3%82%B7%E3%83%BC%E3%83%8F%E3%83%B3%E3%83%90%E3%83%BC%E3%82%B0%E5%BC%81%E5%BD%93.html', accessed: A, language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-kikkoman-marudaizu-shoyu', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'キッコーマン 特選 丸大豆しょうゆ | キッコーマン株式会社', url: 'https://www.kikkoman.co.jp/products/K05/detail/K051005.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
    { id: 'src-kikkoman-delmonte-ketchup', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'デルモンテ トマトケチャップ | キッコーマン株式会社', url: 'https://www.kikkoman.co.jp/products/K45/detail/K451000.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
  ],
};
