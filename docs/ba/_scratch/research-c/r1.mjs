import { ing, rec, recipeSrc, L, NHK, DEL } from './lib.mjs';

const cap = 'cup';
export const r1 = [];

// 1 nhk-18359
{
  const src = recipeSrc('src-nhk-18359-chicken-soboro', NHK, '鶏そぼろ弁当 レシピ 栗原 はるみさん｜みんなのきょうの料理', encodeURI('https://www.kyounoryouri.jp/recipe/18359_鶏そぼろ弁当.html'));
  r1.push(rec({
    id: 'rcp-nhk-chicken-soboro-bento',
    name: L('鶏そぼろ弁当', 'Chicken soboro bento'),
    shortNameJa: '鶏そぼろ', shortNameEn: 'Soboro',
    nameKana: 'とりそぼろべんとう',
    style: 'japanese',
    description: L('だしで煮てから甘辛く炒りつけた鶏そぼろを、そぼろ入り炊き込みごはんにのせ、いり卵と絹さやを添えた弁当です。', 'Chicken soboro, simmered in dashi and then cooked down with a sweet-salty seasoning, goes on rice cooked in the simmering liquid, with scrambled egg and snow peas.'),
    yield: L('4人分（出典のまま）', '4 servings (as in the source)'),
    minutes: 40,
    makeAhead: L('鶏そぼろは前もって作っておけます。ラップで平らに包んで冷凍すると約2週間もちます。', 'The chicken soboro can be made ahead; wrapped flat in cling film and frozen it keeps for about 2 weeks.'),
    ingredients: [
      ing('ing-rice', '米（洗って15分おく）', 'rice, uncooked (washed and left 15 minutes)', 2, cap),
      ing('ing-ground-chicken', '鶏ひき肉', 'ground chicken', 300, 'g'),
      ing('ing-dashi', 'だし（そぼろの煮汁用）', 'dashi (for simmering the mince)', 1, cap, { p: 'unknown' }),
      ing('ing-soy-sauce', 'しょうゆ（煮汁用）', 'soy sauce (simmering liquid)', 1, 'tbsp', { p: 'soy' }),
      ing('ing-cooking-sake', '酒（煮汁用）', 'sake (simmering liquid)', 1, 'tbsp'),
      ing('ing-mirin', 'みりん（煮汁用）', 'mirin (simmering liquid)', 1, 'tbsp'),
      ing('ing-soy-sauce', 'しょうゆ（いり煮用）', 'soy sauce (for cooking the soboro down)', 2, 'tbsp', { p: 'soy' }),
      ing('ing-sugar', '砂糖（いり煮用）', 'sugar (for cooking the soboro down)', 1.5, 'tbsp'),
      ing('ing-cooking-sake', '酒（いり煮用）', 'sake (for cooking the soboro down)', 1, 'tbsp'),
      ing('ing-mirin', 'みりん（いり煮用）', 'mirin (for cooking the soboro down)', 1, 'tbsp'),
      ing('ing-dashi', 'だし（炊き水を2カップにする分）', 'dashi (to top the liquid up to 2 cups for the rice)', null, 'small-amount', { p: 'unknown' }),
      ing('ing-snow-peas', '絹さや', 'snow peas', 100, 'g'),
      ing('ing-salt', '塩（炊き水・絹さや・いり卵用）', 'salt (rice liquid, snow peas, scrambled egg)', null, 'small-amount'),
      ing('ing-egg', '卵', 'eggs', 4, 'piece'),
      ing('ing-sugar', '砂糖（いり卵用）', 'sugar (for the scrambled egg)', 1.5, 'tbsp'),
      ing('ing-cooking-sake', '酒（いり卵用）', 'sake (for the scrambled egg)', 1, 'tbsp'),
    ],
    steps: [
      L('米は洗って水けをきり、15分ほど休ませます。', 'Wash the rice, drain it in a sieve and leave it for about 15 minutes.'),
      L('鍋にだし1カップとしょうゆ・酒・みりんを入れて沸かし、鶏ひき肉を加えます。強めの中火でそっとかき混ぜつつ煮ます。', 'Bring 1 cup dashi, soy sauce, sake and mirin to the boil, add the chicken and simmer over medium-high heat, stirring gently.'),
      L('浮いたアクをすくい、肉の色が変わったらざるにあけて、肉と煮汁を分けます。ここで煮すぎないのがコツです。', 'Skim the scum and, once the meat is just cooked, strain it into meat and liquid. Do not overcook it.'),
      L('煮汁にだしを足して2カップ（400ml）にし、塩を加えて味を調え、洗った米と一緒に炊飯器で炊いて蒸らします。', 'Top the liquid up with dashi to 2 cups (400 ml), season with salt and cook it with the washed rice in the rice cooker, then let it steam.'),
      L('鍋に肉としょうゆ・砂糖・酒・みりんを入れて中火にかけ、混ぜながら汁けが減るまで炒り煮にし、冷まして味をなじませます。', 'Put the meat, soy sauce, sugar, sake and mirin in a pan, cook over medium heat stirring until little liquid is left, and let it cool so the flavor soaks in.'),
      L('絹さやは筋を取り、塩を入れた湯でゆでて冷水にとり、水けをきって斜め細切りにします。', 'String the snow peas, boil them in salted water, cool them in cold water, drain and slice thinly on the diagonal.'),
      L('卵をほぐして砂糖・酒・塩を加えます。鍋を強めの中火にかけ、ふちがふつふつしたら火を弱め、菜箸で素早く混ぜてぽろぽろに仕上げます。', 'Beat the eggs with sugar, sake and salt, cook over medium-high heat and when the edge bubbles lower the heat and stir quickly with chopsticks until crumbly and cooked through.'),
      L('弁当箱にごはんを詰めて冷まし、そぼろ・いり卵・絹さやをのせます。いり卵は別の容器に入れてもよいです。', 'Pack the rice, let it cool, then top with the soboro, egg and snow peas. The egg can go in a separate container.'),
    ],
    storage: [
      L('出典によると、そぼろは平らにしてラップでくるめば、冷凍庫に約2週間置けます。', 'The source says the soboro, cooled and wrapped flat in cling film, keeps in the freezer for about 2 weeks.'),
      L('ごはんとおかずはしっかり冷ましてから詰め、持ち運びでは涼しい場所に置くか保冷剤を使うよう、農林水産省が案内しています。', 'MAFF advises cooling rice and side dishes fully before packing them and keeping the bento cool, with a cold pack for long trips.'),
    ],
    adaptations: [
      L('出典は4人分で、子ども1人分の目安は書かれていないため、分量は4人分のままです。弁当1人分に分けるときは、出典の分量の4分の1を目安にしてください。', 'The source gives 4 servings and no child share, so amounts are kept for 4. For one bento, use about a quarter of the quantities.'),
      L('出典には、そぼろごはん30分・絹さや5分・いり卵5分とそれぞれの時間があり、合計の40分を所要時間にしています。', 'The source lists 30 minutes for the soboro rice, 5 for the snow peas and 5 for the egg; the total, 40 minutes, is recorded.'),
      L('いり卵の手順には【A】と書かれていますが、いり卵の材料欄に砂糖・酒・塩があるため、その材料で作る内容にしました。', 'The egg step refers to seasoning group A, but the egg has its own sugar, sake and salt in the ingredient list, so those are used.'),
      L('砂糖は「1と1/2〜2」と範囲で書かれているため、少ない方の大さじ1と1/2にしています。米は辞書上「ごはん」の項目に登録しています（炊く前の米の分量）。', 'The egg sugar is a range (1.5 to 2 tbsp); the lower value is recorded. Uncooked rice is recorded under the dictionary entry for rice (ごはん).'),
      L('だしは作り方や製品で原材料が違い、出典に種類の記載がないため、アレルゲンと動物性原料は「不明」としています。しょうゆも製品で違うので、使う製品の表示を確認してください。', 'Dashi ingredients vary and the source does not say which kind, so its allergens and animal origin are recorded as unknown. Soy sauce also varies; check the label of the product you use.'),
    ],
    sources: [src],
  }));
}

