// reserve rank 27 (replaces rank 7): joc-egg-salad-sandwich-bento
const A = '2026-10-25';
const joc = 'Just One Cookbook (Namiko Chen)';
export default {
  id: 'rcp-joc-tamago-sando-bento',
  name: { ja: 'たまごサンド弁当', en: 'Egg salad sandwich bento' },
  shortNameJa: 'たまごサンド',
  shortNameEn: 'Egg sand',
  nameKana: 'たまごさんどべんとう',
  style: 'western-inspired',
  themeId: null,
  description: {
    ja: '前日にゆでておいた卵をつぶしてマヨネーズで和え、食パンにはさんで切るだけの、朝10分でできる日本風のたまごサンドです。',
    en: 'A Japanese-style egg sandwich: an egg boiled the day before is mashed with mayonnaise, spread between two slices of bread and cut to fit the box, about 10 minutes in the morning.',
  },
  yield: { ja: '幼児1人分（サンドイッチ1組）', en: '1 child portion (one sandwich)' },
  minutes: 10,
  makeAhead: { ja: '前日に卵1個を固ゆでにしておきます。', en: 'Hard-boil the egg the day before.' },
  ingredients: [
    ['ing-bread', '食パン（好みのもの）', 'sliced bread of your choice', 2, 'slice', { info: 'unknown' }],
    ['ing-egg', 'ゆで卵（固ゆで・殻をむいたもの）', 'hard-boiled egg, peeled', 1, 'piece'],
    ['ing-mayonnaise', 'マヨネーズ', 'mayonnaise', 1, 'tbsp', { info: 'varies-by-product', possible: ['alg-egg', 'alg-soybean'] }],
    ['ing-salt', '塩・こしょう', 'salt and black pepper', null, 'to-taste'],
    ['ing-sugar', '砂糖（好みで）', 'sugar (optional)', null, 'small-amount', { optional: true }],
  ],
  steps: [
    { ja: '小さなボウルにゆで卵を入れ、フォークで細かくつぶします。', en: 'Put the boiled egg in a small bowl and crush it finely with a fork.' },
    { ja: 'マヨネーズを加えてよく混ぜます。ぱさつくようなら、マヨネーズを大さじ1/2ほど足します。', en: 'Stir in the mayonnaise. If it seems dry, add about another 1/2 tbsp.' },
    { ja: '塩とこしょうで味をととのえます。好みで砂糖をひとつまみ加えます。', en: 'Season with salt and pepper, and a pinch of sugar if you like.' },
    { ja: '食パン1枚に卵を広げ、もう1枚を重ねます。好みでパンの耳を切り落とします。', en: 'Spread the egg over one slice of bread and cover with the other. Trim off the crusts if you like.' },
    { ja: 'お弁当箱の大きさに合わせて2つか3つに切って詰め、すき間に果物や野菜を入れます。', en: 'Cut into halves or thirds to suit the box, pack it, and fill any gaps with fruit or vegetables.' },
  ],
  storage: [
    { ja: 'お弁当に入れるゆで卵は半熟にせず、黄身まで完全に固まるまでゆでます。', en: 'For a lunchbox, do not use a soft-boiled egg; boil it until it is completely set, yolk included.' },
    { ja: '前の晩に作っておく場合は冷蔵庫で保存し、お昼まで冷たい状態を保ちます。', en: 'If you make it the night before, keep it in the fridge and keep it cold until lunchtime.' },
  ],
  adaptations: [
    { ja: '元のレシピはサンドイッチ1組分で、そのまま幼児1人分としました。', en: 'The source makes one sandwich, used here as one child portion.' },
    { ja: '元のレシピは「半熟またはかたゆで」の卵ですが、お弁当用の安全上の注意に従って固ゆでにしました。', en: 'The source allows a soft- or hard-boiled egg; following the bento food-safety advice cited, hard-boiled is used.' },
    { ja: '指定のメーカー品（キユーピーマヨネーズ、ダイヤモンドクリスタルのコーシャーソルト）は一般的な食材名にしました。こしょうは辞書に項目がないため「塩」と一緒に登録しています。マヨネーズのアレルゲンは味の素の製品表示によります。', en: 'Brand products named in the source (Kewpie mayonnaise, Diamond Crystal kosher salt) are listed generically. Pepper has no dictionary entry and is recorded with salt. Mayonnaise allergens follow the Ajinomoto label cited.' },
    { ja: '食パンは製品ごとにアレルゲン（小麦、乳、卵など）や原材料が違い、参照できる表示がないため「不明」としています。マヨネーズも製品で違います。必ず表示を確認してください。', en: 'Bread allergens (wheat, milk, egg and others) and ingredients vary by product and no label was cited, so they are recorded as unknown. Mayonnaise also varies. Always check the labels.' },
  ],
  sources: [
    { id: 'src-joc-egg-salad-sandwich-bento', publisher: joc, title: 'Egg Salad Sandwich たまごサンド弁当 • Just One Cookbook', url: 'https://www.justonecookbook.com/egg-salad-sandwich-bento/', accessed: A, language: 'en', usedFor: ['recipe', 'storage'] },
    { id: 'src-maff-lunchbox', publisher: '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', title: 'お弁当づくりによる食中毒を予防するために：農林水産省', url: 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html', accessed: A, language: 'ja', usedFor: ['storage'] },
    { id: 'src-ajinomoto-allergy-list', publisher: '味の素株式会社（味の素パーク）', title: 'アレルギー物質一覧｜お客様相談センター｜味の素株式会社', url: 'https://www.ajinomoto.co.jp/okyakusama/allergy/allergy.aspx', accessed: A, language: 'ja', usedFor: ['allergen'] },
  ],
};
