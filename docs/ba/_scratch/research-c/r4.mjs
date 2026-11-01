import { ing, rec, recipeSrc, L, NHK, DEL, KIK } from './lib.mjs';

export const r4 = [];

// 10 kikkoman-butahirepanko
{
  const page = recipeSrc('src-kikkoman-butahire-panko-bento', KIK, '豚ヒレ肉のパン粉焼き弁当 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/lunch/enji/butahirepanko.html', ['recipe']);
  const main = recipeSrc('src-kikkoman-butahire-panko', KIK, '豚ヒレ肉のパン粉焼き（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/search/recipe/00003064/', ['recipe']);
  const egg = recipeSrc('src-kikkoman-aonori-tamagoyaki', KIK, '青のり入りの卵焼き（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/search/recipe/00003065/', ['recipe']);
  const sp = recipeSrc('src-kikkoman-satsumaimo-cheese', KIK, 'さつまいものチーズがらめ（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/search/recipe/00003083/', ['recipe']);
  r4.push(rec({
    id: 'rcp-kikkoman-butahire-panko-bento',
    name: L('豚ヒレ肉のパン粉焼き弁当', 'Panko-crusted pork fillet bento'),
    shortNameJa: 'ヒレパン粉焼き', shortNameEn: 'Panko',
    nameKana: 'ぶたひれにくのぱんこやきべんとう',
    style: 'western-inspired',
    description: L('粉チーズ入りのパン粉をつけて揚げ焼きにした豚ヒレ肉に、青のりの卵焼きと、さつまいもに粉チーズをまとわせた一品を詰めた園児向けの小さな弁当です。', 'Pan-fried pork fillet in a Parmesan-flavored crumb coating, packed with aonori egg roll and cheesy sweet potato; a small kindergarten bento.'),
    yield: L('1人分', '1 serving'),
    minutes: 15,
    makeAhead: L('豚肉に衣をつけるところまでは前日に準備でき、当日は焼くだけです。', 'The pork can be coated the day before, so only the frying is left in the morning.'),
    ingredients: [
      ing('ing-pork', '豚ヒレ肉', 'pork fillet', 30, 'g'),
      ing('ing-salt', '塩（豚肉・卵焼き・さつまいも用）', 'salt (pork, egg roll, sweet potato)', null, 'small-amount'),
      ing('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
      ing('ing-egg', '溶き卵（衣用）', 'beaten egg (for coating)', null, 'small-amount'),
      ing('ing-wheat-flour', '薄力粉', 'plain flour', null, 'small-amount'),
      ing('ing-bread-crumbs', 'パン粉', 'bread crumbs', 2, 'tbsp', { p: 'unknown' }),
      ing('ing-cheese', '粉チーズ（衣用）', 'grated cheese (for the coating)', 0.5, 'tsp', { p: 'grated' }),
      ing('ing-oil', '揚げ油', 'oil for pan-frying', null, 'small-amount'),
      ing('ing-egg', '卵', 'egg', 1, 'piece'),
      ing('ing-oil', 'サラダ油（卵焼き用）', 'vegetable oil (for the egg roll)', null, 'small-amount'),
      ing('ing-aonori', '青のり', 'aonori seaweed flakes', null, 'small-amount'),
      ing('ing-sugar', '砂糖（卵焼き用）', 'sugar (for the egg roll)', 1, 'tsp'),
      ing('ing-sweet-potato', 'さつまいも', 'sweet potato', 0.25, 'piece'),
      ing('ing-sugar', '砂糖（さつまいも用）', 'sugar (for the sweet potato)', null, 'small-amount'),
      ing('ing-cheese', '粉チーズ（さつまいも用）', 'grated cheese (for the sweet potato)', 1, 'tsp', { p: 'grated' }),
    ],
    steps: [
      L('豚ヒレ肉をこぶしでたたいてのばし、塩とこしょうをふります。', 'Flatten the pork fillet by pounding it with your fist and season with salt and pepper.'),
      L('パン粉に粉チーズ小さじ1/2を混ぜます。', 'Mix 1/2 tsp grated cheese into the bread crumbs.'),
      L('豚肉に薄力粉、溶き卵、2の順に衣をつけます。', 'Coat the pork with flour, beaten egg and then the crumb mix.'),
      L('フライパンに油を深さ2cmほど入れ、中温で香ばしく揚げ焼きにします。', 'Heat about 2 cm of oil to medium temperature in a frying pan and shallow-fry until golden.'),
      L('卵を溶いて砂糖・青のり・塩を混ぜ、油を熱したフライパンに流し、端から巻きながら中までよく火を通して焼きます。', 'Beat the egg with sugar, aonori and salt, pour it into the oiled pan and roll it up from the edge, cooking it right through.'),
      L('さつまいもは1cmの角切りにして水にくぐらせ、水けを切って耐熱皿に広げます。塩と砂糖をふってふんわりラップをかけ、500Wで約1分加熱します。', 'Dice the sweet potato 1 cm, soak and drain, spread on a plate, sprinkle with salt and sugar, cover loosely and microwave at 500 W for about 1 minute.'),
      L('ラップをかけたまま1分おいて蒸らし、外してから汁を捨て、粉チーズ小さじ1をからめます。', 'Leave it to steam 1 minute, remove the wrap, pour off the liquid and toss with 1 tsp grated cheese.'),
    ],
    storage: [
      L('卵焼きは半熟にせず、中まで完全に火を通すよう出典にあり、農林水産省も同じ案内をしています。', 'The source says to cook the egg roll right through, and MAFF gives the same advice for egg dishes.'),
      L('ごはんやおかずは冷ましてから詰めるよう、農林水産省が案内しています。', 'MAFF advises cooling food before packing.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。弁当に使う3品の時間は、パン粉焼き15分・卵焼き10分・さつまいも10分で、主菜の15分を所要時間にしています。', 'The source is one serving. The component times are 15, 10 and 10 minutes; the main dish time, 15 minutes, is recorded.'),
      L('出典の注記では、衣に使う卵の代わりに、牛乳に小麦粉を少し混ぜた液を使う方法も紹介されています。ここでは卵を使う方で記録しています。', 'The source says the coating egg can be replaced with milk plus a little flour; the egg version is recorded here.'),
      L('豚ヒレ肉は辞書の「豚肉」で登録しています。パン粉は製品ごとに原材料が違い、参照できる表示がないため「不明」としています。粉チーズのアレルゲンは参照した製品（雪印メグミルク「粉チーズ マイルド」）の表示では乳成分です。', 'Pork fillet is recorded as generic pork. Bread crumbs vary by product and no label was cited, so they are recorded as unknown. The grated cheese label cited (Snow Brand Megmilk Mild) declares milk.'),
    ],
    sources: [page, main, egg, sp],
  }));
}

// 11 delish-kumahiyo
{
  const src = recipeSrc('src-delish-kumahiyo-bento', DEL, 'お手軽キャラ弁！ くまヒヨ弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/260090381100647635');
  r4.push(rec({
    id: 'rcp-delish-kumahiyo-bento',
    name: L('くまヒヨ弁当', 'Bear and chick bento'),
    shortNameJa: 'くまヒヨ', shortNameEn: 'Kumahiyo',
    nameKana: 'くまひよべんとう',
    style: 'western-inspired',
    themeId: 'theme-animals',
    description: L('くまとヒヨコの顔のごはんに、焼肉のたれの簡単唐揚げ、ハート形の卵焼き、ブロッコリーを添えた、レンジとフライパンで作るキャラ弁です。', 'Rice shaped as a bear and a chick with easy karaage in yakiniku sauce, heart-shaped egg roll and broccoli, made with a microwave and one pan.'),
    yield: L('2人分（出典のまま）', '2 servings (as in the source)'),
    minutes: 30,
    ingredients: [
      ing('ing-rice', 'ごはん（お茶碗2杯）', 'cooked rice (2 bowls)', 300, 'g'),
      ing('ing-corn', 'コーン（冷凍・4粒）', 'sweet corn kernels (frozen, 4)', 4, 'piece'),
      ing('ing-nori', '焼きのり', 'toasted nori', null, 'small-amount'),
      ing('ing-ketchup', 'ケチャップ', 'ketchup', null, 'small-amount', { p: 'ketchup' }),
      ing('ing-sausage', 'ソーセージ（5mm幅の輪切り4枚）', 'sausage (4 slices, 5 mm thick)', 4, 'slice', { p: 'sausage' }),
      ing('ing-bonito-flakes', 'かつお節（1/3袋）', 'bonito flakes (1/3 pack)', 1.3, 'g'),
      ing('ing-soy-sauce', 'しょうゆ（くまごはん小さじ1/2・卵焼き小さじ1/2）', 'soy sauce (1/2 tsp for the bear rice, 1/2 tsp for the egg)', 1, 'tsp', { p: 'soy' }),
      ing('ing-chicken-thigh', '鶏もも肉', 'chicken thigh', 100, 'g'),
      ing('ing-yakiniku-sauce', '焼肉のたれ', 'yakiniku sauce', 1, 'tbsp', { p: 'yakiniku' }),
      ing('ing-salt', '塩（塩こしょう・卵焼き用）', 'salt (for the karaage and the egg)', null, 'small-amount'),
      ing('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
      ing('ing-potato-starch', '片栗粉', 'potato starch', 1, 'tbsp'),
      ing('ing-wheat-flour', '薄力粉', 'plain flour', 1, 'tbsp'),
      ing('ing-oil', 'サラダ油（唐揚げ用）', 'vegetable oil (for the karaage)', 2, 'tbsp'),
      ing('ing-egg', '卵', 'eggs', 2, 'piece'),
      ing('ing-sugar', '砂糖（卵焼き用）', 'sugar (for the egg)', 2, 'tsp'),
      ing('ing-oil', 'サラダ油（卵焼き用）', 'vegetable oil (for the egg roll)', null, 'small-amount'),
      ing('ing-broccoli', 'ブロッコリー（小房）', 'broccoli florets', 4, 'piece'),
    ],
    steps: [
      L('鶏もも肉を4等分に切ってポリ袋に入れ、焼肉のたれと塩こしょうをもみ込んで10分ほどおきます。', 'Cut the chicken into 4, put it in a bag, rub in the yakiniku sauce, salt and pepper and leave about 10 minutes.'),
      L('その間に卵焼きを作ります。卵をほぐし、砂糖・塩・水大さじ1・しょうゆ小さじ1/2を混ぜ合わせます。', 'Meanwhile make the egg roll: beat the eggs and mix in the sugar, 1/2 tsp soy sauce, salt and 1 tbsp water.'),
      L('卵焼き器に油を熱してのばし、卵液の半量を流して半熟まで加熱し、手前に折って奥へ送ります。', 'Heat and spread oil in the egg pan, pour in half the egg, cook until half-set, fold it toward you and push it back.'),
      L('油をなじませ、残りの卵液を流して同様に巻き、ペーパーで包んで形を整えて粗熱をとります。4等分に切って両端を斜めに切り、ハート形にします。', 'Re-oil, pour in the rest, roll the same way, wrap in paper towel to shape and cool. Cut into 4, trim both ends diagonally to make heart shapes.'),
      L('ブロッコリーとコーン、ソーセージを耐熱容器に入れ、水大さじ1を回しかけます。ふんわりラップをして600Wで1分加熱し、水けをしっかり切ります。', 'Put the corn, sausage, broccoli and 1 tbsp water in a dish, cover loosely, microwave at 600 W for 1 minute and drain well.'),
      L('1に片栗粉と薄力粉をまぶし、卵焼き器に油大さじ2を熱して、弱めの中火で4〜5分、ときどき返しながら中まで火を通します。', 'Dust the chicken with starch and flour and pan-fry it in 2 tbsp oil over medium-low heat for 4 to 5 minutes, turning, until cooked through.'),
      L('ごはん半量（150g）にかつお節としょうゆ小さじ1/2を混ぜて、くまごはんにします。', 'Mix half the rice (150 g) with the bonito flakes and 1/2 tsp soy sauce for the bear rice.'),
      L('焼きのりを、ヒヨコの目とくまの目・口の形に切ります。', 'Cut the nori into chick eyes and bear eyes and mouth.'),
      L('シリコンカップ2個を弁当箱に置き、白いごはんとくまごはんを詰めます。くまにはソーセージの耳とのりの顔、ヒヨコにはのりの目とコーンの口をつけ、頬にケチャップをつけます。', 'Put 2 silicone cups in the box and fill them with plain and bear rice. Add sausage ears and nori to the bear, nori eyes and a corn beak to the chick, and ketchup cheeks.'),
      L('唐揚げとブロッコリー、ハート形の卵焼きを半量ずつごはんのまわりに詰め、同じように計2個作ります。', 'Pack half of the karaage, heart egg roll and broccoli around each; make 2 boxes.'),
    ],
    storage: [
      L('出典は、ごはんもおかずもしっかり粗熱を取ってから詰めること、保冷剤・保冷バッグまたは冷蔵庫で保管して早めに食べることを勧めています。', 'The source says to cool the rice and side dishes well before packing, keep the bento cool with cold packs or in the fridge, and eat it soon.'),
      L('ソーセージなどそのまま食べられるものもできるだけ加熱し、卵は半熟にせず完全に火を通すよう、農林水産省が案内しています。', 'MAFF advises heating ready-to-eat items such as sausages where possible and cooking eggs until fully set.'),
    ],
    adaptations: [
      L('出典は2人分で、子ども1人分の目安は書かれていないため、分量は2人分のままです。コーンは「4粒」としてあります。', 'The source is for 2 servings and gives no child share, so amounts stay for 2. The corn is the 4 kernels the source gives.'),
      L('しょうゆは、くまごはん小さじ1/2と卵焼き小さじ1/2を合計して1行にしています。出典の「塩こしょう」は塩とこしょうの2行にしました。水は材料に登録していません。', 'Soy sauce (1/2 tsp for the rice and 1/2 tsp for the egg) is totalled on one line, "salt and pepper" becomes two lines, and water is not registered as an ingredient.'),
      L('焼肉のたれのアレルゲンは参照した製品（キッコーマン「超 焼肉のたれ 甘口」）の表示で、小麦・大豆・りんごです。たれは製品で原材料が違い、ごまや豚肉を含むものもあるので、使う製品の表示を確認してください。', 'The yakiniku sauce label cited (Kikkoman Cho Yakiniku no Tare, sweet) declares wheat, soy and apple. Other sauces can contain sesame or pork, so check the label of the one you use.'),
      L('ソーセージは参照した製品（日本ハム「シャウエッセン」）の表示で豚肉です。ケチャップ・しょうゆも参照した製品表示によります。', 'The sausage label cited (Nippon Ham Schauessen) declares pork; ketchup and soy sauce follow the labels cited.'),
    ],
    sources: [src],
  }));
}

// 12 delish-5min
{
  const src = recipeSrc('src-delish-5min-bento', DEL, 'レンジで3品！ 5分弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/167909730470068716');
  r4.push(rec({
    id: 'rcp-delish-5min-microwave-bento',
    name: L('レンジで3品！ 5分弁当', '5-minute microwave bento with 3 dishes'),
    shortNameJa: '5分弁当', shortNameEn: '5 minute',
    nameKana: 'れんじでさんぴんごふんべんとう',
    style: 'western-inspired',
    description: L('ハムチーズオムレツ、温野菜、カレー味のジャーマンポテトを、耐熱カップに入れてまとめてレンジにかけるだけの、5分でできる弁当のおかずです。', 'Ham and cheese omelet, steamed vegetables and curry-flavored German potatoes, all made in cups and microwaved together in about 5 minutes.'),
    yield: L('1人分', '1 serving'),
    minutes: 5,
    ingredients: [
      ing('ing-ham', 'ハム', 'ham', 1, 'slice', { p: 'ham' }),
      ing('ing-egg', '卵', 'egg', 1, 'piece'),
      ing('ing-cheese', 'とろけるチーズ', 'melting cheese slice', 1, 'slice', { p: 'slicecheese' }),
      ing('ing-salt', '塩', 'salt', null, 'small-amount'),
      ing('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
      ing('ing-carrot', 'にんじん（4cm）', 'carrot (4 cm length)', null, 'small-amount'),
      ing('ing-broccoli', 'ブロッコリー（小房）', 'broccoli (small florets)', 3, 'piece'),
      ing('ing-consomme', 'コンソメ', 'consomme powder', 0.33, 'tsp', { p: 'consomme' }),
      ing('ing-sausage', 'ソーセージ', 'sausage', 1, 'stick', { p: 'sausage' }),
      ing('ing-potato', 'じゃがいも（1/2個）', 'potato (1/2)', 60, 'g'),
      ing('ing-curry-powder', 'カレー粉', 'curry powder', 0.5, 'tsp', { p: 'currypowder' }),
      ing('ing-butter', '有塩バター', 'salted butter', 10, 'g'),
    ],
    steps: [
      L('耐熱カップにハムと卵、塩、こしょうを入れて溶きほぐし、ちぎったとろけるチーズをのせます。', 'Put the ham, egg, salt and pepper in a heatproof cup, mix, and tear the cheese on top.'),
      L('別の耐熱カップに食べやすく切ったにんじんを入れ、ブロッコリーを加えてコンソメをふります。', 'In another cup put the carrot, cut small, add the broccoli and sprinkle with consomme.'),
      L('ソーセージとじゃがいもは一口で食べやすい大きさに切り、じゃがいもは水にさらして水けを切ります。', 'Cut the sausage and potato into bite-size pieces; soak the potato in water and drain.'),
      L('3つ目の耐熱カップにカレー粉と水小さじ1を溶き混ぜ、ソーセージとじゃがいもを入れてからめ、バターを上に置きます。', 'In a third cup mix the curry powder with 1 tsp water, add the potato and sausage, stir and top with butter.'),
      L('耐熱皿に3つのカップをのせ、ふんわりラップをして600Wで加熱します。オムレツは1分ほどで中まで火が通ったら先に取り出します。', 'Put the 3 cups on a plate, cover loosely and microwave at 600 W; take out the omelet first when it is cooked through, after about 1 minute.'),
      L('残りの温野菜とポテトは、野菜がやわらかくなるまで合計2〜3分加熱します。', 'Continue with the vegetables and potatoes until the vegetables are cooked, 2 to 3 minutes in total.'),
      L('十分に冷ましてから弁当箱に詰め、ふたをします。', 'Cool everything thoroughly before packing and closing the lid.'),
    ],
    storage: [
      L('出典は、しっかり冷ましてから弁当箱に入れてふたをすること、保冷剤・保冷バッグまたは冷蔵庫など涼しい所に置いて早く食べることを勧めています。', 'The source says to cool everything fully before closing the box, keep it cool with cold packs or in the fridge and eat it soon.'),
      L('オムレツは、中の卵が完全に固まるまで加熱時間を加減するよう出典に書かれています。ハムやソーセージも、できるだけ加熱するよう農林水産省が案内しています。', 'The source says to adjust the heating time until the omelet egg is completely cooked, and MAFF advises heating ham and sausage where possible.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。にんじん「4cm」は重さの記載がないため、量を決めない（少量）で登録しています。', 'The source is one serving, so amounts are unchanged. The carrot is given as 4 cm without a weight, so it is recorded as a small amount.'),
      L('コンソメは参照した製品（味の素「KKコンソメ 顆粒タイプ」）の表示で、乳成分・小麦・牛肉・大豆・鶏肉を含みます。「その他」のエキスや油脂があるため動物性原料は「不明」のままです。', 'The consomme label cited (Ajinomoto granule) declares milk, wheat, beef, soy and chicken. Its "other" extracts and fats mean animal origin stays unknown.'),
      L('ハム・ソーセージ・カレー粉・とろけるチーズは参照した製品表示（日本ハム、ハウス食品、雪印メグミルク）によります。製品で原材料が違うので、使う製品の表示を確認してください。', 'Ham, sausage, curry powder and cheese follow the labels cited (Nippon Ham, House Foods, Snow Brand Megmilk). Check the labels of the products you use.'),
    ],
    sources: [src],
  }));
}
