const {I,R,SRC,mk,KK,save}=require('./lib.cjs');
const DK='デリッシュキッチン (every, Inc.)';
const recs=[];
// 1 donguri
recs.push(R({
 id:'rcp-delish-donguri-onigiri',
 name:{ja:'どんぐりとリスのおにぎり',en:'Acorn and squirrel rice balls'},
 shortNameJa:'どんぐりリス',shortNameEn:'Squirrel',nameKana:'どんぐりとりすのおにぎり',
 style:'japanese',themeId:'theme-animals',
 description:{ja:'ケチャップごはんで丸いリスの顔を作り、ミートボールとソーセージで作ったどんぐりを持たせる、かわいいキャラ弁風のおにぎりです。',en:'A round squirrel face of ketchup rice holding an acorn made from sausage and a meatball: a cute character rice ball.'},
 yield:{ja:'1人分（ごはん150g）',en:'1 portion (150 g rice)'},minutes:15,
 ingredients:[
  I('ing-rice','白ごはん','cooked white rice',150,'g'),
  I('ing-ketchup','ケチャップ','tomato ketchup',1,'tbsp',{lab:'ketchup'}),
  I('ing-sausage','ソーセージ','sausage',1,'piece',{lab:'sausage'}),
  I('ing-ground-meat','ミートボール（市販品など）','meatball (ready-made)',1,'piece',{lab:'unknown'}),
  I('ing-nori','焼きのり','toasted nori',null,'to-taste'),
 ],
 steps:[
  {ja:'ソーセージを3等分にし、真ん中の1切れをさらに半分に切ります。耐熱皿にのせて軽くラップをかけ、600Wで10秒だけ加熱します。',en:'Cut the sausage into 3 pieces and halve the middle one. Put in a heatproof dish, cover loosely and microwave at 600 W for 10 seconds.'},
  {ja:'ごはんにケチャップを混ぜます。大さじ3を取り分けて5つに丸め、手2つ・鼻・耳2つにします。',en:'Mix the ketchup into the rice. Take 3 tbsp, divide it into 5 and roll balls for the two hands, nose and two ears.'},
  {ja:'残りのごはんは丸く整えて顔にします。',en:'Shape the rest of the rice into a round face.'},
  {ja:'ミートボールを半分に切り、ソーセージの切り口と合わせてつまようじでとめ、どんぐりにします。',en:'Halve the meatball and fix it to the sausage piece with a toothpick to make an acorn.'},
  {ja:'弁当箱に顔のごはんを入れ、手・鼻・耳のごはんを付けて、どんぐりを手の間にのせます。',en:'Put the face in the lunchbox, add the hand, nose and ear balls, and set the acorn between the hands.'},
  {ja:'のりを切って目、鼻、リスの模様を作り、顔にのせます。つまようじは食べる前に必ず外します。',en:'Cut the nori into eyes, nose and squirrel markings and place them on the face. Remove the toothpick before eating.'},
 ],
 storage:[{ja:'十分に冷ましてからふたを閉め、保冷剤を入れて涼しい場所に置き、早めに食べさせます。',en:'Let everything cool fully before closing the lid, add an ice pack, keep it cool and eat it soon.'}],
 adaptations:[
  {ja:'元のレシピは1人分（お茶碗1杯分のごはん、150g）で、分量はそのままです。幼児向けに減らしてはいません。',en:'The source is for 1 person (one bowl, 150 g rice); amounts are kept as stated and not reduced for a small child.'},
  {ja:'ミートボールは市販品を想定しています。元のページに原材料は書かれておらず、表示も見つからなかったため、アレルゲンは不明としました。使う製品の表示を確認してください。ひき肉の汎用IDで記録しています。',en:'The source does not say which meatball to use and no label was found, so its allergens are recorded as unknown; check the product you use. It is recorded under the generic minced-meat id.'},
  {ja:'ソーセージは日本ハムのシャウエッセンの表示を例にしています。使う製品の表示を確認してください。ケチャップはデルモンテ製品の表示を例にしています。',en:'The sausage allergen data come from the Nippon Ham Schauessen label as an example, and the ketchup from the Del Monte label; check the label of the products you use.'},
  {ja:'のりの量は「適量」と書かれているため、分量の数値はありません。',en:'The nori amount is given only as "as needed", so there is no number.'},
 ],
 sources:[mk('src-delish-donguri-onigiri',DK,'ラブリーっす♡ どんぐりとリスのおにぎりのレシピ動画・作り方 | デリッシュキッチン','https://delishkitchen.tv/recipes/165418831840280979',['recipe','storage'])],
}));
// 2 broccoli
recs.push(R({
 id:'rcp-delish-broccoli-mazegohan',
 name:{ja:'ブロッコリーとしょうがの混ぜご飯',en:'Broccoli and ginger mixed rice'},
 shortNameJa:'ブロ混ぜご飯',shortNameEn:'Mix rice',nameKana:'ぶろっこりーとしょうがのまぜごはん',
 style:'japanese',themeId:null,
 description:{ja:'レンジで加熱したブロッコリーとしょうが、塩昆布をごはんに混ぜるだけの5分の混ぜご飯。おにぎりにしても使えます。',en:'A 5-minute mixed rice: microwaved broccoli and ginger stirred into rice with salted kelp. It also works as rice balls.'},
 yield:{ja:'2人分（ごはん300g）',en:'2 servings (300 g rice)'},minutes:5,
 ingredients:[
  I('ing-broccoli','ブロッコリー','broccoli',0.25,'piece'),
  I('ing-ginger','しょうが','ginger',1,'piece'),
  I('ing-kombu','塩昆布','salted kelp (shio-kombu)',1,'tbsp',{lab:'unknown'}),
  I('ing-salt','塩','salt',null,'small-amount'),
  I('ing-rice','白いごはん','cooked white rice',300,'g'),
  I('ing-sesame-oil','ごま油','sesame oil',1,'tbsp'),
 ],
 steps:[
  {ja:'しょうがをみじん切りにして水にさらし、水けをきります。',en:'Mince the ginger, soak it briefly in water and drain.'},
  {ja:'ブロッコリーを粗みじん切りにして容器に入れ、ふんわりラップをして600Wで1分加熱します。',en:'Chop the broccoli coarsely, put it in a dish, cover loosely and microwave at 600 W for 1 minute.'},
  {ja:'ブロッコリーにしょうが、塩、ごま油を合わせ、熱いまま混ぜます。',en:'While it is still warm, mix in the salt, sesame oil and ginger.'},
  {ja:'別の容器にごはんと塩昆布、味をつけたブロッコリーを加えて全体を混ぜます。',en:'Put the rice, salted kelp and seasoned broccoli in a container and mix well.'},
 ],
 storage:[{ja:'混ぜご飯はしっかり冷めてから弁当箱に入れ、ふたを閉めます。持ち運ぶときは保冷剤などで冷やします。',en:'Let the mixed rice cool fully before packing and closing the lid, and keep it cool with an ice pack when carrying.'}],
 useMaff:true,
 adaptations:[
  {ja:'元のレシピは2人分（ごはんお茶碗2杯・300g）です。幼児1人分の目安は書かれていないため、分量はそのまま記録しました。',en:'The source makes 2 servings (two bowls, 300 g rice). It gives no child share, so amounts are recorded as stated.'},
  {ja:'「しょうが1かけ」は1個として記録しています。ブロッコリーは1/4個です。',en:'"1 kake" of ginger is recorded as 1 piece; the broccoli is 1/4 of a head.'},
  {ja:'塩昆布は製品によって原材料が違うため、表示が見つからずアレルゲンは不明としました。使う製品の表示を確認してください。',en:'Salted kelp varies by product and no label was found, so its allergens are recorded as unknown; check the product you use.'},
  {ja:'保存の注意は、農林水産省の弁当の食中毒予防のページ（冷ましてから詰める）に基づきます。',en:'The storage note follows the MAFF lunchbox food-poisoning page (cool before packing).'},
 ],
 sources:[mk('src-delish-broccoli-mazegohan',DK,'栄養満点！ ブロッコリーとしょうがの混ぜご飯のレシピ動画・作り方 | デリッシュキッチン','https://delishkitchen.tv/recipes/157726418141184492',['recipe'])],
}));
// 3 yakiudon
recs.push(R({
 id:'rcp-delish-yakiudon-bento',
 name:{ja:'焼うどん弁当',en:'Yakiudon bento'},
 shortNameJa:'焼うどん',shortNameEn:'Yakiudon',nameKana:'やきうどんべんとう',
 style:'japanese',themeId:null,
 description:{ja:'豚肉と野菜をめんつゆ味で炒めたシンプルな焼うどん。仕上げのごま油で麺がくっつきにくく、紅しょうがを添えます。',en:'A simple stir-fried udon with pork and vegetables in mentsuyu; finishing sesame oil keeps the noodles from sticking. Served with red pickled ginger.'},
 yield:{ja:'1人分',en:'1 portion'},minutes:15,
 ingredients:[
  I('ing-udon','ゆでうどん','boiled udon',1,'piece',{lab:'udon'}),
  I('ing-pork','豚こま切れ肉','pork scraps',50,'g'),
  I('ing-carrot','にんじん','carrot',30,'g'),
  I('ing-onion','玉ねぎ','onion',50,'g'),
  I('ing-green-pepper','ピーマン','green pepper',30,'g'),
  I('ing-salt','塩（塩こしょうとして）','salt (from the salt-and-pepper mix)',null,'small-amount'),
  I('ing-pepper','こしょう','pepper',null,'small-amount'),
  I('ing-oil','サラダ油','vegetable oil',0.5,'tbsp'),
  I('ing-sesame-oil','ごま油','sesame oil',0.5,'tbsp'),
  I('ing-benishoga','紅しょうが','red pickled ginger',10,'g',{lab:'unknown'}),
  I('ing-mentsuyu','めんつゆ（3倍濃縮）','mentsuyu (3x concentrate)',1,'tbsp',{lab:'mentsuyu'}),
  I('ing-ginger','おろししょうが','grated ginger',0.5,'tsp'),
 ],
 steps:[
  {ja:'にんじんは1cm幅の縦切りにしてから薄切りにし、玉ねぎは薄切り、ピーマンは縦半分にして種を除き、横5mm幅に切ります。',en:'Cut the carrot lengthwise into 1 cm strips then slice thinly; slice the onion; halve the green pepper, remove the seeds and cut across into 5 mm strips.'},
  {ja:'豚肉に塩とこしょうをふります。',en:'Season the pork with salt and pepper.'},
  {ja:'うどんを耐熱皿にのせ、ふんわりラップをして600Wで1〜2分温め、ほぐします。',en:'Put the udon on a heatproof plate, cover loosely, microwave at 600 W for 1-2 minutes and loosen.'},
  {ja:'フライパンに油を熱して豚肉を炒め、色が変わったら野菜を加えて約2分、しんなりするまで炒めます。',en:'Heat the oil in a pan and fry the pork. When it changes colour add the vegetables and fry about 2 minutes until soft.'},
  {ja:'うどん、めんつゆ、おろししょうが、こしょうを加えて炒め合わせ、ごま油を混ぜます。粗熱をとって十分に冷まします。',en:'Add the udon, mentsuyu, ginger and pepper and stir-fry together, then mix in the sesame oil. Let it cool fully.'},
  {ja:'弁当箱に詰め、紅しょうがを添えます。',en:'Pack into the lunchbox and add the red pickled ginger.'},
 ],
 storage:[{ja:'十分に冷ましてから詰めてふたをし、保冷剤などで涼しく保って早めに食べます。暑い季節は避けたほうが安心です。',en:'Cool fully before packing and closing, keep it cool with an ice pack and eat it soon; avoid it in summer because it spoils easily.'}],
 adaptations:[
  {ja:'元のレシピは1人分で、分量はそのままです。幼児向けに減らしてはいません（うどん1玉）。',en:'The source is for 1 portion and amounts are unchanged; it is not reduced for a small child (one pack of udon).'},
  {ja:'「塩こしょう少々」は塩とこしょうに分けて記録しました。「☆」の調味料はめんつゆ、おろししょうが、こしょうです。',en:'"Salt-and-pepper" is recorded as salt and pepper. The starred seasonings are the mentsuyu, grated ginger and pepper.'},
  {ja:'アレルゲンの表示は、うどんはシマダヤ「流水麺」、めんつゆはキッコーマン割烹本つゆ（業務用の濃縮3倍）を例にしています。使う製品の表示を確認してください。',en:'Allergen data use the Shimadaya Ryusui udon label and the Kikkoman Kappo Hontsuyu label (commercial 3x concentrate) as examples; check the labels of the products you use.'},
  {ja:'紅しょうがは表示が見つからず、アレルゲンは不明としました。めんつゆの原材料にかつお節などの魚介が含まれる点を表示で確認しています。',en:'No label was found for red pickled ginger, so its allergens are recorded as unknown. The mentsuyu label shows it contains bonito and sardine stock, so fish is recorded.'},
 ],
 sources:[mk('src-delish-yakiudon-bento',DK,'味付け簡単！ 焼うどん弁当のレシピ動画・作り方 | デリッシュキッチン','https://delishkitchen.tv/recipes/341116261872174226',['recipe','storage'])],
}));
save(recs);
