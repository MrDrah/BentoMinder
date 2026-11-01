import { ing, rec, recipeSrc, L, NHK, DEL } from './lib.mjs';

export const r5 = [];

// 13 nhk-3716
{
  const src = recipeSrc('src-nhk-3716-curry-soboro-musubi', NHK, 'カレーそぼろむすび レシピ グッチ 裕三さん｜みんなのきょうの料理', encodeURI('https://www.kyounoryouri.jp/recipe/3716_カレーそぼろむすび.html'));
  r5.push(rec({
    id: 'rcp-nhk-curry-soboro-musubi',
    name: L('カレーそぼろむすび', 'Curry soboro rice balls'),
    shortNameJa: 'カレーそぼろ', shortNameEn: 'Kareoni',
    nameKana: 'かれーそぼろむすび',
    style: 'other',
    description: L('コンソメで炊いたごはんに、カレー粉で味つけした鶏そぼろと細かく刻んだピーマンを混ぜ、一口大ににぎってサラダ菜にのせたおにぎりです。', 'Rice cooked with consomme is mixed with curry-flavored chicken soboro and finely chopped peppers, shaped into bite-size balls and set on salad leaves.'),
    yield: L('つくりやすい分量（出典に人数の記載なし）', 'A convenient batch (the source gives no number of servings)'),
    minutes: 10,
    ingredients: [
      ing('ing-rice', '米', 'rice, uncooked', 2, 'cup'),
      ing('ing-consomme', '顆粒スープの素（洋風）', 'granulated western soup stock', 1, 'tbsp', { p: 'consomme' }),
      ing('ing-ground-chicken', '鶏ひき肉', 'ground chicken', 100, 'g'),
      ing('ing-onion', 'たまねぎ', 'onion', 0.25, 'piece'),
      ing('ing-green-pepper', 'ピーマン（緑）', 'green pepper', 1, 'piece'),
      ing('ing-paprika', 'ピーマン（赤）', 'red pepper', 1, 'piece'),
      ing('ing-lettuce', 'サラダ菜', 'salad leaves', null, 'small-amount'),
      ing('ing-mirin', 'みりん', 'mirin', 1, 'tsp'),
      ing('ing-oyster-sauce', 'オイスターソース', 'oyster sauce', 1, 'tsp', { p: 'unknown' }),
      ing('ing-mentsuyu', 'だしじょうゆ（市販）', 'seasoned dashi soy sauce (store-bought)', 1, 'tsp', { p: 'unknown' }),
      ing('ing-curry-powder', 'カレー粉', 'curry powder', 1, 'tsp', { p: 'currypowder' }),
      ing('ing-ketchup', 'トマトケチャップ', 'tomato ketchup', 1, 'tsp', { p: 'ketchup' }),
      ing('ing-oil', 'サラダ油', 'vegetable oil', 1, 'tbsp'),
      ing('ing-pepper', '黒こしょう', 'black pepper', null, 'small-amount'),
    ],
    steps: [
      L('米は洗ったあと炊飯器に移し、水2カップとスープの素を加えて炊きます。', 'Wash the rice, put it in the rice cooker with the soup stock and 2 cups water, and cook.'),
      L('たまねぎと、ヘタと種を除いた緑・赤のピーマンをそれぞれみじん切りにします。調味料（みりん・オイスターソース・だしじょうゆ・カレー粉・ケチャップ）を混ぜておきます。', 'Finely chop the onion and the green and red peppers, seeds removed. Mix the seasonings: mirin, oyster sauce, dashi soy sauce, curry powder and ketchup.'),
      L('フライパンに油を熱して鶏ひき肉を入れ、強火でぽろぽろになるまで炒めます。たまねぎ、続いてピーマンを加えて炒め、混ぜた調味料を全体にからめます。', 'Heat the oil, stir-fry the chicken over high heat until crumbly, add the onion and then the peppers, and stir in the mixed seasoning.'),
      L('炊きあがったごはんに3を混ぜ合わせ、一口大ににぎります。サラダ菜にのせて黒こしょうをふります。', 'Mix the cooked rice with the filling, shape into bite-size balls, set them on salad leaves and sprinkle with black pepper.'),
    ],
    storage: [
      L('調理の前に手をきれいに洗い、ごはんは冷ましてから詰めるよう、農林水産省が案内しています。', 'MAFF advises washing hands before cooking and cooling rice before packing it.'),
    ],
    adaptations: [
      L('出典には人数が書かれておらず「つくりやすい分量」とあるため、分量はそのままで、子ども1人分には換算していません。', 'The source gives no number of servings, only "a convenient batch", so amounts are kept as written and not converted to a child portion.'),
      L('出典のピーマン（赤）は辞書の「パプリカ」で、サラダ菜は「レタス」で登録しています。市販のだしじょうゆは、近い辞書項目の「めんつゆ」で登録し、参照できる表示がないためアレルゲンは「不明」としています。', 'The red pepper is recorded as paprika and salad leaves as lettuce. Store-bought dashi soy sauce is recorded as the nearest entry, mentsuyu, and its allergens are unknown because no label was cited.'),
      L('オイスターソースは製品ごとに原材料が違い、参照できる表示がないため「不明」です。コンソメは参照した製品（味の素「KKコンソメ 顆粒タイプ」）の表示で乳成分・小麦・牛肉・大豆・鶏肉を含み、「その他」のエキスがあるため動物性原料は「不明」のままです。', 'Oyster sauce varies by product and no label was cited, so it is unknown. The consomme label cited (Ajinomoto granule) declares milk, wheat, beef, soy and chicken; its "other" extracts keep animal origin unknown.'),
    ],
    sources: [src],
  }));
}

