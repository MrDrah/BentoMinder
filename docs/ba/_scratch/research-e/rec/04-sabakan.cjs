const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-nhk-sabakan-onigiri',
  name: T('さば缶おにぎり', 'Canned-mackerel rice balls'),
  shortNameJa: 'さば缶おにぎり',
  shortNameEn: 'Saba',
  nameKana: 'さばかんおにぎり',
  style: 'japanese',
  themeId: null,
  description: T(
    '味つきのさば缶をほぐしてごはんに混ぜ、真ん中に梅干しを入れて三角ににぎる、包丁を使わない5分のおにぎりです。',
    'Flaked seasoned canned mackerel mixed into rice with a pickled plum in the middle, shaped into triangles in 5 minutes with no knife.',
  ),
  yield: T('2個分', 'Makes 2 rice balls'),
  minutes: 5,
  ingredients: [
    I('ing-rice', 'ごはん', 'cooked rice', 240, 'g'),
    I('ing-canned-mackerel', 'さばのしょうゆ煮（缶詰、1/3缶）', 'canned mackerel simmered in soy sauce (1/3 can)', 50, 'g'),
    I('ing-umeboshi', '梅干し（塩分10〜13%）', 'umeboshi (10 to 13% salt)', null, 'to-taste'),
    I('ing-sesame', '白ごま', 'white sesame seeds', null, 'to-taste'),
    I('ing-shiso', '青じそ', 'green shiso leaves', 2, 'sheet'),
  ],
  steps: [
    T('さばの缶詰は汁けをきり、皮をはずして身をほぐす。梅干しは種を除いてちぎる。', 'Drain the canned mackerel, remove the skin and flake the flesh. Stone the umeboshi and tear it into pieces.'),
    T('ボウルにさば、ごはん、ごまを入れて混ぜる。', 'Put the mackerel, rice and sesame seeds in a bowl and mix.'),
    T('広げたラップ2枚の上に、青じそを1枚ずつ敷く。混ぜたごはんを半分ずつのせ、中央に梅干しを入れて三角にむすぶ。', 'Spread one shiso leaf on each of two sheets of cling film, add half of the rice to each, put umeboshi in the centre and shape into triangles.'),
  ],
  storage: [
    T('ごはんは冷ましてから弁当箱に詰め、保冷剤や保冷バッグなどで涼しく保って早めに食べます。', 'Cool the rice before it goes in the lunchbox, keep it cool with an ice pack or cool bag and eat it soon.'),
    T('食べる前には手をきれいにします。味やにおいがおかしいときは食べません。', 'Clean hands before eating, and do not eat it if the taste or smell seems off.'),
  ],
  adaptations: [
    T('元のレシピは2個分で、幼児向けの分量とは書かれていません。分量は元の表記のままです。', 'The source makes 2 rice balls and does not state a child portion. Amounts are as written there.'),
    T('梅干しと白ごまは元のレシピで「適量」、さば缶は1/3缶（50g）です。', 'The source gives umeboshi and sesame as "as needed" and the mackerel as 1/3 can (50 g).'),
    T('元のレシピには、混ぜずに保存容器に重ねて詰める方法（青じそ4枚）も書かれています。ここでは握る方法だけを記録しています。', 'The source also describes layering the ingredients in a container without mixing (using 4 shiso leaves). Only the shaped version is recorded here.'),
    T('さば缶と梅干しの商品の表示が参照できなかったため、アレルゲンは不明として記録しています（さばは確実に含みます）。缶詰のしょうゆ煮には大豆や小麦が入っていることがあるので、使う製品の表示を確認してください。', 'No product label was found for the canned mackerel or the umeboshi, so their allergens are recorded as unknown (mackerel itself is certain). Soy-simmered cans can contain soy or wheat, so check the label of the one you use.'),
    T('保存の注意は農林水産省のお弁当の食中毒予防のページにもとづいています（元のレシピには保存の記載がありません）。', 'The storage notes follow the MAFF lunchbox food-poisoning page, because the source has none.'),
  ],
  sources: [
    SRC.nhk('src-nhk-sabakan-onigiri', 'さば缶おにぎり レシピ 大原 千鶴さん｜みんなのきょうの料理', 'https://www.kyounoryouri.jp/recipe/44511_さば缶おにぎり.html'),
    SRC.maff(),
  ],
};
