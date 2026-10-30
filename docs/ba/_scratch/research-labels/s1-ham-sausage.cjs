const fs=require('fs');
const src={
 'ing-ham':{id:'src-nipponham-irodori-roast-ham-label',publisher:'日本ハム株式会社',title:'彩りキッチン® ロースハム - ハム | 日本ハム',url:'https://www.nipponham.co.jp/products/ham_sausages/ham/roast/2106/',accessed:'2026-10-30',language:'ja',usedFor:['allergen']},
 'ing-sausage':{id:'src-nipponham-schauessen-label',publisher:'日本ハム株式会社',title:'シャウエッセン® - ソーセージ | 日本ハム',url:'https://www.nipponham.co.jp/products/ham_sausages/sausages/win/2125/',accessed:'2026-10-30',language:'ja',usedFor:['allergen']},
};
const poss={'ing-ham':['alg-egg','alg-milk','alg-soybean','alg-pork'],'ing-sausage':['alg-pork']};
const note={
 'ing-ham':{ja:'ハムは製品によって原材料が違います。参照した製品（日本ハム「彩りキッチン ロースハム」）の表示では、卵・乳・大豆・豚肉が表示されています。使う製品の表示を確認してください。',en:'Ham ingredients vary by product. The label cited (Nippon Ham Irodori Kitchen roast ham) declares egg, milk, soy and pork. Check the label of the product you use.'},
 'ing-sausage':{ja:'ソーセージ（ウインナー）は製品によって原材料が違います。参照した製品（日本ハム「シャウエッセン」）の表示では、豚肉が表示されています。チーズ入りなど他の製品は違うので、使う製品の表示を確認してください。',en:'Sausage ingredients vary by product. The label cited (Nippon Ham Schauessen) declares pork. Other products, such as cheese-filled ones, differ, so check the label of the product you use.'},
};
// replace older generic "unknown" wording where possible
const oldPat=/ロールパンとソーセージは製品ごとに/;
let n=0;
for(const f of ['a','b']){
 const p='data/_research/batch-'+f+'.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));
 for(const r of j){
  const ids=new Set();
  for(const i of r.ingredients)if(src[i.ingredientId]){i.allergenInfo='varies-by-product';i.allergenIds=[];i.possibleAllergenIds=poss[i.ingredientId].slice();ids.add(i.ingredientId);n++;}
  if(!ids.size)continue;
  for(const id of ids){r.sources.push(src[id]);r.adaptations.push(note[id]);}
  const may=[];for(const i of r.ingredients)if(i.allergenInfo==='varies-by-product')for(const x of i.possibleAllergenIds)if(!may.includes(x))may.push(x);
  r.mayContainAllergenIds=may;
  r.allergenDataComplete=!r.ingredients.some(i=>i.allergenInfo==='unknown');
  console.log(r.id,'may',may.join(','),'complete',r.allergenDataComplete);
 }
 fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
}
console.log(n);
