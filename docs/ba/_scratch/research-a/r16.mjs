import { i, run, S, SOY } from './lib.mjs';

const DK = 'デリッシュキッチン (every, Inc.)';
run({
  id: 'rcp-delish-yaki-oyakodon-bento',
  name: { ja: '焼き親子丼弁当', en: 'Pan-fried oyakodon bento' },
  shortNameJa: '焼き親子丼',
  shortNameEn: 'Oyakodon',
  nameKana: 'やきおやこどんべんとう',
  style: 'japanese',
  themeId: null,
  description: {
    ja: '鶏肉と玉ねぎを甘辛く炒め、角切りにした卵焼きと一緒に、刻みのりを敷いたごはんにのせる焼き親子丼。卵焼き器ひとつで15分ほどで作れます。',
    en: 'Chicken and onion stir-fried in a sweet soy glaze, served with cubes of omelette over rice lined with shredded nori. Made in one omelette pan in about 15 minutes.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 15,
  makeAhead: null,
  ingredients: [
    i('ing-rice', 'ごはん', 'cooked rice', 75, 'g'),
    i('ing-chicken-thigh', '鶏もも肉', 'chicken thigh', 50, 'g'),
    i('ing-egg', '溶き卵', 'beaten egg', 0.5, 'piece'),
    i('ing-onion', '玉ねぎ', 'onion', 25, 'g'),
    i('ing-oil', 'サラダ油', 'vegetable oil', 1, 'tsp'),
    i('ing-nori', '刻みのり', 'shredded nori', null, 'to-taste'),
    i('ing-cooking-sake', '酒', 'sake', 0.75, 'tsp'),
    i('ing-mirin', 'みりん', 'mirin', 0.75, 'tsp'),
    SOY('しょうゆ', 'soy sauce', 0.75, 'tsp'),
  ],
  steps: [
    { ja: '鶏肉を2cm角に切り、玉ねぎは薄くスライスする。', en: 'Cut the chicken into 2 cm cubes and slice the onion thinly.' },
    { ja: '卵焼き器に油小さじ1/2を入れて温め、溶き卵を流し入れる。弱めの中火で半熟になったら端に寄せて形を整え、中まで火が通るまで焼く。', en: 'Heat 1/2 tsp oil in an omelette pan and pour in the egg. Over medium-low heat, when it is half set push it to one side, shape it and cook until set right through.' },
    { ja: '焼けた卵はいったん皿に移し、冷めたら1cmくらいの角切りにする。', en: 'Take the egg out, let it cool and cut it into roughly 1 cm cubes.' },
    { ja: '同じ卵焼き器で残りの油小さじ1/2を温め、鶏肉を弱めの中火で色が変わるまで炒める。', en: 'Heat the remaining 1/2 tsp oil in the same pan and fry the chicken over medium-low heat until it changes colour.' },
    { ja: '玉ねぎを加え、しんなりして鶏肉に火が通るまで炒め合わせる。', en: 'Add the onion and keep frying until it is soft and the chicken is cooked through.' },
    { ja: '酒・みりん・しょうゆを小さじ3/4ずつ加えて煮からめ、とろみが出たら火を止めて冷ます。', en: 'Add 3/4 tsp each of sake, mirin and soy sauce and toss until the sauce thickens, then take off the heat and let it cool.' },
    { ja: 'ごはんを詰めたら上に刻みのりを散らし、角切りの卵と鶏肉を並べる。', en: 'Pack the rice, scatter the shredded nori over it and top with the egg cubes and the chicken.' },
  ],
  storage: [
    { ja: '卵は半熟で止めず、中まで火が通るまで焼いてから切ります。', en: 'Do not stop at half-set: cook the egg right through before cutting it.' },
    { ja: '鶏肉は中まで火が通ったことを確かめてから味をからめ、冷ましてから詰めます。', en: 'Make sure the chicken is cooked through before adding the sauce, and let it cool before packing.' },
  ],
  adaptations: [
    { ja: '元のレシピ（1人分）はごはん150g・鶏もも肉100gのおとなの量です。幼稚園児の1人分はおとなの約半分（キッコーマン「園児のお弁当」）なので、すべて半量にしました（玉ねぎ1/4個50g→25g、調味料各大さじ1/2→小さじ3/4、油小さじ2→小さじ1）。', en: 'The source (1 serving: 150 g rice, 100 g chicken thigh) is an adult portion. A kindergarten portion is about half an adult one (Kikkoman kindergarten bento series), so everything is halved (onion 1/4 = 50 g → 25 g, each seasoning 1/2 tbsp → 3/4 tsp, oil 2 tsp → 1 tsp).' },
  ],
  sources: [
    { id: 'src-delish-yaki-oyakodon-bento', publisher: DK, title: '忙しい朝でも簡単♪ 焼き親子丼弁当のレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/279503143937508563', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
    { id: 'src-kikkoman-enji-portion', publisher: 'キッコーマン株式会社（ホームクッキング）', title: '鮭ハンバーグ（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003012/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    S.soy,
    S.maff,
  ],
});
