import { ing, rec, recipeSrc, L, NHK, DEL, KIK } from './lib.mjs';

export const r3 = [];

// 7 delish-reindeer
{
  const src = recipeSrc('src-delish-reindeer-bento', DEL, 'メリクリ♪ トナカイ弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/169514697454780908');
  r3.push(rec({
    id: 'rcp-delish-reindeer-bento',
    name: L('トナカイ弁当', 'Reindeer bento'),
    shortNameJa: 'トナカイ', shortNameEn: 'Reindeer',
    nameKana: 'となかいべんとう',
    style: 'japanese',
    themeId: 'theme-seasonal',
    description: L('かつお節としょうゆを混ぜたごはんでトナカイの顔を作り、ソーセージの角、のりの目と口、梅干しの鼻をつけた、クリスマス向けのキャラ弁です。', 'A Christmas character bento: rice mixed with bonito flakes and soy sauce shaped into a reindeer face with sausage antlers, nori eyes and mouth and an umeboshi nose.'),
    yield: L('1人分', '1 serving'),
    minutes: 10,
    ingredients: [
      ing('ing-rice', 'あたたかいごはん', 'warm cooked rice', 100, 'g'),
      ing('ing-bonito-flakes', 'かつお節（1袋）', 'bonito flakes (1 pack)', 2.5, 'g'),
      ing('ing-soy-sauce', 'しょうゆ', 'soy sauce', 1, 'tsp', { p: 'soy' }),
      ing('ing-sausage', 'ソーセージ', 'sausage', 1, 'stick', { p: 'sausage' }),
      ing('ing-nori', '焼きのり（目・口用）', 'toasted nori (for eyes and mouth)', null, 'small-amount'),
      ing('ing-umeboshi', '梅干し', 'umeboshi pickled plum', 1, 'piece', { p: 'unknown' }),
    ],
    steps: [
      L('ソーセージを縦半分に切って切り込みを入れ、耐熱容器でふんわりラップをして600Wで20秒加熱し、粗熱をとります。', 'Halve the sausage lengthwise and score it, microwave it loosely covered at 600 W for 20 seconds and let it cool.'),
      L('ごはんにかつお節としょうゆを加えて、よく混ぜ合わせます。', 'Mix the warm rice, bonito flakes and soy sauce in a bowl.'),
      L('ごはん大さじ1を取り分けて2等分して丸め（耳）、残りは丸く形を整えます（頭）。', 'Set aside 1 tbsp of rice, halve it and roll two balls for the ears; shape the rest into a round head.'),
      L('焼きのりを目と口の形に切ります。', 'Cut the nori into eyes and a mouth.'),
      L('おにぎりとソーセージを盛りつけ、のりと梅干しで顔を飾ります。', 'Arrange the rice and sausage and decorate the face with the nori and umeboshi.'),
    ],
    storage: [
      L('ソーセージのようにそのまま食べられる食品も、できるだけ加熱するよう農林水産省が案内しています。この弁当ではレンジで温めます。', 'MAFF advises heating ready-to-eat items such as sausages where possible; this bento heats it in the microwave.'),
      L('出典には、小さな子どもが食べるときは誤嚥を防ぐため、食べることに集中させて落ち着いて食べさせるという注意があります。', 'The source advises that young children should concentrate on eating and eat calmly to avoid choking.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。', 'The source is already one serving, so amounts are unchanged.'),
      L('ソーセージのアレルゲンは参照した製品（日本ハム「シャウエッセン」）の表示では豚肉です。他の製品は違うので表示を確認してください。梅干しは製品ごとに原材料が違い、参照できる表示がないため、アレルゲンは「不明」としています。', 'The sausage label cited (Nippon Ham Schauessen) declares pork; other products differ. Umeboshi vary by product and no label was cited, so its allergens are recorded as unknown.'),
    ],
    sources: [src],
  }));
}