// 2 delish-panda
{
  const src = recipeSrc('src-delish-panda-onigiri', DEL, 'みんなの注目の的！ パンダのおにぎりのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/162514671742484972');
  r1.push(rec({
    id: 'rcp-delish-panda-onigiri',
    name: L('パンダのおにぎり', 'Panda rice balls'),
    shortNameJa: 'パンダおにぎり', shortNameEn: 'Panda',
    nameKana: 'ぱんだのおにぎり',
    style: 'japanese',
    themeId: 'theme-animals',
    description: L('塩むすびを丸くにぎり、のりで作った耳・目・鼻をのせてパンダの顔にした、材料3つだけの簡単なキャラおにぎりです。', 'Round salted rice balls decorated with nori ears, eyes and noses to look like pandas, made with just three ingredients.'),
    yield: L('1人分（おにぎり2個）', '1 serving (2 rice balls)'),
    minutes: 10,
    ingredients: [
      ing('ing-rice', 'ごはん（お茶碗1杯）', 'cooked rice (1 bowl)', 150, 'g'),
      ing('ing-nori', '焼きのり', 'toasted nori', 1, 'sheet'),
      ing('ing-salt', '塩', 'salt', null, 'small-amount'),
    ],
    steps: [
      L('ごはんに塩を混ぜ、半量ずつラップで包んで丸くにぎり、2個作ります。', 'Mix the salt into the rice, wrap half in cling film at a time and shape into 2 round balls.'),
      L('のりを切り抜いて、耳4つ分・目4つ分・鼻2つ分のパーツにします。', 'Cut the nori into 4 ears, 4 eyes and 2 noses.'),
      L('おにぎりをおかずカップに入れ、のりをのせてパンダの顔にしたら、弁当箱に詰めます。', 'Put the rice balls in a small cup, place the nori to make panda faces and pack into the lunch box.'),
    ],
    storage: [
      L('出典では、おかずはしっかり冷まし、保冷剤や保冷バッグ、または冷蔵庫など涼しい場所に置いて早めに食べるよう案内しています。', 'The source says to cool everything well, keep the bento cool with cold packs or in the fridge, and eat it soon.'),
      L('出典の注意書きによると、小さな子には誤嚥を避けるため、食べるのに集中させ、ゆっくり落ち着いて食べさせます。', 'The source also advises that young children should concentrate on eating and eat calmly to avoid choking.'),
    ],
    adaptations: [
      L('出典が1人分のため、分量はそのままです。', 'The source is already one serving, so amounts are unchanged.'),
      L('出典のミニトマトなど付け合わせの注意書きは、このレシピの材料に含まれないため記録していません。', 'The source tips about side items such as mini tomatoes are not recorded because those items are not in this recipe.'),
    ],
    sources: [src],
  }));
}

