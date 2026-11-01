const fs=require('fs');
const recs=JSON.parse(fs.readFileSync('../../../../data/_research/batch-e.json','utf8'));
const words=(s)=>(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘]/g,"'").match(/[a-z0-9']+/g)??[]);
const html2=(h)=>h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;|&lsquo;/g,"'").replace(/&quot;|&ldquo;|&rdquo;/g,'"').replace(/&#\d+;/g,' ').replace(/\s+/g,' ');
const byUrl={};const fm={'delishkitchen.tv/recipes/169910713454690707':'delish-sakemosaic'};
const urlToFile=(u)=>{const m={
'https://delishkitchen.tv/recipes/169910713454690707':'delish-sakemosaic','https://delishkitchen.tv/recipes/162515636432404972':'delish-undokai','https://www.kyounoryouri.jp/recipe/43442_じゃこおにぎりと鶏ひき肉のみそ煮プレート.html':'nhk-43442','https://www.kyounoryouri.jp/recipe/44511_さば缶おにぎり.html':'nhk-44511','https://www.kikkoman.co.jp/homecook/lunch/enji/ebikaraage.html':'kikkoman-ebikaraage','https://www.kikkoman.co.jp/homecook/search/recipe/00002973/':'kikkoman-ebi-harumaki','https://www.kikkoman.co.jp/homecook/search/recipe/00002974/':'kikkoman-potesara','https://delishkitchen.tv/recipes/155554004321960428':'delish-kumahamburg','https://delishkitchen.tv/recipes/145870359663477235':'delish-wrapchicken','https://delishkitchen.tv/recipes/471840534642558081':'delish-taco','https://delishkitchen.tv/recipes/163962188447351187':'delish-kirin','https://delishkitchen.tv/recipes/180226878752162897':'delish-shumai','https://www.bbcgoodfood.com/recipes/veggie-olive-wraps-mustard-vinaigrette':'bbc-veggie-olive','https://www.kyounoryouri.jp/recipe/18353_野菜たっぷり焼きそば弁当.html':'nhk-18353','https://www.bbcgoodfood.com/recipes/lunchbox-pasta-salad':'bbc-lunchbox-pasta','https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html':'maff-lunchbox'};return m[u]};
let fails=0;
for(const r of recs){
 const grams=new Set();
 for(const s of r.sources){const f=urlToFile(s.url);if(!f)continue;const w=words(html2(fs.readFileSync('pages/'+f+'.html','utf8')));for(let k=0;k+7<=w.length;k++)grams.add(w.slice(k,k+7).join(' '));}
 const fields=[['description',r.description.en],...r.steps.map((s,i)=>['steps.'+i,s.en]),...r.storage.map((s,i)=>['storage.'+i,s.en]),...r.adaptations.map((s,i)=>['adaptations.'+i,s.en])];
 for(const [n,t] of fields){const w=words(t);let best=0,run='';for(let k=0;k+7<=w.length;k++){if(!grams.has(w.slice(k,k+7).join(' ')))continue;let e=k+7;while(e<w.length&&grams.has(w.slice(e-6,e+1).join(' ')))e++;if(e-k>best){best=e-k;run=w.slice(k,e).join(' ')}k=e-1}
  if(best){console.log(r.id,n,best,run);if(best>=12)fails++}}
}
console.log('EN fail count',fails);
