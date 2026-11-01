import { ing, rec, recipeSrc, L, NHK, DEL } from './lib.mjs';

export const r2 = [];

// 4 nhk-17096
{
  const src = recipeSrc('src-nhk-17096-salmon-shimeji', NHK, '鮭としめじの照り焼き弁当 レシピ 髙城 順子さん｜みんなのきょうの料理', encodeURI('https://www.kyounoryouri.jp/recipe/17096_鮭としめじの照り焼き弁当.html'));
  r2.push(rec({
    id: 'rcp-nhk-salmon-shimeji-teriyaki-bento',
    name: L('鮭としめじの照り焼き弁当', 'Salmon and shimeji teriyaki bento'),
    shortNameJa: '鮭としめじ', shortNameEn: 'Shimeji',
    nameKana: 'さけとしめじのてりやきべんとう',
    style: 'japanese',
    description: L('照り焼きにした鮭としめじに、れんこんのたらこあえとしば漬けをのせたごはんを合わせた、焼いて炒めるだけの手早い和風弁当です。', 'Teriyaki salmon and shimeji with lotus root dressed in cod roe and rice topped with pickles; quick pan work only.'),
    yield: L('1人分', '1 serving'),
    minutes: 15,
    ingredients: [
      ing('ing-salmon', '生鮭（切り身）', 'fresh salmon fillet', 100, 'g'),
      ing('ing-shimeji', 'しめじ', 'shimeji mushrooms', 30, 'g'),
      ing('ing-oil', 'サラダ油', 'vegetable oil', 0.5, 'tbsp'),
      ing('ing-soy-sauce', 'しょうゆ（照り焼き用）', 'soy sauce (for the teriyaki)', 0.67, 'tbsp', { p: 'soy' }),
      ing('ing-mirin', 'みりん', 'mirin', 0.5, 'tbsp'),
      ing('ing-lotus-root', 'れんこん', 'lotus root', 40, 'g'),
      ing('ing-tarako', 'たらこ', 'salted cod roe', 15, 'g', { p: 'unknown' }),
      ing('ing-vinegar', '酢（酢水用）', 'vinegar (for the soaking water)', 1, 'tsp', { p: 'vinegar' }),
      ing('ing-soy-sauce', 'しょうゆ（たらこ用）', 'soy sauce (for the cod roe)', 1, 'tsp', { p: 'soy' }),
      ing('ing-cooking-sake', '酒', 'sake', 0.5, 'tsp'),
      ing('ing-rice', 'ごはん（温かいもの）', 'warm cooked rice', 150, 'g'),
      ing('ing-shibazuke', 'しば漬け（市販）', 'shibazuke pickles (store-bought)', 15, 'g', { p: 'unknown' }),
    ],
    steps: [
      L('弁当箱にごはんを詰めて冷まします。', 'Pack the rice into the lunch box and let it cool.'),
      L('水1カップに酢小さじ1を混ぜた酢水に、7〜8mm幅の半月切りにしたれんこんを約5分さらし、ざるに上げて水けをきります。', 'Soak the lotus root, cut into 7 to 8 mm half-moons, in 1 cup water with 1 tsp vinegar for about 5 minutes, then drain.'),
      L('たらこは薄皮に切り目を入れて中身をこそげ出し、しょうゆ小さじ1と酒小さじ1/2を混ぜます。', 'Slit the skin of the cod roe, scrape out the roe and mix it with 1 tsp soy sauce and 1/2 tsp sake.'),
      L('しめじは石づきを落として2〜3本ずつにほぐし、鮭は3〜4等分に切ります。', 'Trim the shimeji and separate them into 2 to 3 stems; cut the salmon into 3 to 4 pieces.'),
      L('フライパンに油を中火で熱して鮭を1〜2分焼き、裏返して端に寄せ、空いたところでしめじをさっと炒めます。', 'Heat the oil over medium heat, cook the salmon 1 to 2 minutes, turn it and push it aside, and stir-fry the shimeji in the space.'),
      L('鮭の両面がこんがりし、しめじがやわらかくなったら、しょうゆとみりんをさっとからめます。汁けがほぼ飛んだら皿に取り出し、冷まします。', 'When the salmon is browned and the shimeji soft, add the soy sauce and mirin, coat quickly, take out when the liquid is nearly gone and cool.'),
      L('れんこんを耐熱ボウルに入れ、ふんわりラップ。600Wのレンジで1分ほど加熱し、粗熱がとれたらたらこを加えてあえます。', 'Microwave the covered lotus root at 600 W for about 1 minute, let it cool a little, then toss with the cod roe.'),
      L('1の弁当箱に鮭としめじとれんこんを詰め、ごはんにしば漬けをのせます。', 'Pack the salmon, shimeji and lotus root next to the rice and top the rice with the pickles.'),
    ],
    storage: [
      L('ごはんもおかずも、冷ましてから弁当箱に詰めるよう、農林水産省が案内しています。', 'MAFF advises packing the rice and side dishes only after they have cooled.'),
    ],
    adaptations: [
      L('出典が1人分のため分量はそのままです。ごはんは「150〜200g」と幅があるため、少ない150gにしています。', 'The source is one serving, so amounts are unchanged. Rice is a range (150 to 200 g); the lower 150 g is recorded.'),
      L('しょうゆ大さじ2/3は0.67大さじとして登録しています。酢は材料欄ではたらこあえの欄にありますが、手順では酢水に使うため、そのように書いています。', 'Soy sauce 2/3 tbsp is recorded as 0.67 tbsp. The vinegar sits under the roe dressing in the list, but the steps use it for the soaking water, so it is described that way.'),
      L('たらこ・しば漬けは製品ごとに原材料が違い、参照できる表示がないため、アレルゲンは「不明」としています。しょうゆと酢も製品で違うので表示を確認してください。', 'Cod roe and shibazuke ingredients vary by product and no label was cited, so their allergens are recorded as unknown. Soy sauce and vinegar also vary; check the labels.'),
    ],
    sources: [src],
  }));
}

