const { I, SRC, T } = require('../lib.cjs');
module.exports = {
  id: 'rcp-delish-kuma-kazarimaki',
  name: T('クマの飾りまき', 'Bear decorative rice rolls'),
  shortNameJa: 'クマ飾り巻',
  shortNameEn: 'BearRoll',
  nameKana: 'くまのかざりまき',
  style: 'japanese',
  themeId: 'theme-animals',
  description: T(
    'ふりかけごはんをのりで巻いて組み合わせ、切り口にクマの顔が出る飾り巻きです。ひと口で食べられる厚さに切れば、行事のお弁当にも使えます。',
    'Furikake rice wrapped in nori and assembled so a bear face appears on the cut end; cut into bite-size slices, it suits party and picnic lunchboxes.',
  ),
  yield: T('4切れ分（ごはん300g）', '4 slices (300 g rice)'),
  minutes: 20,
  ingredients: [
    I('ing-rice', '白ごはん（お茶碗2杯）', 'cooked white rice (2 rice bowls)', 300, 'g'),
    I('ing-furikake', 'かつお節のふりかけ', 'bonito furikake', null, 'to-taste'),
    I('ing-furikake', 'たらこのふりかけ', 'tarako furikake', null, 'to-taste'),
    I('ing-nori', '焼きのり（縦21cm×横19cm）', 'toasted nori (21 cm x 19 cm)', 1, 'sheet'),
  ],
  steps: [
    T('のりをパーツごとに切り分ける。のり①は2枚、のり②は1枚、のり③は2枚、のり④は1枚にする。', 'Cut the nori into labelled parts: 2 pieces of part 1, 1 of part 2, 2 of part 3 and 1 of part 4.'),
    T('ごはんから40gと100gを取り分け、残った160gにはかつお節のふりかけ、100gにはたらこのふりかけを混ぜ込む。', 'Divide the rice into 40 g, 160 g and 100 g. Mix bonito furikake into the 160 g and tarako furikake into the 100 g.'),
    T('のり②に白いままの40gのごはんをのせ、細く巻いて口にする。', 'Put the plain 40 g rice on nori part 2 and roll it thin to make the muzzle.'),
    T('のり③の2枚それぞれにかつお節ごはん15gをのせ、くるくる巻いて耳を2本作る。', 'Put 15 g of the bonito rice on each of the two nori part 3 pieces and roll them to make two ears.'),
    T('のり①の1枚にかつお節ごはん100gを、両端を6cmずつあけて広げる。中央に口をおき、左右に15gずつごはんを足して、のりを片側ずつ倒して丸く整える（顔）。', 'Spread 100 g of bonito rice on one part 1 sheet, leaving 6 cm at each end. Place the muzzle in the middle, add 15 g of rice on each side, fold the nori over one side at a time and shape it round (the face).'),
    T('残りののり①とのり④をごはん粒でつなぎ、たらこごはん80gをのせて、両端を4cmずつあけて広げる。真ん中に小さな山を作る。', 'Join the other part 1 and part 4 with rice grains, spread 80 g of tarako rice on them leaving 4 cm at each end, and make a small mound in the middle.'),
    T('山の左右に耳をのせ、耳の外側に残りのたらこごはんを棒状におく。', 'Set the ears on either side of the mound and lay the remaining tarako rice beside them as sticks.'),
    T('顔の口側を上にしてのせ、のりを片側ずつ重ねて巻く。包丁をぬれ布巾でふきふき4つに切り、のりの目と鼻をつける。', 'Put the face on top with the muzzle side up and wrap the nori over it one side at a time. Cut into 4, wiping the knife with a damp cloth, and add nori eyes and a nose.'),
  ],
  storage: [
    T('小さな子が食べるときは、食べている間は気を散らさず、ゆっくり落ち着いて食べさせて、誤ってのどに詰まらせないようにします（出典の注意書き）。', 'When a small child eats it, keep the child focused and calm so the food is not inhaled (note from the source).'),
    T('ごはんは冷ましてから詰め、保冷剤や保冷バッグを使うか冷蔵庫に入れて、早めに食べます。', 'Pack the rice only when cool, keep it cold with an ice pack and cool bag or in the fridge, and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは飾り巻き1本（4切れ分）の分量で、幼児向けの量とは書かれていません。分量は変えていません。', 'The source gives one decorative roll cut into 4 slices and does not call itself a child portion. Amounts are unchanged.'),
    T('ふりかけの量は元のレシピで「適量」、製品名も書かれていません。参照できる製品表示がないため、アレルゲンは不明として記録しています。使う製品の表示を確認してください。', 'The furikake is given as "as needed" with no product named. No label was cited, so allergens are recorded as unknown; check the label of your own furikake.'),
    T('のりは材料表では1枚で、手順の中でパーツごとに切り分けます。', 'The ingredient list gives one nori sheet, which the steps cut into parts.'),
  ],
  sources: [
    SRC.delish('src-delish-kuma-kazarimaki', 'お子様もゴキゲン♪ クマの飾りまきのレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/161934052545266067', ['recipe', 'storage']),
    SRC.maff(),
  ],
};