// 3 delish-nikumakionigiri
{
  const src = recipeSrc('src-delish-niku-maki-onigiri', DEL, '宮崎発のご当地グルメ！ スティック肉巻きおにぎりのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/126894360120787329');
  r1.push(rec({
    id: 'rcp-delish-niku-maki-onigiri-stick',
    name: L('スティック肉巻きおにぎり', 'Stick-shaped pork-wrapped rice balls'),
    shortNameJa: '肉巻きスティック', shortNameEn: 'Nikumaki',
    nameKana: 'すてぃっくにくまきおにぎり',
    style: 'japanese',
    description: L('ごはんを棒状に包んで豚バラ肉を巻き、しょうゆ・みりん・砂糖の甘辛いたれをからめて焼いた、手で持って食べやすい肉巻きおにぎりです。', 'Rice shaped into sticks, wrapped in pork belly and glazed in a sweet-salty soy and mirin sauce; easy to eat by hand.'),
    yield: L('4個分（出典のまま）', '4 pieces (as in the source)'),
    minutes: 30,
    ingredients: [
      ing('ing-rice', '温かいごはん', 'warm cooked rice', 400, 'g'),
      ing('ing-pork', '豚バラ薄切り肉（4枚以上）', 'thinly sliced pork belly (4 slices or more)', 4, 'slice'),
      ing('ing-pea-shoots', '豆苗（盛りつけ用）', 'pea shoots (to garnish)', null, 'small-amount'),
      ing('ing-cooking-sake', '酒', 'sake', 1, 'tbsp'),
      ing('ing-mirin', 'みりん', 'mirin', 2, 'tbsp'),
      ing('ing-soy-sauce', 'しょうゆ', 'soy sauce', 2, 'tbsp', { p: 'soy' }),
      ing('ing-sugar', '砂糖', 'sugar', 1, 'tbsp'),
    ],
    steps: [
      L('ごはんを4等分してラップの上で広げ、棒をのせて棒状に包みます。まわりに豚肉を巻き、同様に4本作ります。', 'Divide the rice in 4, spread each on cling film, lay a stick on it and wrap it into a bar. Wrap pork around it; make 4.'),
      L('フライパンを中火で熱して1を並べ、転がしながら肉に火が通ってこんがりするまで焼きます。', 'Heat a frying pan over medium heat, add the bars and roll them until the pork is cooked and browned.'),
      L('酒・みりん・しょうゆ・砂糖を加え、全体にからめながら煮詰めます。器に盛り、豆苗をのせます。', 'Add the sake, mirin, soy sauce and sugar and coat all over while reducing. Serve with pea shoots on top.'),
    ],
    storage: [
      L('出典は、よく冷ましてからふたを閉めること、夏場や梅雨どきは避けることを勧め、保冷剤などで涼しく置いて早く食べるよう案内しています。', 'The source says to let the food cool fully before closing the box, avoid summer and the rainy season, keep it cool with cold packs and eat it soon.'),
    ],
    adaptations: [
      L('出典は4個分で、子ども1人分の目安は書かれていないため、分量は4個分のままです。', 'The source makes 4 pieces and gives no child share, so amounts stay for 4 pieces.'),
      L('出典の材料欄の「スティック」は、割りばしなどで代用できると書かれた巻くための棒で、食材ではないため材料には入れていません。', 'The "stick" in the source list is a rod to shape the rice (chopsticks can replace it), not a food, so it is not listed as an ingredient.'),
      L('豚バラ薄切り肉は辞書の「豚肉」で登録しています。豚肉は「4枚以上」とあるため4枚としています。しょうゆは製品で原材料が違うので表示を確認してください。', 'Pork belly is recorded as generic pork, and "4 slices or more" is recorded as 4. Soy sauce varies by product; check the label.'),
    ],
    sources: [src],
  }));
}
