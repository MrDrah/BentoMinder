import { i, run } from './lib.mjs';

const DK = 'デリッシュキッチン (every, Inc.)';
run({
  id: 'rcp-delish-penguin-seiretsu-bento',
  name: { ja: 'ペンギンさん整列弁当', en: 'Penguins-in-a-row bento' },
  shortNameJa: 'ペンギン整列',
  shortNameEn: 'Penguins',
  nameKana: 'ぺんぎんさんせいれつべんとう',
  style: 'japanese',
  themeId: 'theme-sea',
  description: {
    ja: 'のり巻きを輪切りにして、切り口をペンギンの顔に見立てたお弁当。コーンのくちばし、黒ごまの目、桜でんぶのほっぺをつけて、ずらりと並べます。',
    en: 'A nori roll cut into rounds, each cut face turned into a penguin with a corn beak, black sesame eyes and pink fish-flake cheeks, lined up in the box.',
  },
  yield: { ja: '幼児1人分（6個）', en: '1 child portion (6 pieces)' },
  minutes: 10,
  makeAhead: null,
  ingredients: [
    i('ing-rice', 'ごはん', 'cooked rice', 150, 'g'),
    i('ing-salt', '塩', 'salt', 0.25, 'tsp'),
    i('ing-nori', '焼きのり', 'toasted nori', 0.5, 'sheet'),
    i('ing-corn', 'コーン（缶詰）', 'canned sweetcorn kernels', 12, 'piece'),
    i('ing-sesame', '黒いりごま（粒）', 'toasted black sesame seeds', 12, 'piece'),
    i('ing-sakura-denbu', '桜でんぶ', 'sakura denbu (sweet pink fish flakes)', null, 'to-taste', { info: 'unknown' }),
  ],
  steps: [
    { ja: 'ごはんに塩小さじ1/4を混ぜる。', en: 'Mix 1/4 tsp salt into the rice.' },
    { ja: 'ラップの上に焼きのりを置き、手前の半分にごはんを広げる。手前から巻いて、断面が楕円になるように形を整える。', en: 'Lay the nori on cling film and spread the rice over the half nearest you. Roll it up from the near edge, shaping it so the cross-section is oval.' },
    { ja: '6等分に切る。包丁は濡れぶきんでこまめにふくと、きれいに切れる。', en: 'Cut into 6 slices; wipe the knife often with a damp cloth for clean cuts.' },
    { ja: '切り口を顔に見立て、コーン2粒をさしてくちばし、黒ごま2粒で目、桜でんぶでほっぺをつける。6個とも同じように仕上げて詰める。', en: 'Treat each cut face as a penguin: push in 2 corn kernels for the beak, add 2 black sesame seeds for eyes and a little sakura denbu for cheeks. Finish all 6 the same way and pack them.' },
  ],
  storage: [
    { ja: 'ごはんは粗熱が十分に取れてから詰めます。', en: 'Pack the rice only once it has cooled well.' },
    { ja: '小さな子どもが食べるときは、のどに詰まらせないよう、落ち着いて食べることに集中させましょう。', en: 'When small children eat this, have them sit calmly and focus on eating so they do not choke.' },
  ],
  adaptations: [
    { ja: '元のレシピは1本分（12個、ごはん300g）です。ほかの幼児向けお弁当のごはんの量（100～150g）に合わせて半量の6個分にし、のりは1/2枚、塩は小さじ1/4、コーンと黒ごまは12粒ずつにしました。', en: 'The source makes one roll (12 pieces, 300 g rice). It is halved to 6 pieces to match the rice in other small-child bentos (100–150 g): 1/2 sheet of nori, 1/4 tsp salt, 12 corn kernels and 12 sesame seeds.' },
  ],
  sources: [
    { id: 'src-delish-penguin-seiretsu-bento', publisher: DK, title: 'かわいいがいっぱい♪ ペンギンさん整列弁当のレシピ動画・作り方 | デリッシュキッチン', url: 'https://delishkitchen.tv/recipes/254879160311218449', accessed: '2026-10-25', language: 'ja', usedFor: ['recipe', 'storage'] },
  ],
});
