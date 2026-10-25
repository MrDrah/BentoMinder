import { i, run, S } from './lib.mjs';

const DK = 'デリッシュキッチン (every, Inc.)';
run({
  id: 'rcp-delish-niwatori-hiyoko-onigiri',
  name: { ja: 'にわとりとひよこのおにぎり', en: 'Hen and chick rice balls' },
  shortNameJa: 'ひよこおにぎり',
  shortNameEn: 'Chicks',
  nameKana: 'にわとりとひよこのおにぎり',
  style: 'japanese',
  themeId: 'theme-animals',
  description: {
    ja: '白いにわとり1羽と、カレー粉で黄色くしたひよこ2羽の丸いおにぎり。コーンのくちばし、にんじんのほっぺ、のりの目で顔を作ります。肉も魚も使いません。',
    en: 'Round rice balls shaped as one white hen and two chicks coloured yellow with curry powder, with corn beaks, carrot cheeks and nori eyes. No meat or fish.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 30,
  makeAhead: null,
  ingredients: [
    i('ing-rice', '白ごはん（お茶碗1杯）', 'cooked white rice (1 rice bowl)', 150, 'g'),
    i('ing-salt', '塩', 'salt', null, 'small-amount'),
    i('ing-curry-powder', 'カレー粉', 'curry powder', null, 'small-amount'),
    i('ing-corn', 'ホールコーン（缶詰）', 'canned sweetcorn kernels', 4, 'piece'),
    i('ing-carrot', 'にんじん（薄切り）', 'carrot (thin slice)', 1, 'slice'),
    i('ing-nori', '焼きのり', 'toasted nori', null, 'to-taste'),
  ],
  steps: [
    { ja: 'ごはんに塩少々をふって混ぜ、半分に分ける。半量はそのまま丸くにぎり、白いにわとりにする。', en: 'Sprinkle the rice with a pinch of salt, mix and divide it in half. Shape one half into a round ball for the white hen.' },
    { ja: '残りの半量にカレー粉少々を混ぜて黄色くし、小さめの丸いおにぎりを2つ作ってひよこにする。', en: 'Mix a little curry powder into the other half to turn it yellow, and shape two smaller round balls for the chicks.' },
    { ja: 'コーンとにんじんの薄切りを耐熱の器にのせ、ラップをふんわりかけて600Wで30秒レンジ加熱する。', en: 'Put the corn and the carrot slice on a heatproof plate, cover loosely with cling film and microwave at 600 W for 30 seconds.' },
    { ja: 'にんじんをストローで抜いて小さな丸を4つ作る。のりも小さな丸に4つ切り、目にする。', en: 'Punch four small circles out of the carrot with a drinking straw, and cut four small circles of nori for the eyes.' },
    { ja: 'おにぎりをお弁当箱かおかずカップに入れ、コーンでくちばし、にんじんでほっぺ、のりで目をつける。にわとりには赤いピックを刺してとさかにする。', en: 'Set the rice balls in the box or in food cups and add corn beaks, carrot cheeks and nori eyes. Give the hen a comb with a red food pick.' },
  ],
  storage: [
    { ja: 'おにぎりをにぎる前に、手をよく洗いましょう。', en: 'Wash your hands well before shaping the rice balls.' },
  ],
  adaptations: [
    { ja: '元のレシピ（1人分）はごはんがお茶碗2杯です。幼稚園児の1人分はおとなの約半分（キッコーマン「園児のお弁当」）なので、ごはんをお茶碗1杯（同じデリッシュキッチンの表記で150g）にし、おにぎりを小さめにしました。', en: 'The source (1 serving) uses 2 rice bowls of rice. A kindergarten portion is about half an adult one (Kikkoman kindergarten bento series), so this uses 1 bowl (150 g, as DELISH KITCHEN states elsewhere) and makes the balls smaller.' },
    { ja: '顔のパーツ（コーン4粒、にんじん1枚、のり）は3羽分そのまま使い、塩とカレー粉は少々のままです。', en: 'The face parts (4 corn kernels, 1 carrot slice, nori) stay as in the source so all three birds get faces; salt and curry powder stay at a pinch.' },
    { ja: 'カレー粉は香辛料だけの製品を使います。調味料入りの「味付けカレーパウダー」には小麦・乳成分・大豆・豚肉を含む製品があります。', en: 'Use a plain spice-only curry powder. Seasoned curry powders can contain wheat, milk, soy and pork.' },
  ],
  sources: [
    { id: 'src-delish-niwatori-hiyoko-onigiri', publisher: DK, title: 'お弁当にぴったり！ にわとりとひよこのおにぎりのレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/153570755777397005', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-delish-rice-bowl-150g', publisher: DK, title: '忙しい朝でも簡単♪ 焼き親子丼弁当のレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/279503143937508563', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    { id: 'src-kikkoman-enji-portion', publisher: 'キッコーマン株式会社（ホームクッキング）', title: '鮭ハンバーグ（園児のお弁当用）のレシピ・つくり方 | キッコーマン | ホームクッキング', url: 'https://www.kikkoman.co.jp/homecook/search/recipe/00003012/', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe'] },
    S.curry,
    { id: 'src-house-seasoned-curry-powder-label', publisher: 'ハウス食品株式会社', title: '味付けカレーパウダー | 商品カタログトップ | ハウス食品', url: 'https://housefoods.jp/products/catalog/cd_1,085422,spice,curpd,house.html', accessed: '2026-10-25', language: 'ja', usedFor: ['allergen'] },
    S.maff,
  ],
});
