// rank 5: kikkoman-enji-buta-ketchup-bento
const A = '2026-10-25';
const kikkoman = 'キッコーマン株式会社（ホームクッキング）';
export default {
  id: 'rcp-kikkoman-buta-ketchup-bento',
  name: { ja: '豚肉のケチャップ炒め弁当', en: 'Pork and ketchup stir-fry bento' },
  shortNameJa: '豚ケチャップ',
  shortNameEn: 'Pork fry',
  nameKana: 'ぶたにくのけちゃっぷいためべんとう',
  style: 'western-inspired',
  themeId: null,
  description: {
    ja: '片栗粉をまぶした薄切り豚肉を玉ねぎ、パプリカとケチャップ味に炒めた園児用のおかず。レンジで作るさつまいもとりんごの甘煮を添えます。',
    en: 'A kindergarten-size main of thin pork dusted with starch, fried with onion and pepper in a ketchup glaze, with sweet potato and apple cooked in the microwave.',
  },
  minutes: 25,
  ingredients: [
    ['ing-pork', '豚ロース肉（しゃぶしゃぶ用）', 'thinly sliced pork loin (shabu-shabu cut)', 50, 'g'],
    ['ing-onion', '玉ねぎ（薄切り）', 'onion, thinly sliced', 20, 'g'],
    ['ing-paprika', 'パプリカ（黄・薄切り）', 'yellow bell pepper, thinly sliced', 20, 'g'],
    ['ing-oil', 'サラダ油', 'vegetable oil', 1, 'tsp'],
    ['ing-cooking-sake', '料理酒', 'cooking sake', 1, 'tsp'],
    ['ing-potato-starch', '片栗粉', 'potato starch', null, 'small-amount'],
    ['ing-soy-sauce', 'しょうゆ', 'soy sauce', 1, 'tsp', { info: 'varies-by-product', possible: ['alg-wheat', 'alg-soybean'] }],
    ['ing-ketchup', 'トマトケチャップ', 'tomato ketchup', 1, 'tsp', { info: 'known' }],
    ['ing-sweet-potato', 'さつまいも', 'sweet potato', 20, 'g'],
    ['ing-apple', 'りんご', 'apple', 10, 'g'],
    ['ing-sugar', '砂糖', 'sugar', 1, 'tsp'],
  ],
  steps: [
    { ja: '豚肉を3〜4切れに分け、料理酒と片栗粉をからめておきます。', en: 'Cut the pork into 3 or 4 pieces and coat them with the cooking sake and potato starch.' },
    { ja: '小さめのフライパンに油を熱し、中火で豚肉を焼きます。玉ねぎを入れてしんなりするまで炒めます。', en: 'Heat the oil in a small frying pan and cook the pork over medium heat. Add the onion and fry until soft.' },
    { ja: 'パプリカ、しょうゆ、ケチャップ、水大さじ1を加え、水分がなくなるまで炒めてからめます。', en: 'Add the pepper, soy sauce, ketchup and 1 tbsp water, and keep stirring until the liquid has cooked off and coats the meat.' },
    { ja: 'さつまいもは皮つきで厚さ5mmほどのいちょう形に切ります。耐熱ボウルで水にさらし、水けをしっかりきります。', en: 'Leave the skin on the sweet potato and cut it into 5 mm quarter-rounds. Soak them in water in a heatproof bowl, then drain well.' },
    { ja: 'りんごは皮をむき、薄く切ってさつまいもの上に並べます。', en: 'Peel the apple, slice it thinly and lay it over the sweet potato.' },
    { ja: '砂糖と水小さじ1をふり、ラップをふんわりかけて電子レンジ（500W）で1分ほど加熱します。', en: 'Sprinkle with the sugar and 1 tsp water, cover loosely with cling film and microwave at 500 W for about 1 minute.' },
    { ja: 'ラップを中身に密着させるようにかけ直し、そのまま冷まします。汁けをきって詰めます。', en: 'Press the film down onto the food like a drop lid and leave it to cool, then drain and pack.' },
  ],
  storage: [
    { ja: 'さつまいもとりんごの甘煮は、冷めるまで置いてから汁けをきって詰めます。', en: 'Let the sweet potato and apple cool completely, then drain off the syrup before packing.' },
  ],
  adaptations: [
    { ja: '元のレシピがもともと園児のお弁当用の1人分なので、分量はそのままです。元のページによると、作りやすいよう少し多めの量になっています。', en: 'The source is already one kindergarten portion, so amounts are unchanged. The source notes the amounts are a little generous to make cooking easier.' },
    { ja: 'メーカー品（キッコーマンのしょうゆ、デルモンテのケチャップ、マンジョウの料理用清酒）は一般的な食材名にしました。', en: 'Branded products in the source (Kikkoman soy sauce, Del Monte ketchup, Manjo cooking sake) are listed as generic ingredients.' },
    { ja: '水（炒め用大さじ1、甘煮用小さじ1）は材料一覧に含めず、手順に書いています。', en: 'Water (1 tbsp for the stir-fry, 1 tsp for the sweet potato) is given in the steps, not in the ingredient list.' },
    { ja: 'しょうゆは製品によって原材料が違います。アレルギーがある場合は表示を確認してください。ケチャップのアレルゲンは参照した製品表示によります。', en: 'Soy sauce ingredients vary by product; check the label if your child has allergies. The ketchup allergen data come from the product label cited.' },
    { ja: '元のページに主食（ごはん）の記載はありません。調理時間は2品の合計（15分＋10分）です。', en: 'The source lists no rice or other staple. The time is the sum of both dishes (15 + 10 min).' },
  ],
  sources: [
    { id: 'src-kikkoman-buta-ketchup-bento', publisher: kikkoman, title: '豚肉のケチャップ炒め弁当 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/lunch/enji/butaketchup.html', accessed: A, language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-buta-ketchup-enji', publisher: kikkoman, title: '豚肉のケチャップ炒め（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003261/', accessed: A, language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-satsumaimo-ringo-enji', publisher: kikkoman, title: 'さつまいもとりんごの甘煮（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003263/', accessed: A, language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-kikkoman-marudaizu-shoyu', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'キッコーマン 特選 丸大豆しょうゆ | キッコーマン株式会社', url: 'https://www.kikkoman.co.jp/products/K05/detail/K051005.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
    { id: 'src-kikkoman-delmonte-ketchup', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'デルモンテ トマトケチャップ | キッコーマン株式会社', url: 'https://www.kikkoman.co.jp/products/K45/detail/K451000.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
  ],
};
