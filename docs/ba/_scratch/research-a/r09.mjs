import { i, run, S } from './lib.mjs';

const DK = 'デリッシュキッチン (every, Inc.)';
run({
  id: 'rcp-delish-himawari-bento',
  name: { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' },
  shortNameJa: 'ひまわり弁当',
  shortNameEn: 'Himawari',
  nameKana: 'ひまわりべんとう',
  style: 'japanese',
  themeId: 'theme-flowers',
  description: {
    ja: '鮭フレークと大葉、ごまを混ぜたごはんを敷き、焼いたソーセージを花の中心に、コーンを花びらにして並べたひまわりのお弁当。10分ほどでできます。',
    en: 'Rice mixed with salmon flakes, shiso and sesame, topped with a sunflower: a pan-fried sausage in the middle and corn kernels as petals. Ready in about 10 minutes.',
  },
  yield: { ja: '幼児1人分', en: '1 child portion' },
  minutes: 10,
  makeAhead: null,
  ingredients: [
    i('ing-rice', 'ごはん', 'cooked rice', 100, 'g'),
    i('ing-salmon-flakes', '鮭フレーク', 'salmon flakes', 1, 'tbsp', { info: 'unknown' }),
    i('ing-shiso', '大葉', 'shiso leaf', 1, 'slice'),
    i('ing-sesame', '白いりごま', 'toasted white sesame seeds', 1, 'tsp'),
    i('ing-salt', '塩', 'salt', null, 'small-amount'),
    i('ing-sausage', 'ソーセージ', 'sausage', 1, 'stick', { info: 'unknown' }),
    i('ing-corn', 'コーン（缶詰）', 'canned sweetcorn', null, 'to-taste'),
    i('ing-edamame', '枝豆', 'edamame', 4, 'piece'),
    i('ing-oil', 'サラダ油', 'vegetable oil', 1, 'tsp'),
  ],
  steps: [
    { ja: '大葉は軸を落として、細いせん切りにする。', en: 'Trim the stem off the shiso leaf and shred it finely.' },
    { ja: 'ソーセージを輪切りにし、表面に格子の切り込みを入れる。', en: 'Slice the sausage into rounds and score a criss-cross pattern on the surface.' },
    { ja: 'ごはんに鮭フレーク、刻んだ大葉、いりごまを加えて混ぜ、塩少々で味をととのえる。', en: 'Mix the salmon flakes, shredded shiso and sesame into the rice and season with a pinch of salt.' },
    { ja: 'フライパンに油を入れて中火で温め、ソーセージの両面に焼き色をつける。', en: 'Heat the oil in a frying pan over medium heat and brown the sausage on both sides.' },
    { ja: 'お弁当箱に混ぜごはんを平らに敷いてソーセージを中心に置き、まわりにコーンを花びらのように並べて、枝豆を添える。', en: 'Spread the rice flat in the box, put the sausage in the centre, arrange corn kernels around it like petals and add the edamame.' },
  ],
  storage: [
    { ja: '焼いたソーセージは冷ましてから詰め、コーンや枝豆は水気をよくふいてから並べます。', en: 'Let the fried sausage cool before packing, and pat the corn and edamame dry before arranging them.' },
  ],
  adaptations: [
    { ja: '元のレシピが1人分でごはん100gのため、分量はそのままです。', en: 'The source serves one with 100 g of rice, so amounts are unchanged.' },
  ],
  sources: [
    { id: 'src-delish-himawari-bento', publisher: DK, title: '夏カワイイ♪ ひまわり弁当のレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/152838397549871567', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
  ],
});
