const fs=require('fs');
const add={
 'ing-ketchup':{ja:'ケチャップは製品によって原材料が違います。参照した製品（デルモンテ トマトケチャップ）の表示ではアレルゲンの表示はありませんが、使う製品の表示を確認してください。',en:'Ketchup ingredients vary by product. The product label cited (Del Monte tomato ketchup) lists no allergens, but check the label of the product you use.'},
 'ing-curry-powder':{ja:'カレー粉は製品によって原材料が違います。参照した香辛料だけの製品の表示ではアレルゲンの表示はありませんが、使う製品の表示を確認してください。',en:'Curry powder ingredients vary by product. The spice-only products cited list no allergens, but check the label of the product you use.'},
};
let n={};
for(const f of ['a','b']){
 const p='data/_research/batch-'+f+'.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));
 for(const r of j){
  const ids=new Set();
  for(const i of r.ingredients){
   if(add[i.ingredientId]){i.allergenInfo='varies-by-product';i.allergenIds=[];i.possibleAllergenIds=[];ids.add(i.ingredientId);n[i.ingredientId]=(n[i.ingredientId]||0)+1;}
  }
  if(!ids.size)continue;
  for(const id of ids)r.adaptations.push(add[id]);
  const may=new Set();for(const i of r.ingredients)if(i.allergenInfo==='varies-by-product')i.possibleAllergenIds.forEach(x=>may.add(x));
  console.log(r.id,'may',[...may].join(',')||'-','was',r.mayContainAllergenIds.join(',')||'-');
  r.mayContainAllergenIds=r.mayContainAllergenIds.filter(x=>may.has(x));
  for(const x of may)if(!r.mayContainAllergenIds.includes(x))r.mayContainAllergenIds.push(x);
 }
 fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
}
console.log(n);
