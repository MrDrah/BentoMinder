const fs=require('fs');
const S=(id,pub,title,url)=>({id,publisher:pub,title,url,accessed:'2026-10-30',language:'ja',usedFor:['allergen']});
// key: recipeId|ingredientId
const E={
'rcp-kikkoman-tuna-tamago-soboro-bento|ing-canned-tuna':{src:S('src-hagoromo-seachicken-l-flake-label','はごろもフーズ株式会社','シーチキンＬフレーク（140g） | 家庭用商品 | はごろもフーズ株式会社','https://www.hagoromofoods.co.jp/products/detail/250.html'),ids:[],poss:['alg-soybean'],
 note:{ja:'ツナ缶は製品によって原材料が違います。参照した製品（はごろもフーズ「シーチキンＬフレーク」）の表示では、大豆（大豆油）が表示されています。使う製品の表示を確認してください。',en:'Canned tuna ingredients vary by product. The label cited (Hagoromo Sea Chicken L flakes) declares soy (soybean oil). Check the label of the product you use.'}},
'rcp-delish-himawari-bento|ing-salmon-flakes':{src:S('src-nissui-yakisake-arahogushi-label','株式会社ニッスイ','焼さけあらほぐし | 商品情報 | ニッスイ','https://www.nissui.co.jp/product/00046.html'),ids:['alg-salmon'],poss:['alg-soybean'],
 note:{ja:'鮭フレークは製品によって原材料が違います。参照した製品（ニッスイ「焼さけあらほぐし」）の表示では、さけと大豆が表示されています。使う製品の表示を確認してください。',en:'Salmon flakes vary by product. The label cited (Nissui roasted salmon flakes) declares salmon and soy. Check the label of the product you use.'}},
'rcp-nhk-ohanabatake-bento|ing-miso':{src:S('src-marukome-ryotei-nama-miso-label','マルコメ株式会社','料亭の味 生みそ｜マルコメ','https://www.marukome.co.jp/product/detail/miso_025/'),ids:[],poss:['alg-soybean'],
 note:{ja:'みそは製品によって原材料が違います（麦みそや、だし入りなど）。参照した製品（マルコメ「料亭の味 生みそ」）の表示では、大豆が表示されています。使う製品の表示を確認してください。',en:'Miso varies by product (for example barley miso or miso with dashi added). The label cited (Marukome Ryotei no Aji nama miso) declares soy. Check the label of the product you use.'}},
'rcp-kikkoman-niku-yasaimaki-bento|ing-cheese':{src:S('src-meg-snow-6p-cheese-label','雪印メグミルク株式会社','６Ｐチーズ | 商品のご案内 | 雪印メグミルク','https://www.meg-snow.com/products/detail.php?p=6P'),ids:['alg-milk'],poss:[],
 note:{ja:'プロセスチーズは製品によって原材料が違います。参照した製品（雪印メグミルク「６Ｐチーズ」）の表示では、乳成分のみが表示されています。使う製品の表示を確認してください。',en:'Processed cheese varies by product. The label cited (Snow Brand Megmilk 6P cheese) declares milk only. Check the label of the product you use.'}},
};
for(const f of ['a','b']){
 const p='data/_research/batch-'+f+'.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));let ch=false;
 for(const r of j){let hit=false;
  for(const i of r.ingredients){const e=E[r.id+'|'+i.ingredientId];if(!e)continue;hit=true;
   i.allergenInfo='varies-by-product';i.allergenIds=e.ids.slice();i.possibleAllergenIds=e.poss.slice();
   if(!r.sources.some(s=>s.id===e.src.id))r.sources.push(e.src);r.adaptations.push(e.note);}
  if(!hit)continue;ch=true;
  const may=[];for(const i of r.ingredients)if(i.allergenInfo==='varies-by-product')for(const x of i.possibleAllergenIds)if(!may.includes(x))may.push(x);
  r.mayContainAllergenIds=may;
  r.allergenDataComplete=!r.ingredients.some(i=>i.allergenInfo==='unknown');
  console.log(r.id,'may',may.join(','),'complete',r.allergenDataComplete,'diet',r.dietDataComplete);}
 if(ch)fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
}