// 8 nhk-17101
{
  const src = recipeSrc('src-nhk-17101-frozen-sandwich', NHK, 'フローズンサンド弁当 レシピ 髙城 順子さん｜みんなのきょうの料理', encodeURI('https://www.kyounoryouri.jp/recipe/17101_フローズンサンド弁当.html'));
  r3.push(rec({
    id: 'rcp-nhk-frozen-egg-sandwich-bento',
    name: L('フローズンサンド弁当', 'Frozen egg sandwich bento'),
    shortNameJa: 'フローズンサンド', shortNameEn: 'Frozen',
    nameKana: 'ふろーずんさんどべんとう',
    style: 'western-inspired',
    description: L('塩もみたまねぎ入りの卵サンドをあらかじめ冷凍し、凍ったまま詰めておく弁当です。キウイのヨーグルトかけを添えます。', 'Egg salad sandwiches with salted onion are frozen ahead and packed still frozen, with kiwi in sweetened yogurt on the side.'),
    yield: L('1人分', '1 serving'),
    minutes: 25,
    makeAhead: L('サンドイッチはあらかじめ作ってカットし、ひと組ずつラップにくるんで冷凍しておけます。詰めるときは凍ったまま入れます。', 'The sandwiches can be made and cut ahead, wrapped one portion at a time and frozen; pack them still frozen.'),
    ingredients: [
      ing('ing-bread', 'サンドイッチ用食パン', 'sandwich bread', 4, 'slice', { p: 'unknown' }),
      ing('ing-egg', '卵', 'eggs', 2, 'piece'),
      ing('ing-onion', 'たまねぎ', 'onion', 40, 'g'),
      ing('ing-salt', '塩（ゆで湯・たまねぎ・あえ衣用）', 'salt (boiling water, onion, dressing)', null, 'small-amount'),
      ing('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
      ing('ing-butter', 'バター', 'butter', 1.33, 'tbsp'),
      ing('ing-mayonnaise', 'マヨネーズ（大さじ2強）', 'mayonnaise (a little over 2 tbsp)', 2, 'tbsp', { p: 'mayo' }),
      ing('ing-kiwi', 'キウイ', 'kiwi fruit', 100, 'g'),
      ing('ing-yogurt', 'プレーンヨーグルト（カップ1/3弱）', 'plain yogurt (a little under 1/3 cup)', 0.33, 'cup', { p: 'unknown' }),
      ing('ing-sugar', '砂糖（ヨーグルト用）', 'sugar (for the yogurt)', 1, 'tsp'),
    ],
    steps: [
      L('卵は常温に戻しておきます。小さめの鍋に卵と水3カップ、塩小さじ1/2を入れて火にかけ、煮立ったら弱火にして12〜13分ゆでます。', 'Bring the eggs to room temperature; put them in a pan with 3 cups water and 1/2 tsp salt, boil, then simmer 12 to 13 minutes.'),
      L('バターは室温に出してやわらかくしておきます。かたいと均一にぬれません。', 'Soften the butter at room temperature; if it is hard it will not spread evenly.'),
      L('たまねぎを薄切りにして塩ひとつまみをもみ込み、5分おきます。さっと洗い、ペーパータオルに包んでしっかり水けを絞ります。', 'Slice the onion thin, rub in a pinch of salt and leave 5 minutes. Rinse quickly, wrap in paper towel and squeeze out the water well.'),
      L('ゆで卵を水で冷まして殻をむき、フォークの背でつぶします。マヨネーズ・塩・こしょうを加えてあえ、たまねぎを混ぜます。', 'Cool the eggs in water, peel and mash with the back of a fork; mix in mayonnaise, salt and pepper, then the onion.'),
      L('食パン4枚の片面にバターをぬり、2枚に卵をのせて広げ、バターをぬった面を下にして残りのパンではさみます。', 'Butter one side of 4 slices, spread the egg on 2 of them and top with the other slices, buttered side down.'),
      L('ひと口で食べやすいサイズにカットし、ひと組ずつラップにくるみます。ジッパー付きの袋に入れて冷凍庫へ。', 'Cut into bite-size pieces, wrap each portion in cling film, put in a zip bag and freeze.'),
      L('ヨーグルトに砂糖を混ぜ、皮をむいていちょう切りにしたキウイを容器に入れてかけます。', 'Stir the sugar into the yogurt and pour it over the peeled, quarter-sliced kiwi in a sealed container.'),
      L('詰めるときはサンドイッチのラップを外し、凍ったまま弁当箱に入れます。', 'When packing, remove the cling film and put the sandwiches in the box still frozen.'),
    ],
    storage: [
      L('乾燥やにおい移りを防ぐため、サンドイッチはラップで包んでからジッパー付きの袋に入れて冷凍する、と出典にあります。', 'The source says to wrap the sandwiches in cling film and then in a zip bag before freezing, to prevent drying and odor transfer.'),
      L('卵は半熟にせず、中まで完全に火を通すよう農林水産省が案内しています。このレシピは12〜13分ゆでます。', 'MAFF advises cooking eggs until fully set; this recipe boils them for 12 to 13 minutes.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。マヨネーズの「大さじ2強」は2大さじ、バターの1と1/3大さじは1.33大さじ、ヨーグルトの「1/3カップより少し少ない量」は0.33カップで登録しています。', 'The source is one serving, so amounts are unchanged. "A little over 2 tbsp" mayonnaise is recorded as 2 tbsp, 1 1/3 tbsp butter as 1.33 tbsp and "a little under 1/3 cup" yogurt as 0.33 cup.'),
      L('食パンは製品ごとにアレルゲン（小麦、乳、卵など）や原材料が違い、参照できる表示がないため「不明」としています。ヨーグルトも参照できる表示がないため「不明」です。マヨネーズのアレルゲンは参照した製品表示によります。', 'Bread allergens and ingredients vary by product and no label was cited, so they are recorded as unknown; so is yogurt. Mayonnaise follows the label cited.'),
    ],
    sources: [src],
  }));
}

// 9 kikkoman-potetokoroke
{
  const page = recipeSrc('src-kikkoman-potato-croquette-bento', KIK, 'ポテトコロッケ弁当 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/lunch/enji/potetokoroke.html', ['recipe']);
  const main = recipeSrc('src-kikkoman-potato-croquette', KIK, 'ポテトコロッケ（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/search/recipe/00002936/', ['recipe']);
  const side = recipeSrc('src-kikkoman-zucchini-gomaae', KIK, 'ズッキーニのごまあえ（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', 'https://www.kikkoman.co.jp/homecook/search/recipe/00002937/', ['recipe']);
  r3.push(rec({
    id: 'rcp-kikkoman-potato-croquette-bento',
    name: L('ポテトコロッケ弁当', 'Potato croquette bento'),
    shortNameJa: 'コロッケ', shortNameEn: 'Korokke',
    nameKana: 'ぽてところっけべんとう',
    style: 'western-inspired',
    description: L('レンジでつぶしたじゃがいもに玉ねぎとひき肉を混ぜて揚げた小さなコロッケに、ズッキーニのごまあえを添えた園児向けの弁当です。', 'Small croquettes of microwaved mashed potato with onion and mince, served with zucchini in sesame dressing; a kindergarten bento.'),
    yield: L('1人分', '1 serving'),
    minutes: 20,
    ingredients: [
      ing('ing-potato', 'じゃがいも', 'potato', 1, 'piece'),
      ing('ing-onion', '玉ねぎ（みじん切り）', 'onion, finely chopped', 3, 'tbsp'),
      ing('ing-ground-mixed', '合いびき肉', 'mixed ground beef and pork', 1, 'tbsp'),
      ing('ing-oil', 'サラダ油（炒め用）', 'vegetable oil (for stir-frying)', 0.5, 'tsp'),
      ing('ing-wheat-flour', '小麦粉（まぶす分）', 'wheat flour (for dusting)', null, 'small-amount'),
      ing('ing-wheat-flour', '小麦粉（衣の液用）', 'wheat flour (for the batter)', 1, 'tbsp'),
      ing('ing-milk', '牛乳（衣の液用）', 'milk (for the batter)', 1, 'tbsp'),
      ing('ing-bread-crumbs', 'パン粉', 'bread crumbs', null, 'small-amount', { p: 'unknown' }),
      ing('ing-oil', '揚げ油', 'oil for deep-frying', null, 'small-amount'),
      ing('ing-salt', '塩', 'salt', null, 'small-amount'),
      ing('ing-pepper', 'こしょう', 'pepper', null, 'small-amount'),
      ing('ing-soy-sauce', 'しょうゆ（コロッケの味つけとソース用、小さじ1/2ずつ）', 'soy sauce (1/2 tsp for seasoning and 1/2 tsp for the sauce)', 1, 'tsp', { p: 'soy' }),
      ing('ing-ketchup', 'トマトケチャップ', 'tomato ketchup', 1, 'tbsp', { p: 'ketchup' }),
      ing('ing-lettuce', 'サラダ菜（添える分）', 'salad greens (to garnish)', null, 'small-amount', { opt: true }),
      ing('ing-zucchini', 'ズッキーニ', 'zucchini', 0.5, 'piece'),
      ing('ing-sesame', 'すりごま（白）', 'ground white sesame', 2, 'tsp'),
      ing('ing-soy-sauce', 'しょうゆ（ごまあえ用）', 'soy sauce (for the sesame dressing)', 0.5, 'tsp', { p: 'soy' }),
      ing('ing-sesame-oil', 'ごま油（1〜2滴）', 'sesame oil (1 to 2 drops)', null, 'small-amount'),
    ],
    steps: [
      L('じゃがいもをぬれたままラップで包み、500Wの電子レンジで3分、上下を返して1分加熱し、熱いうちに皮をむいてつぶします。', 'Wrap the wet potato in cling film, microwave at 500 W for 3 minutes, turn it and microwave 1 more minute; peel and mash while hot.'),
      L('フライパンに油を中火で熱して玉ねぎとひき肉を炒め、塩・こしょう・しょうゆ小さじ1/2で味つけします。', 'Heat the oil in a frying pan, cook the onion and mince and season with salt, pepper and 1/2 tsp soy sauce.'),
      L('つぶしたじゃがいもに炒めたものを加えて混ぜ、2〜3等分して丸めます。', 'Mix the fried mixture into the mashed potato and shape it into 2 to 3 balls.'),
      L('小麦粉、牛乳と小麦粉の液、パン粉の順にまぶし、180℃に熱した油で2分ほど揚げます。', 'Coat in flour, then the milk and flour batter, then bread crumbs, and fry in 180 C oil for about 2 minutes.'),
      L('ケチャップとしょうゆ小さじ1/2を混ぜてソースにし、コロッケに添えます。好みでサラダ菜も一緒に盛ります。', 'Mix the ketchup with 1/2 tsp soy sauce, serve it with the croquettes and add salad greens if you like.'),
      L('ズッキーニは厚さ5mmの輪切りにして、グリル・焼き網・トースターのどれかで4〜6分焼きます。', 'Cut the zucchini into 5 mm rounds and grill them in a grill, on a wire rack or in a toaster for 4 to 6 minutes.'),
      L('焼いたズッキーニに、ごま油を1〜2滴、しょうゆ小さじ1/2、すりごまを加えて混ぜます。', 'Toss the zucchini with the sesame, 1/2 tsp soy sauce and 1 to 2 drops of sesame oil.'),
    ],
    storage: [
      L('揚げ物や焼き物は水分が少なく弁当向きで、ごはんやおかずは冷ましてから詰めるよう、農林水産省が案内しています。', 'MAFF notes that fried and grilled foods have little moisture and suit a bento, and advises cooling food before packing.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。弁当に使うレシピの時間は、コロッケ20分・ズッキーニのごまあえ10分で、主菜のコロッケの20分を所要時間にしています。', 'The source is one serving. The component times are 20 minutes for the croquette and 10 for the zucchini; the main dish time, 20 minutes, is recorded.'),
      L('出典は、卵1個では多すぎるため、牛乳と小麦粉で衣の液を作って代用しています。そのため卵は使いません。', 'The source replaces the beaten egg, which would be too much for one serving, with milk and flour, so no egg is used.'),
      L('コロッケ用とごまあえ用のしょうゆは別の行にしています。出典のキッコーマン製品は一般名にしました。パン粉は製品ごとに原材料が違い、参照できる表示がないため「不明」としています。しょうゆ・ケチャップのアレルゲンは参照した製品表示によります。', 'Soy sauce is listed separately for the croquette and the dressing; brand products are listed generically. Bread crumbs vary by product and no label was cited, so they are recorded as unknown. Soy sauce and ketchup follow the labels cited.'),
      L('サラダ菜は辞書の「レタス」で登録しています。', 'Salad greens (サラダ菜) are recorded under the dictionary entry for lettuce.'),
    ],
    sources: [page, main, side],
  }));
}
