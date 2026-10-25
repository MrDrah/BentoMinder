// rank 15: delish-kuma-usagi-sandwich
const A = '2026-10-25';
const delish = 'デリッシュキッチン (every, Inc.)';
export default {
  id: 'rcp-delish-kuma-usagi-sandwich',
  name: { ja: 'くまとうさぎのサンドイッチ', en: 'Bear and bunny sandwiches' },
  shortNameJa: 'くまうさサンド',
  shortNameEn: 'Bear bun',
  nameKana: 'くまとうさぎのさんどいっち',
  style: 'western-inspired',
  themeId: 'theme-animals',
  description: {
    ja: 'ロールパンにカレー風味のキャベツとソーセージをはさみ、のりで顔をつけてくまとうさぎにした、火を使わずレンジで作れるサンドイッチです。',
    en: 'Bread rolls filled with curry-spiced cabbage and sausage, given nori faces to look like a bear and a bunny; everything is heated in the microwave, no hob needed.',
  },
  minutes: 30,
  ingredients: [
    ['ing-bread', 'ロールパン', 'soft bread rolls', 2, 'piece', { info: 'unknown' }],
    ['ing-sausage', 'ソーセージ（2本で40g）', 'sausages (2, about 40 g)', 2, 'stick', { info: 'unknown' }],
    ['ing-cabbage', 'キャベツ（1枚）', 'cabbage (1 leaf)', 40, 'g'],
    ['ing-curry-powder', 'カレー粉', 'curry powder', null, 'small-amount', { info: 'known' }],
    ['ing-salt', '塩こしょう', 'salt and pepper', null, 'small-amount'],
    ['ing-butter', '溶かしバター（有塩）', 'melted salted butter', 10, 'g'],
    ['ing-ketchup', 'ケチャップ', 'ketchup', null, 'to-taste', { info: 'known' }],
    ['ing-nori', '焼きのり', 'toasted nori', null, 'to-taste'],
  ],
  steps: [
    { ja: 'キャベツを細く切って耐熱容器に入れ、カレー粉と塩こしょうを混ぜます。ラップをふんわりかけ、600Wの電子レンジで1分加熱します。', en: 'Shred the cabbage, put it in a heatproof dish and mix in the curry powder, salt and pepper. Cover loosely and microwave at 600 W for 1 minute.' },
    { ja: 'ソーセージ1本は縦に半分に切ります。もう1本は両端を1cmずつ切り分けます（端はくまの耳、真ん中ははさむ具になります）。', en: 'Halve one sausage lengthways. Cut 1 cm off each end of the other (the ends become the bear\'s ears, the middle goes in the roll).' },
    { ja: 'ソーセージを耐熱容器に入れてラップをふんわりかけ、600Wで30秒加熱します。破裂を防ぐため、切り込みを入れてから少しずつ温めます。', en: 'Put the sausage pieces in a heatproof dish, cover loosely and microwave at 600 W for 30 seconds. Cut into them first and heat in short bursts so they do not burst.' },
    { ja: 'ロールパンに横から切り込みを入れます。くまにする1個は、鼻になる部分を指で丸くつまみ取ります。', en: 'Slit each roll from the side. On the roll for the bear, pinch out a small round of bread where the nose will go.' },
    { ja: 'パンの内側に溶かしバターを塗ります。うさぎ用のパンには、キャベツ半量と縦に切ったソーセージを詰めてケチャップをかけます。', en: 'Brush the inside of the rolls with melted butter. Fill the bunny roll with half the cabbage and the halved sausage and add ketchup.' },
    { ja: 'くま用のパンには、残ったキャベツと中央部分のソーセージを詰め、ケチャップをかけます。1cmの端2つにつまようじを刺し、先を1cmほど出して耳としてパンに刺します。', en: 'Fill the bear roll with the rest of the cabbage and the middle of the sausage, plus ketchup. Push a cocktail stick into each 1 cm end, leaving about 1 cm showing, and attach them as ears.' },
    { ja: 'のりを切って目、鼻、口を作ります。顔をつけたい所に溶かしバターを塗り、のりを貼ります。', en: 'Cut eyes, noses and mouths from the nori. Dab melted butter where each face goes and stick the nori on.' },
  ],
  storage: [
    { ja: 'キャベツなど水分の多い具は、水けをよくふき取ってからはさみます。', en: 'Pat watery fillings such as the cabbage dry before filling the rolls.' },
    { ja: 'くまの耳に刺したつまようじに気をつけて食べさせてください。', en: 'Watch out for the cocktail sticks in the bear\'s ears when your child eats.' },
    { ja: '小さな子が食べるときは、のどに詰まらせないよう、食べることに集中して落ち着いて食べさせます。', en: 'Let a small child eat calmly and with attention on the food, so nothing goes down the wrong way.' },
  ],
  adaptations: [
    { ja: '元のレシピがもともと1人分なので、分量はそのままです。', en: 'The source is already one portion, so amounts are unchanged.' },
    { ja: '「塩こしょう」は辞書にこしょうの項目がないため、「塩」の項目で登録しています。', en: '"Salt and pepper" is recorded under the dictionary\'s "salt" entry because there is no pepper entry.' },
    { ja: 'ロールパンとソーセージは製品ごとにアレルゲン（小麦、卵、乳、豚肉、大豆など）や原材料が違い、参照できる表示がないため「不明」としています。必ず使う製品の表示を確認してください。カレー粉とケチャップのアレルゲンは参照した製品表示によります。', en: 'Bread roll and sausage allergens (wheat, egg, milk, pork, soy and others) and ingredients vary by product and no label was cited, so they are recorded as unknown. Always check the labels. The curry powder and ketchup allergen data come from the product labels cited.' },
  ],
  sources: [
    { id: 'src-delish-kuma-usagi-sandwich', publisher: delish, title: '見た目が可愛い♪ くまとうさぎのサンドイッチのレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/160803623310197139', accessed: A, language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-house-curry-powder-granule', publisher: 'ハウス食品株式会社', title: 'カレーパウダー ＜顆粒＞ | 商品カタログトップ | ハウス食品', url: 'https://housefoods.jp/products/catalog/cd_1,085423,spice,curpd,house.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
    { id: 'src-kikkoman-delmonte-ketchup', publisher: 'キッコーマン株式会社（ホームクッキング）', title: 'デルモンテ トマトケチャップ | キッコーマン株式会社', url: 'https://www.kikkoman.co.jp/products/K45/detail/K451000.html', accessed: A, language: 'ja', usedFor: ['allergen'] },
  ],
};
