// rank 18: bbc-cheesy-black-bean-quesadillas
const A = '2026-10-25';
export default {
  id: 'rcp-bbc-black-bean-quesadilla',
  name: { ja: 'チーズとブラックビーンズのケサディーヤ', en: 'Cheesy black bean quesadillas' },
  shortNameJa: '豆ケサディヤ',
  shortNameEn: 'Quesa',
  nameKana: 'ちーずとぶらっくびーんずのけさでぃーや',
  style: 'western-inspired',
  themeId: null,
  description: {
    ja: 'つぶした黒いんげん豆にチーズ、青ねぎ、パクチー、スパイスを混ぜてトルティーヤにはさみ、焼いてくし形に切る、肉を使わない一品です。',
    en: 'A meat-free wrap: mashed black beans mixed with cheese, spring onion, coriander and mild spices, folded inside a tortilla, toasted in a pan and cut into wedges.',
  },
  yield: { ja: '幼児1〜2人分（トルティーヤ1枚分）', en: '1 to 2 child portions (one tortilla)' },
  minutes: 25,
  ingredients: [
    ['ing-black-beans', '黒いんげん豆（ブラックビーンズ）の水煮缶', 'canned black beans', 200, 'g'],
    ['ing-cheese', 'チェダーチーズ', 'cheddar cheese', 25, 'g', { info: 'unknown' }],
    ['ing-green-onion', '青ねぎ（スプリングオニオン）', 'spring onion', 1, 'stick'],
    ['ing-coriander-leaf', 'パクチー（香菜）', 'fresh coriander', null, 'small-amount'],
    ['ing-cumin', 'クミンパウダー', 'ground cumin', 0.13, 'tsp'],
    ['ing-paprika', 'スモークパプリカ（パウダー）', 'smoked paprika (ground)', 0.25, 'tsp'],
    ['ing-salt', '塩こしょう', 'salt and pepper', null, 'small-amount'],
    ['ing-tortilla', 'トルティーヤ（大）', 'large tortilla wrap', 1, 'sheet', { info: 'unknown' }],
  ],
  steps: [
    { ja: '豆をざるにあけて缶の汁を捨て、流水で洗ってよく水けをきり、ボウルに移します。', en: 'Tip the beans into a sieve, let the can liquid run off, rinse under the cold tap, drain well and put them in a bowl.' },
    { ja: 'ポテトマッシャーで、粒が少し残るくらいにつぶします。', en: 'Crush them with a potato masher, leaving some lumps.' },
    { ja: 'チーズをおろし金ですりおろし、豆に加えます。', en: 'Grate the cheese and stir it into the beans.' },
    { ja: '青ねぎは外側の薄皮をむき、根と葉先2cmほどを切り落とします。キッチンばさみで豆粒くらいに刻み、ボウルに入れます。', en: 'Peel off the thin outer layer of the spring onion and trim the root and about 2 cm of the green tip. Snip it with scissors into pea-size bits and add to the bowl.' },
    { ja: 'パクチーは茎も一緒にはさみで細かく切って加えます。クミンとパプリカを入れ、塩こしょうで味をととのえて混ぜます。', en: 'Snip the coriander finely, stalks included, and add it. Add the cumin and paprika, season with salt and pepper and stir well.' },
    { ja: 'トルティーヤの片側半分だけに具を平らに広げ、本を閉じるように二つ折りにして半月形にします。', en: 'Spread the filling evenly over just one half of the tortilla, then fold the other half over like closing a book to make a half-moon.' },
    { ja: '中くらいのフライパンに入れて弱めの中火にかけます。2分ほどして裏に焼き色がついたら返し、反対側も2〜4分焼きます。', en: 'Put it in a medium frying pan over medium-low heat. After about 2 minutes, once the underside is golden, flip it and toast the other side for 2 to 4 minutes.' },
    { ja: '火を止めてまな板に移し、ピザカッターか包丁でくし形に切ります。', en: 'Turn off the heat, slide it onto a board and cut it into wedges with a pizza wheel or knife.' },
  ],
  storage: [
    { ja: '焼きたてのケサディーヤは温かいまま詰めず、冷ましてからお弁当箱に入れます。', en: 'Do not pack the quesadilla while it is still hot; let it cool before it goes into the lunchbox.' },
  ],
  adaptations: [
    { ja: '元のレシピ（2〜4人分、トルティーヤ2枚）を1/2にし、トルティーヤ1枚分にしました。豆は400g缶（汁ごとの量）の半分、クミンは元の小さじ1/4の半分（小さじ1/8）です。', en: 'The source (2 to 4 servings, 2 tortillas) is halved to one tortilla. The beans are half of a 400 g can (weight including liquid); the cumin is half of 1/4 tsp, i.e. 1/8 tsp.' },
    { ja: '元のページはメートル法とUS単位の切り替え表示で、メートル法（g、小さじ）の数値を使いました。', en: 'The source page offers metric and US units; the metric amounts (g, tsp) are used here.' },
    { ja: 'スモークパプリカ（香辛料）は辞書に項目がないため、いちばん近い「パプリカ」で登録しています。「塩こしょう」は「塩」の項目で登録しています。', en: 'Smoked paprika (the spice) has no dictionary entry, so it is recorded under the closest one, "paprika"; "salt and pepper" is recorded under "salt".' },
    { ja: 'トルティーヤとチーズは製品ごとにアレルゲンや原材料（トルティーヤの油脂など）が違い、参照できる表示がないため「不明」としています。必ず使う製品の表示を確認してください。', en: 'Tortilla and cheese allergens and ingredients (such as the fat in the tortilla) vary by product and no label was cited, so they are recorded as unknown. Always check the labels.' },
    { ja: '元のレシピは子どもが自分で作れるよう、道具と手順が細かく書かれています。お弁当に詰めることの記載はないため、詰め方の注意は農林水産省の案内によります。', en: 'The source is written so children can cook it themselves, with every tool listed. It says nothing about packing it, so the packing note follows the MAFF guidance.' },
  ],
  sources: [
    { id: 'src-bbc-cheesy-black-bean-quesadillas', publisher: 'Immediate Media Company Ltd (BBC Good Food)', title: 'Cheesy black bean quesadillas recipe | Good Food', url: 'https://www.bbcgoodfood.com/recipes/cheesy-black-bean-quesadillas', accessed: A, language: 'en', usedFor: ['recipe'] },
    { id: 'src-maff-lunchbox', publisher: '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', title: 'お弁当づくりによる食中毒を予防するために：農林水産省', url: 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html', accessed: A, language: 'ja', usedFor: ['storage'] },
  ],
};