// 5 delish-corn-edamame
{
  const src = recipeSrc('src-delish-corn-edamame', DEL, '彩りきれい！ とうもろこしと枝豆の混ぜご飯のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/151200673386463526', ['recipe']);
  r2.push(rec({
    id: 'rcp-delish-corn-edamame-mixed-rice',
    name: L('とうもろこしと枝豆の混ぜご飯', 'Corn and edamame mixed rice'),
    shortNameJa: 'とうもろこし飯', shortNameEn: 'Corn mix',
    nameKana: 'とうもろこしとえだまめのまぜごはん',
    style: 'japanese',
    description: L('レンジで加熱したとうもろこしの実をそぎ、解凍した枝豆と一緒に、だしと塩で味つけしたごはんに混ぜた、色のきれいな混ぜごはんです。', 'Kernels cut from microwaved corn and thawed edamame are stirred into rice seasoned with dashi powder and salt, for a colorful mixed rice.'),
    yield: L('2人分（出典のまま）', '2 servings (as in the source)'),
    minutes: 10,
    ingredients: [
      ing('ing-corn', 'とうもろこし', 'sweet corn on the cob', 1, 'piece'),
      ing('ing-edamame', '枝豆（冷凍）', 'edamame (frozen)', 100, 'g'),
      ing('ing-rice', 'あたたかいごはん（どんぶり2杯）', 'warm cooked rice (2 large bowls)', 400, 'g'),
      ing('ing-dashi', '和風顆粒だし', 'Japanese granulated dashi', 1, 'tsp', { p: 'hondashi' }),
      ing('ing-salt', '塩', 'salt', 0.5, 'tsp'),
    ],
    steps: [
      L('枝豆を解凍し、さやから実を取り出します。', 'Thaw the edamame and pop the beans out of the pods.'),
      L('とうもろこしはラップにくるんで電子レンジ（600W）に5分かけます。2〜3つに切り分けて立て、包丁で実を削ぎ落とします。', 'Wrap the corn in cling film and microwave at 600 W for 5 minutes. Cut it into 2 to 3 pieces, stand them upright and slice the kernels off.'),
      L('温かいごはんにだしと塩を加えて混ぜ、そこへ枝豆とコーンを入れて全体を混ぜます。', 'Mix the warm rice, dashi powder and salt in a container, then stir in the edamame and corn.'),
    ],
    storage: [
      L('ごはんが温かいうちに詰めると蒸気がこもって傷みやすいため、冷ましてから詰めるよう農林水産省が案内しています。', 'MAFF warns that packing warm rice traps steam and makes it spoil more easily, so cool it before packing.'),
    ],
    adaptations: [
      L('出典は2人分で、子ども1人分の目安は書かれていないため、分量は2人分のままです。', 'The source is for 2 servings and gives no child share, so amounts stay for 2.'),
      L('「和風顆粒だし」は一般名の「だし」として登録し、参照した製品表示（味の素「ほんだし」）で原材料を確認しました。この製品の表示ではアレルゲンは乳成分で、かつお由来の原料を含みます。製品によって違うので表示を確認してください。', 'The granulated dashi is recorded generically; the label cited (Ajinomoto Hondashi) lists bonito ingredients and milk as the allergen. Products differ, so check the label of the one you use.'),
    ],
    sources: [src],
  }));
}