// 14 delish-keema
{
  const src = recipeSrc('src-delish-wafu-keema-curry-bento', DEL, 'スタミナ弁当！ 和風キーマカレー弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/173700197241586156');
  r5.push(rec({
    id: 'rcp-delish-wafu-keema-curry-bento',
    name: L('和風キーマカレー弁当', 'Japanese-style keema curry bento'),
    shortNameJa: '和風キーマ', shortNameEn: 'Keema',
    nameKana: 'わふうきーまかれーべんとう',
    style: 'other',
    description: L('ひき肉・玉ねぎ・カレールウを混ぜて電子レンジで10分加熱するだけのキーマカレーを、ごはん、ゆで卵、ミニトマト、ブロッコリーの弁当にかけた一品です。', 'Mince, onion and curry roux are mixed and microwaved for 10 minutes, then spooned over rice with boiled egg, mini tomatoes and broccoli.'),
    yield: L('2人分（出典のまま）', '2 servings (as in the source)'),
    minutes: 20,
    ingredients: [
      ing('ing-ground-mixed', '合びき肉', 'mixed ground beef and pork', 200, 'g'),
      ing('ing-onion', '玉ねぎ（みじん切り）', 'onion, finely chopped', 0.5, 'piece'),
      ing('ing-curry-roux', 'カレールウ（2かけ）', 'curry roux (2 cubes)', 35, 'g', { p: 'roux' }),
      ing('ing-cooking-sake', '酒', 'sake', 1, 'tbsp'),
      ing('ing-mirin', 'みりん', 'mirin', 1, 'tbsp'),
      ing('ing-garlic', 'おろしにんにく', 'grated garlic', 1, 'tsp'),
      ing('ing-ginger', 'おろししょうが', 'grated ginger', 1, 'tsp'),
      ing('ing-mentsuyu', 'めんつゆ（2倍濃縮）', 'mentsuyu (2x concentrate)', 1, 'tbsp', { p: 'mentsuyu' }),
      ing('ing-rice', 'ごはん', 'cooked rice', null, 'small-amount'),
      ing('ing-egg', 'ゆで卵', 'boiled egg', null, 'small-amount'),
      ing('ing-cherry-tomato', 'ミニトマト', 'mini tomatoes', null, 'small-amount'),
      ing('ing-broccoli', 'ブロッコリー（ゆでたもの）', 'broccoli (boiled)', null, 'small-amount'),
    ],
    steps: [
      L('カレールウをみじん切りにします。', 'Chop the curry roux finely.'),
      L('ボウルにカレールウと合びき肉、玉ねぎを入れ、酒・みりん・おろしにんにく・おろししょうが・めんつゆ・水50mlを加えてよく混ぜます。', 'Put the mince, onion, roux, sake, mirin, garlic, ginger, mentsuyu and 50 ml water in a bowl and mix well.'),
      L('ふんわりとラップをかけ、電子レンジ（600W）で10分ほど加熱します。取り出したらよくかき混ぜ、冷まします。', 'Cover loosely, microwave at 600 W for 10 minutes, stir well and let it cool.'),
      L('弁当箱にごはん・ゆで卵・ミニトマト・ゆでたブロッコリーを詰め、冷ましたキーマカレーをかけます。', 'Pack the rice, egg, mini tomatoes and boiled broccoli and spoon the cooled keema curry over the rice.'),
    ],
    storage: [
      L('出典は、夏場や梅雨の時期を避けること、保冷剤・保冷バッグまたは冷蔵庫で涼しく保管して早めに食べることを勧めています。', 'The source says to avoid summer and the rainy season, keep the bento cool with cold packs or in the fridge, and eat it soon.'),
      L('また、よく冷ましてからふたをすること、生の野菜や果物は洗い、水気を十分に切って詰めることも書かれています。', 'It also says to cool the food fully before closing the lid and to wash and drain raw vegetables well before packing them.'),
    ],
    adaptations: [
      L('出典は2人分で、子ども1人分の目安は書かれていないため、分量は2人分のままです。ごはん・ゆで卵・ミニトマト・ブロッコリーは出典で「適量」なので、量を決めずに登録しています。', 'The source is for 2 servings and gives no child share, so amounts stay for 2. Rice, egg, tomatoes and broccoli are "as needed" in the source and are recorded as small amounts.'),
      L('カレールウ「2かけ（35g）」は一般名にしました。アレルゲンは参照した製品（ハウス食品「バーモントカレー 甘口」）の表示で、乳成分・小麦・大豆・鶏肉・バナナ・豚肉・りんごです。ルウは製品で原材料が違うので、使う製品の表示を確認してください。', 'The 2 cubes (35 g) of roux are recorded generically. The label cited (House Vermont Curry, sweet) declares milk, wheat, soy, chicken, banana, pork and apple. Roux differs by product, so check the label of yours.'),
      L('めんつゆは参照した製品（キッコーマン「濃いだし 本つゆ」）の表示で小麦・大豆と、かつお節などの魚介が原材料です。水は材料に登録していません。ゆで卵は完全に固まるまで火を通したものを使ってください。', 'Mentsuyu follows the label cited (Kikkoman Koidashi Hontsuyu): wheat and soy, with bonito and other fish. Water is not registered as an ingredient. Use a boiled egg that is fully set.'),
    ],
    sources: [src],
  }));
}
