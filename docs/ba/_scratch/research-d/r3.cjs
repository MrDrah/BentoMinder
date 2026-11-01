const {I,R,SRC,mk,KK,save}=require('./lib.cjs');
const DK='デリッシュキッチン (every, Inc.)';
const recs=[];
// 7 hoisin wraps
recs.push(R({
 id:'rcp-bbc-hoisin-wraps',
 name:{ja:'ホイシンソースのラップ',en:'Hoisin wraps'},
 shortNameJa:'ホイシンラップ',shortNameEn:'Hoisin',nameKana:'ほいしんそーすのらっぷ',
 style:'other',themeId:null,
 description:{ja:'ホイシンソースをからめて焼いた鶏肉と、きゅうり、ねぎ、クレソンをトルティーヤで巻く、10分でできるラップサンドです。',en:'A 10-minute wrap: chicken grilled with hoisin sauce, rolled in a tortilla with cucumber, spring onion and watercress.'},
 yield:{ja:'2人分（トルティーヤ2枚）',en:'Serves 2 (2 tortillas)'},minutes:10,
 ingredients:[
  I('ing-chicken','加熱済みの鶏肉（細切り）','cooked chicken, cut into strips',200,'g'),
  I('ing-hoisin-sauce','ホイシンソース','hoisin sauce',4,'tbsp',{lab:'unknown'}),
  I('ing-tortilla','小麦粉のトルティーヤ','flour tortilla',2,'sheet',{lab:'unknown'}),
  I('ing-cucumber','きゅうり（種を除いて千切り）','cucumber, deseeded and shredded',0.25,'piece'),
  I('ing-green-onion','細ねぎ（千切り）','spring onion, finely shredded',4,'piece'),
  I('ing-watercress','クレソン','watercress',null,'small-amount'),
 ],
 steps:[
  {ja:'グリルを強火で温めます。鶏肉にホイシンソースの半量をからめ、耐熱皿に広げて、ジュージュー音がするまで焼きます。',en:'Heat the grill to high. Coat the chicken with half of the hoisin sauce, spread it on an ovenproof dish and grill until sizzling.'},
  {ja:'トルティーヤはグリルで温めるか、袋の表示どおりに温めます。',en:'Warm the tortillas under the grill or as the pack says.'},
  {ja:'トルティーヤに残りのソースを塗り、鶏肉、きゅうり、ねぎ、クレソンをのせて巻きます。',en:'Spread the rest of the sauce on the tortillas, add the chicken, cucumber, spring onion and watercress and roll up.'},
  {ja:'半分に切ります。お弁当にするときは、冷ましてから詰めます。',en:'Cut in half. If packing it in a lunchbox, let it cool first.'},
 ],
 storage:[{ja:'焼きたてはすぐ食べるレシピです。お弁当にするときは、鶏肉もラップも十分に冷ましてから詰めてふたを閉め、保冷剤で冷やします。',en:'The source serves it warm. For a lunchbox, cool the chicken and wrap fully before packing and closing the lid, and keep it cool with an ice pack.'}],
 useMaff:true,
 adaptations:[
  {ja:'このページはお弁当ではなく、軽食や昼食用のレシピで、お弁当向けの保存の記載はありません。そのため保存の注意は農林水産省の弁当の食中毒予防のページ（冷ましてから詰める）に基づきます。',en:'The source is a snack or lunch recipe, not a bento, and has no lunchbox storage advice; the storage note follows the MAFF lunchbox food-poisoning page (cool before packing).'},
  {ja:'元のレシピは2人分で、分量はそのまま記録しました。幼児向けに減らしてはいません。細ねぎは4本として記録しています。',en:'The source serves 2 and amounts are recorded as stated, not reduced for a child; spring onions are counted as 4 pieces.'},
  {ja:'元のレシピは「七面鳥または鶏肉」とあり、鶏肉で記録しました。クレソンは「ひとつかみ」のため少量としました。',en:'The source says "turkey or chicken"; chicken is recorded. Watercress is "a good handful", recorded as a small amount.'},
  {ja:'ホイシンソースとトルティーヤは製品によって違い、表示が見つからないため、アレルゲンは不明としました。トルティーヤは動物由来の脂が使われるか不明です。',en:'Hoisin sauce and tortillas vary by product and no labels were found, so their allergens are recorded as unknown; whether the tortilla contains animal fat is also unknown.'},
 ],
 sources:[{id:'src-bbc-hoisin-wraps',publisher:'Immediate Media Company Ltd (BBC Good Food)',title:'Hoisin wraps recipe | Good Food',url:'https://www.bbcgoodfood.com/recipes/hoisin-wraps',accessed:'2026-11-01',language:'en',usedFor:['recipe']}],
}));
// 8 tamagoyaki 5 min (reserve)
recs.push(R({
 id:'rcp-delish-tamagoyaki-5min-bento',
 name:{ja:'卵焼き器５分弁当',en:'Tamagoyaki-pan 5-minute bento'},
 shortNameJa:'５分弁当',shortNameEn:'Quick 5',nameKana:'たまごやききごふんべんとう',
 style:'western-inspired',themeId:null,
 description:{ja:'はんぺんと卵のふわふわ卵焼き、ハムチーズのはんぺん焼き、ピーマンと桜えびのマヨ炒めを卵焼き器だけで作る、5分のお弁当です。',en:'Five minutes in one tamagoyaki pan: fluffy hanpen omelette, hanpen stuffed with ham and cheese, and green pepper and dried shrimp in mayonnaise.'},
 yield:{ja:'2人分',en:'2 servings'},minutes:5,
 ingredients:[
  I('ing-egg','卵','egg',1,'piece'),
  I('ing-mirin','みりん','mirin',1,'tbsp'),
  I('ing-salt','塩','salt',null,'small-amount'),
  I('ing-hanpen','はんぺん（1枚）','hanpen (1 piece in total)',1,'piece',{lab:'unknown'}),
  I('ing-oil','サラダ油','vegetable oil',1,'tbsp'),
  I('ing-ham','ハム','ham',1,'slice',{lab:'ham'}),
  I('ing-cheese','スライスチーズ','sliced cheese',1,'slice',{lab:'unknown'}),
  I('ing-green-pepper','ピーマン','green pepper',1,'piece'),
  I('ing-shrimp','桜えび','sakura ebi (tiny dried shrimp)',1,'tbsp'),
  I('ing-pepper','黒こしょう','black pepper',null,'small-amount'),
  I('ing-mayonnaise','マヨネーズ','mayonnaise',1,'tbsp',{lab:'mayo'}),
 ],
 steps:[
  {ja:'ポリ袋にはんぺん半分を入れ、なめらかになるまで揉みます。卵、みりん、塩を加えてさらに揉み混ぜます。',en:'Put half the hanpen in a plastic bag and knead until smooth, then add the egg, mirin and salt and knead again.'},
  {ja:'残りのはんぺんは横から包丁を入れて袋状にし、半分に折ったハムとチーズを挟んで半分に切ります。',en:'Cut a pocket into the side of the other half of the hanpen, tuck in the ham and cheese folded in half, and cut in two.'},
  {ja:'ピーマンは半分に切って種とわたを除き、細切りにします。',en:'Halve the green pepper, remove seeds and pith and cut into thin strips.'},
  {ja:'卵焼き器に油を熱し、1を弱火で約1分焼いて巻き、取り出して食べやすく切ります。',en:'Heat the oil in the tamagoyaki pan, cook the first mixture over low heat for about 1 minute, roll it, take it out and cut it up.'},
  {ja:'同じ卵焼き器を中火で温め、2のはんぺんを返しながら弱火で焼き色がつくまで焼きます。',en:'Heat the pan over medium heat and cook the stuffed hanpen on low, turning, until browned.'},
  {ja:'ピーマンと桜えびをしんなりするまで炒め、マヨネーズと黒こしょうで調味します。',en:'Fry the green pepper and dried shrimp until soft and season with the mayonnaise and black pepper.'},
 ],
 storage:[{ja:'卵とハムを使うので、中まで火を通します。3品とも十分に冷ましてから詰めてふたを閉め、保冷剤で冷やします。',en:'It contains egg and ham, so cook everything through. Cool all three dishes fully before packing and closing the lid, and keep the box cool with an ice pack.'}],
 useMaff:true,
 adaptations:[
  {ja:'元のレシピは2人分です。幼児1人分の目安は書かれていないため、分量はそのまま記録しました。はんぺんは半枚ずつ2回に分かれているため、合計1枚としました。',en:'The source makes 2 servings and gives no child share, so amounts are recorded as stated. Hanpen is listed twice at half a piece and recorded as 1 in total.'},
  {ja:'桜えびは小さな干しえびで、辞書の「えび」で記録し、えびアレルゲンを含めています。',en:'Sakura ebi are tiny dried shrimp, recorded under the generic shrimp id with the shrimp allergen.'},
  {ja:'ハムは日本ハムの彩りキッチン ロースハム、マヨネーズは味の素ピュアセレクトの表示を例にしています。使う製品の表示を確認してください。',en:'Allergen data for the ham (Nippon Ham) and mayonnaise (Ajinomoto Pure Select) come from those labels as examples; check the labels of the products you use.'},
  {ja:'はんぺんとスライスチーズは表示が見つからず、アレルゲンは不明としました。',en:'No labels were found for hanpen and sliced cheese, so their allergens are recorded as unknown.'},
  {ja:'保存の注意は、農林水産省の弁当の食中毒予防のページ（冷ましてから詰める）に基づきます。',en:'The storage note follows the MAFF lunchbox food-poisoning page (cool before packing).'},
 ],
 sources:[mk('src-delish-tamagoyaki-5min-bento',DK,'ねぼすけも助かる！ 卵焼き器５分弁当のレシピ動画・作り方 | デリッシュキッチン','https://delishkitchen.tv/recipes/188357489878630822',['recipe'])],
}));
save(recs);
