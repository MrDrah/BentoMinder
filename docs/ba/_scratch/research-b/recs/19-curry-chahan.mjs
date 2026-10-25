// rank 19: house-hajimete-curry-chahan
const A = '2026-10-25';
const house = 'ハウス食品株式会社';
export default {
  id: 'rcp-house-hajimete-curry-chahan',
  name: { ja: '＜特定原材料８品目不使用＞はじめて食べるカレーチャーハン', en: 'First curry fried rice (made without the 8 specified allergens)' },
  shortNameJa: 'カレー炒飯',
  shortNameEn: 'Curry',
  nameKana: 'とくていげんざいりょうはちひんもくふしようはじめてたべるかれーちゃーはん',
  style: 'other',
  themeId: null,
  description: {
    ja: '細かく刻んだ豚肉と彩り野菜を炒め、小麦・乳・卵などを使わずに作られた子ども向けの顆粒カレールウで味をつけた、甘口のカレー炒めごはんです。',
    en: 'Mild curry fried rice with finely chopped pork and colourful vegetables, flavoured with a children\'s granulated curry roux made without wheat, milk, egg and the other specified allergens.',
  },
  minutes: 15,
  ingredients: [
    ['ing-curry-roux', '特定原材料8品目不使用の子ども向けカレールウ（顆粒）1/3袋', 'children\'s curry roux granules made without the 8 specified allergens (1/3 sachet)', 7, 'g', { info: 'varies-by-product', possible: ['alg-pork', 'alg-apple'], origin: ['pork'], originKnown: true }],
    ['ing-pork', '豚もも肉（こま切れ）', 'pork leg, small cuts', 7, 'g'],
    ['ing-onion', '玉ねぎ', 'onion', 10, 'g'],
    ['ing-carrot', 'にんじん', 'carrot', 7, 'g'],
    ['ing-paprika', 'パプリカ（赤）', 'red bell pepper', 7, 'g'],
    ['ing-green-beans', 'さやいんげん', 'green beans', 7, 'g'],
    ['ing-corn', 'コーン（缶詰または冷凍）', 'sweetcorn (canned or frozen)', 7, 'g'],
    ['ing-rice', 'ごはん', 'cooked rice', 120, 'g'],
    ['ing-oil', 'サラダ油', 'vegetable oil', 1, 'tsp'],
  ],
  steps: [
    { ja: 'にんじん、玉ねぎ、パプリカ、いんげん、豚肉は、どれも細かいみじん切りにします。', en: 'Finely chop the pork, onion, carrot, pepper and green beans.' },
    { ja: 'フライパンに油を温め、まず豚肉と玉ねぎ、にんじんを火が通るまでしっかり炒めます。', en: 'Heat the oil in a frying pan and fry the pork, onion and carrot until cooked through.' },
    { ja: 'パプリカ、いんげん、汁けをきったコーンを入れ、さっと炒め合わせます。', en: 'Add the pepper, green beans and drained corn and stir-fry briefly.' },
    { ja: '一度火を止め、カレールウを少量ずつふり入れて全体に混ぜます。', en: 'Turn off the heat, sprinkle in the curry granules a little at a time and mix everything.' },
    { ja: 'ごはんを加えて再び中火にかけ、全体が同じ色になるまで炒めます。', en: 'Add the rice, put the pan back on medium heat and fry until the colour is even all through.' },
  ],
  storage: [
    { ja: '小さな子が食べやすいように具は小さく刻み、ごはんとよくなじませます。', en: 'Cut the fillings small and mix them well into the rice so a young child can eat it easily.' },
  ],
  adaptations: [
    { ja: '元のレシピ（3人分＝大人2人と幼児1人）を1/3にし、ごはん120gの1人分にしました。少量の材料は1/3量（約6.7g）を7gに丸め、ルウは1袋20gの1/3、サラダ油は大さじ1の1/3（小さじ1）です。', en: 'The source (3 servings: 2 adults and 1 small child) is scaled to 1/3, one portion with 120 g rice. Small amounts (1/3 = about 6.7 g) are rounded to 7 g; the roux is 1/3 of a 20 g sachet and the oil 1/3 of 1 tbsp (1 tsp).' },
    { ja: 'さやいんげんは元の表記で2本（20g）で、その1/3を重さで書いています。', en: 'The green beans are 2 beans (20 g) in the source; 1/3 of that is given by weight.' },
    { ja: '元のレシピで指定されたハウス食品の商品は、「特定原材料8品目不使用の子ども向けカレールウ」として一般名にしました。参照した製品表示のアレルゲンは豚肉とりんごです。製品によって原材料が違うので、必ず表示を確認してください。', en: 'The House Foods product named in the source is listed generically as a children\'s curry roux made without the 8 specified allergens. The label cited declares pork and apple. Ingredients differ between products, so always check the label.' },
    { ja: '参照した表示では、カシューナッツは「特定原材料に準ずるもの」の欄にあり、含まれていません。義務表示が9品目になる前の表記です。', en: 'On the label cited, cashew is listed among the recommended items and is not contained; the label predates cashew becoming mandatory (9 items).' },
  ],
  sources: [
    { id: 'src-house-hajimete-curry-chahan', publisher: house, title: '＜特定原材料８品目不使用＞はじめて食べるカレーチャーハン | レシピ | ハウス食品', url: 'https://housefoods.jp/recipe/rcp_00020456.html', accessed: A, language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-house-hajimete-vermont-curry', publisher: house, title: '特定原材料8品目不使用 はじめて食べるバーモントカレー | 商品カタログトップ | ハウス食品', url: 'https://housefoods.jp/products/catalog/cd_1,091850.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
  ],
};
