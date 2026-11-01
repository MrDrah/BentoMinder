const fs=require('fs');const path=require('path');
const ROOT='C:/Projects/BentoMinder';
const dict=JSON.parse(fs.readFileSync(ROOT+'/data/dictionary.json','utf8'));
const D=new Map(dict.ingredients.map(i=>[i.id,i]));
const existing={};
for(const f of ['a','b']){for(const r of JSON.parse(fs.readFileSync(ROOT+`/data/_research/batch-${f}.json`,'utf8')))for(const s of r.sources)existing[s.id]=s;}
const mk=(id,publisher,title,url,usedFor,accessed='2026-11-01')=>({id,publisher,title,url,accessed,language:'ja',usedFor});
const KK='キッコーマン株式会社（ホームクッキング）';
const SRC={
 maff:existing['src-maff-lunchbox'],
 soy:existing['src-kikkoman-tokusen-marudaizu-label'],
 ketchup:existing['src-kikkoman-delmonte-ketchup-label'],
 ham:existing['src-nipponham-irodori-roast-ham-label'],
 sausage:existing['src-nipponham-schauessen-label'],
 mayo:existing['src-ajinomoto-pureselect-mayo-label'],
 vinegar:existing['src-mizkan-kokumotsu-su'],
 mentsuyu:mk('src-kikkoman-kappo-hontsuyu-label','キッコーマン株式会社','キッコーマン 割烹本つゆ | 業務用商品 | キッコーマン株式会社','https://www.kikkoman.co.jp/products/product/G060510/index.html',['allergen']),
 udon:mk('src-shimadaya-ryusui-udon-label','シマダヤ株式会社','「流水麺」国産小麦粉使用 うどん ２人前 | うどん | 家庭用チルド商品 | 商品情報 | シマダヤ株式会社','https://www.shimadaya.co.jp/products/category/chilled/udon/009739/',['allergen']),
};
for(const k of Object.keys(SRC))if(!SRC[k])throw new Error('missing src '+k);
const LAB={
 soy:{p:['alg-wheat','alg-soybean']},ketchup:{p:[]},ham:{p:['alg-egg','alg-milk','alg-soybean','alg-pork']},
 sausage:{p:['alg-pork']},mayo:{p:['alg-egg','alg-soybean']},vinegar:{p:['alg-wheat']},
 mentsuyu:{p:['alg-wheat','alg-soybean'],known:true},udon:{p:[]},
};
// I(id, ja, en, qty, unit, opts) ; opts.lab = key of LAB | 'unknown' ; opts.known (animalOriginKnown override) ; opts.opt
function I(id,ja,en,quantity,unit,o={}){
 const e=D.get(id);if(!e)throw new Error('no ingredient '+id);
 let info='known',possible=[];
 if(o.lab==='unknown'){info='unknown';}
 else if(o.lab){info='varies-by-product';possible=LAB[o.lab].p;}
 else if(e.info==='varies')throw new Error('processed food needs lab or unknown: '+id);
 let known=e.animalOriginKnown;
 if(o.lab&&LAB[o.lab]&&LAB[o.lab].known)known=true;
 if(o.known!==undefined)known=o.known;
 return {ingredientId:id,label:{ja,en},quantity,unit,optional:!!o.opt,allergenInfo:info,allergenIds:[...e.inherentAllergenIds],possibleAllergenIds:possible,animalOrigin:[...e.animalOrigin],animalOriginKnown:known,_lab:o.lab};
}
const uniq=a=>[...new Set(a.flat())];
function R(r){
 const labs=uniq(r.ingredients.map(i=>i._lab&&LAB[i._lab]?[i._lab]:[]));
 const srcs=[...r.sources];
 for(const k of labs)if(!srcs.some(s=>s.id===SRC[k].id))srcs.push(SRC[k]);
 if(r.useMaff&&!srcs.some(s=>s.id===SRC.maff.id))srcs.push(SRC.maff);
 const ings=r.ingredients.map(({_lab,...x})=>x);
 const rec={id:r.id,name:r.name,shortNameJa:r.shortNameJa,shortNameEn:r.shortNameEn,nameKana:r.nameKana,style:r.style,themeId:r.themeId||null,description:r.description,yield:r.yield,minutes:r.minutes,makeAhead:null,ingredients:ings,steps:r.steps,storage:r.storage,
  allergenIds:uniq(ings.map(i=>i.allergenIds)),
  mayContainAllergenIds:uniq(ings.filter(i=>i.allergenInfo==='varies-by-product').map(i=>i.possibleAllergenIds)),
  allergenDataComplete:!ings.some(i=>i.allergenInfo==='unknown'),
  allergenScheme:'caa-2026-04',
  animalOrigin:uniq(ings.map(i=>i.animalOrigin)),
  dietDataComplete:ings.every(i=>i.animalOriginKnown),
  dietOk:[],adaptations:r.adaptations,sources:srcs,reviewedBy:'ba-research'};
 const FORB={vegetarian:['meat','pork','beef','chicken','fish-seafood','gelatin'],pescatarian:['meat','pork','beef','chicken','gelatin'],'no-pork':['pork','meat','gelatin'],'no-beef':['beef','meat'],'no-seafood':['fish-seafood']};
 rec.dietOk=rec.dietDataComplete?Object.keys(FORB).filter(d=>!FORB[d].some(t=>rec.animalOrigin.includes(t))):[];
 return rec;
}
function save(recs){const f=ROOT+'/data/_research/batch-d.json';let a=[];try{a=JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){}for(const r of recs){const i=a.findIndex(x=>x.id===r.id);if(i>=0)a[i]=r;else a.push(r)}fs.writeFileSync(f,JSON.stringify(a,null,2)+String.fromCharCode(10));}
module.exports={save,I,R,SRC,mk,KK,D,ROOT};