// 6 delish-sasami-nori
{
  const src = recipeSrc('src-delish-sasami-nori', DEL, 'トースターを活用して！ ささみの唐揚げのり弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/230356543785140703', ['recipe']);
  r2.push(rec({
    id: 'rcp-delish-sasami-karaage-nori-bento',
    name: L('ささみの唐揚げのり弁当', 'Chicken tender karaage nori bento'),
    shortNameJa: 'ささみのり弁', shortNameEn: 'Nori ben',
    nameKana: 'ささみのからあげのりべんとう',
    style: 'japanese',
    description: L('かつお節としょうゆののりごはんに、トースター焼きのささみ唐揚げと、電子レンジで作る卵焼き、それにれんこん入りのきんぴらを合わせた手早い弁当です。', 'Nori rice with bonito flakes and soy sauce, topped with toaster-baked chicken karaage, microwave egg roll and lotus root kinpira.'),
    yield: L('2人分（出典のまま）', '2 servings (as in the source)'),
    minutes: 20,
    ingredients: [
      ing('ing-rice', 'ごはん（お茶碗2杯）', 'cooked rice (2 bowls)', 300, 'g'),
      ing('ing-bonito-flakes', 'かつお節（1袋）', 'bonito flakes (1 pack)', 4, 'g'),
      ing('ing-soy-sauce', 'しょうゆ（のりごはん大さじ1・唐揚げ小さじ2・きんぴら小さじ1の合計）', 'soy sauce (total: 1 tbsp for the rice, 2 tsp for the karaage, 1 tsp for the kinpira)', 2, 'tbsp', { p: 'soy' }),
      ing('ing-nori', '焼きのり', 'toasted nori', 0.5, 'sheet'),
      ing('ing-chicken-tender', 'ささみ（筋なし）2本', 'chicken tenders, tendon removed (2)', 100, 'g'),
      ing('ing-cooking-sake', '酒', 'sake', 1, 'tsp'),
      ing('ing-ginger', 'おろししょうが', 'grated ginger', null, 'small-amount'),
      ing('ing-potato-starch', '片栗粉', 'potato starch', 1, 'tbsp'),
      ing('ing-wheat-flour', '薄力粉', 'plain flour', 1, 'tbsp'),
      ing('ing-oil', 'サラダ油', 'vegetable oil', 1, 'tbsp'),
      ing('ing-egg', '卵', 'egg', 1, 'piece'),
      ing('ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 1, 'tbsp', { p: 'mayo' }),
      ing('ing-mirin', 'みりん（卵焼き大さじ1/2・きんぴら小さじ2の合計）', 'mirin (total: 1/2 tbsp for the egg, 2 tsp for the kinpira)', 3.5, 'tsp'),
      ing('ing-salt', '塩（卵焼き用ひとつまみ）', 'salt (a pinch for the egg)', null, 'small-amount'),
      ing('ing-lotus-root', 'れんこん', 'lotus root', 50, 'g'),
      ing('ing-chikuwa', 'ちくわ', 'chikuwa fish cake', 0.5, 'piece', { p: 'unknown' }),
      ing('ing-sesame-oil', 'ごま油', 'sesame oil', 1, 'tsp'),
      ing('ing-chili-pepper', '唐辛子（輪切り）', 'chili pepper (sliced)', null, 'small-amount'),
      ing('ing-sesame', '白いりごま', 'toasted white sesame', 0.5, 'tsp'),
      ing('ing-shibazuke', 'しば漬け', 'shibazuke pickles', null, 'small-amount', { p: 'unknown' }),
    ],
    steps: [
      L('ポリ袋にささみを入れ、酒・しょうゆ小さじ2・しょうがをなじませるようにやさしくもみます。片栗粉と薄力粉を加え、袋に空気を入れてふり混ぜます。', 'Put the chicken, sake, 2 tsp soy sauce and ginger in a bag and rub gently; add the starch and flour, inflate the bag and shake to coat.'),
      L('天板にホイルを広げ、油の半量を薄くのばしてささみをのせ、残りの油を回しかけます。トースターで5分焼き、返して5分焼いて火を通します。', 'Line a tray with foil, brush half the oil on it, lay the chicken on and drizzle the rest of the oil; toast 5 minutes, turn and toast 5 more until cooked through.'),
      L('耐熱容器に卵・マヨネーズ・みりん・塩を混ぜ、ふんわりラップをして600Wで40秒加熱します。いったん混ぜ、さらに40秒、卵が固まるまで加熱します。', 'Mix the egg, mayonnaise, mirin and salt in a heatproof dish, cover loosely and microwave at 600 W for 40 seconds; stir and microwave 40 more seconds until set.'),
      L('卵焼きはラップにくるんで少し冷まし、4つに切り分けます。', 'Wrap the egg in cling film, let it cool a little and cut it into 4.'),
      L('れんこんはいちょう切りにして水にさらし、水けをきります。ちくわは縦に切って薄切りにします。', 'Cut the lotus root into quarter-rounds, soak in water and drain. Halve the chikuwa lengthwise and slice thinly.'),
      L('フライパンにごま油を熱し、れんこんとちくわを中火でしんなりするまで炒めます。', 'Heat the sesame oil and stir-fry the lotus root and chikuwa over medium heat until the lotus root softens.'),
      L('しょうゆ小さじ1とみりん小さじ2、唐辛子を加え、汁けを飛ばすように炒めたら、いりごまを混ぜます。', 'Add 2 tsp mirin, 1 tsp soy sauce and the chili, cook until the liquid is gone and mix in the sesame.'),
      L('弁当箱に、ごはん1/4量・かつお節・しょうゆ1/4量・ちぎったのり1/4量を重ね、もう一度くり返して2つ作ります。', 'In each box layer 1/4 of the rice, bonito flakes, 1/4 of the soy sauce and torn nori, then repeat; make 2 boxes.'),
      L('ささみの唐揚げ、卵焼き、きんぴらを詰め、しば漬けを添えます。', 'Add the karaage, egg, kinpira and pickles.'),
    ],
    storage: [
      L('卵料理は半熟にせず、完全に固まるまで火を通すよう、農林水産省が案内しています。ちくわなどそのまま食べられる練り製品も、できるだけ加熱するよう案内があります。', 'MAFF advises cooking egg dishes until fully set, and heating ready-to-eat fish-paste products such as chikuwa where possible.'),
      L('ごはんもおかずも冷ましてから詰めるよう案内されています。', 'MAFF also advises cooling rice and side dishes before packing.'),
    ],
    adaptations: [
      L('出典は2人分で、子ども1人分の目安は書かれていないため、分量は2人分のままです。', 'The source is for 2 servings and gives no child share, so amounts stay for 2.'),
      L('材料が20個の上限に収まるよう、しょうゆ（大さじ1＋小さじ2＋小さじ1）は大さじ2に、みりん（大さじ1/2＋小さじ2）は小さじ3.5に合計して1行にしています。', 'To fit the 20-ingredient limit, soy sauce (1 tbsp + 2 tsp + 1 tsp) is totalled as 2 tbsp and mirin (1/2 tbsp + 2 tsp) as 3.5 tsp.'),
      L('ちくわ・しば漬けは製品ごとに原材料が違い、参照できる表示がないため、アレルゲンは「不明」としています。しょうゆ・マヨネーズのアレルゲンは参照した製品表示によります。', 'Chikuwa and shibazuke vary by product and no label was cited, so their allergens are recorded as unknown. Soy sauce and mayonnaise data follow the labels cited.'),
    ],
    sources: [src],
  }));
}
