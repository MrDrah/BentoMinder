const { I, SRC, T } = require('../lib.cjs');
const SHOYU = { poss: ['alg-wheat', 'alg-soybean'] };
module.exports = {
  id: 'rcp-delish-satsumaimo-gohan-bento',
  name: T('さつまいもごはん弁当', 'Sweet potato rice bento'),
  shortNameJa: 'さつまいも飯',
  shortNameEn: 'Satsuma',
  nameKana: 'さつまいもごはんべんとう',
  style: 'japanese',
  themeId: null,
  description: T(
    '電子レンジでやわらかくしたさつまいもをごはんに混ぜ、レンジで作る鶏もも肉の照り焼きを添えた、やさしい甘みの1人分のお弁当です。',
    'A one-serving bento of rice mixed with microwave-softened sweet potato, with a microwave teriyaki chicken thigh alongside.',
  ),
  yield: T('1人分（ごはん150g）', '1 serving (150 g rice)'),
  minutes: 30,
  ingredients: [
    I('ing-rice', '白ごはん（お茶碗1杯）', 'cooked white rice (1 rice bowl)', 150, 'g'),
    I('ing-sweet-potato', 'さつまいも', 'sweet potato', 70, 'g'),
    I('ing-salt', '塩（さつまいもに）', 'salt (for the sweet potato)', null, 'small-amount'),
    I('ing-chicken-thigh', '鶏もも肉', 'chicken thigh', 70, 'g'),
    I('ing-cooking-sake', '酒', 'cooking sake', 1, 'tbsp'),
    I('ing-mirin', 'みりん', 'mirin', 1, 'tbsp'),
    I('ing-soy-sauce', 'しょうゆ', 'soy sauce', 1, 'tbsp', { lab: SHOYU }),
  ],
  steps: [
    T('さつまいもを1cm角に切って水にさらし、水けをきって耐熱容器に入れ、ふんわりラップをして600Wで1分30秒加熱する。', 'Cut the sweet potato into 1 cm cubes, soak, drain, put in a heatproof dish, cover loosely and microwave at 600 W for 1 minute 30 seconds.'),
    T('さつまいもへ塩をふり、白ごはんにさっくりと混ぜ込む。', 'Sprinkle the sweet potato with salt and fold it lightly into the rice.'),
    T('鶏肉を一口大に切り、耐熱容器に酒、みりん、しょうゆと一緒に入れて混ぜる。', 'Cut the chicken into bite-size pieces and mix them in a heatproof dish with the sake, mirin and soy sauce.'),
    T('ふんわりラップをかけて、600Wで3分加熱する。', 'Cover loosely and microwave at 600 W for 3 minutes.'),
  ],
  storage: [
    T('ごはんも鶏肉も十分に冷ましてから弁当箱に詰めて、蓋を閉めます。', 'Cool both the rice and the chicken fully before packing and closing the lid.'),
    T('鶏肉は中心までしっかり加熱されているか確かめます。冷蔵庫か保冷バッグで保管し、早めに食べます。', 'Check that the chicken is cooked through to the centre. Keep it in the fridge or a cool bag and eat it soon.'),
  ],
  adaptations: [
    T('元のレシピは1人分で、幼児向けとは書かれていません。分量は変えていません。', 'The source is for 1 serving and does not call itself a child portion; amounts are unchanged.'),
    T('塩は元のレシピで「ひとつまみ」のため、少量として記録しています。おかずは鶏の照り焼きだけで、詰め方の説明はありません。', 'Salt is "a pinch" in the source, so it is a small amount. The only side is the teriyaki chicken, and the source gives no packing steps.'),
    T('しょうゆの原材料は製品で違うため、参照した製品の表示（小麦・大豆）にもとづいて記録しています。', 'Soy sauce differs by product; allergens follow the cited label (wheat, soy), so check the label of the one you use.'),
  ],
  sources: [
    SRC.delish('src-delish-satsumaimo-gohan', 'ほっくり優しい甘み！ さつまいもごはん弁当のレシピ動画・作り方 | デリッシュキッチン', 'https://delishkitchen.tv/recipes/171938398854971884', ['recipe']),
    SRC.maff(),
    SRC.shoyu(),
  ],
};
