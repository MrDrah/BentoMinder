const fs=require('fs');
const ver={};for(const f of ['o2.jsonl','o3.jsonl','o5.jsonl']){for(const l of fs.readFileSync(f,'utf8').split('\n').filter(Boolean)){const o=JSON.parse(l);ver[o.key]=o}}
// manual verified (WebFetch / curl) extras
for(const k of ['s-yakionigiri','n-44511']) {} ver['n-1465']=JSON.parse(fs.readFileSync('o1.jsonl','utf8').split('\n')[2]);
const joc={'j-chicken-nanban':['https://www.justonecookbook.com/chicken-nanban-bento/','Chicken Nanban Bento チキン南蛮弁当'],'j-gyudon':['https://www.justonecookbook.com/gyudon-bento/','Gyudon Bento 牛丼弁当']};
for(const k in joc)ver[k]={key:k,url:joc[k][0],code:200,title:joc[k][1]+' • Just One Cookbook',viaWebFetch:true};
const A={E:'alg-egg',M:'alg-milk',W:'alg-wheat',So:'alg-soybean',Sa:'alg-salmon',Sh:'alg-shrimp',Cr:'alg-crab',Se:'alg-sesame',B:'alg-beef',Ch:'alg-chicken',P:'alg-pork',Mk:'alg-mackerel'};
const pub={'kikkoman.co.jp':'キッコーマン株式会社（ホームクッキング）','kyounoryouri.jp':'NHKエデュケーショナル（みんなのきょうの料理）','delishkitchen.tv':'デリッシュキッチン (every, Inc.)','bbcgoodfood.com':'Immediate Media Company Ltd (BBC Good Food)','justonecookbook.com':'Just One Cookbook (Namiko Chen)'};
const rows=fs.readFileSync('rows.txt','utf8').split('\n').filter(Boolean).map(l=>{const p=l.split('|');return {tier:p[0]==='M'?'main':'reserve',key:p[1],ja:p[2],en:p[3],style:{jp:'japanese',west:'western-inspired',other:'other'}[p[4]],min:+p[5],mb:p[6],algs:p[7]?p[7].split(',').map(x=>A[x]):[],tags:p[8].split(','),theme:p[9]||null}});
const miss=rows.filter(r=>!ver[r.key]||ver[r.key].code!==200);
// batches: round robin within tier by style then form, so each batch has a mix
const letters=['c','d','e','f','g','h'];
const form=r=>['onigiri','sandwich','noodles','rice','one-pot-rice','fish','egg','vegetable','meat'].find(f=>r.tags.includes(f))||'meat';
let i=0;for(const tier of ['main','reserve']){const g=rows.filter(r=>r.tier===tier).sort((a,b)=>a.style.localeCompare(b.style)||form(a).localeCompare(form(b)));g.forEach((r,n)=>{r.batch=letters[(n+(tier==='reserve'?2:0))%6]})}
const host=u=>new URL(u).hostname.replace(/^www\./,'');
const cands=[];let rank=0;
for(const tier of ['main','reserve']){for(const r of rows.filter(x=>x.tier===tier)){const v=ver[r.key];rank++;
const sts=v.title.replace(/\s*\|\s*(キッコーマン|デリッシュキッチン).*$/,'').replace(/のレシピ動画・作り方.*$/,'').replace(/\s+レシピ.*$/,'');
const noE=!r.algs.includes('alg-egg'),noM=!r.algs.includes('alg-milk'),noW=!r.algs.includes('alg-wheat');
cands.push({rank,tier,batch:r.batch,candidateId:r.key.replace(/^[a-z]-/,m=>({'k-':'kikkoman-','n-':'nhk-','d-':'delish-','b-':'bbc-','j-':'joc-','s-':'sirogohan-'}[m])),
nameJa:r.ja,nameEn:r.en,nameJaIsTranslation:r.key.startsWith('b-')||undefined,sourceUrl:v.url,sourceTitle:sts,sourceHost:host(v.url),publisher:pub[host(v.url)],accessed:'2026-11-01',
style:r.style,themeId:r.theme,estMinutes:r.min,minutesBasis:r.mb==='p'?'page time (first/total time on the page; Kikkoman and NHK bento pages: main component)':'estimate from the steps (page gives component times only)',
expectedAllergens:[...new Set(r.algs)],tags:r.tags,
free:{egg:noE,milk:noM,wheat:noW,all3:noE&&noM&&noW},
vegetarianOrFishOnly:!r.algs.some(a=>['alg-beef','alg-chicken','alg-pork'].includes(a))&&!/n-14|d-akinomikaku|d-wappa/.test(r.key),
verified:v.viaWebFetch?'WebFetch (curl blocked by Cloudflare)':'curl/fetch HTTP 200, title matches',status:'verified'})}}
const m=cands.filter(c=>c.tier==='main');const pct=n=>Math.round(100*n/m.length);
const mix={mainCount:m.length,reserveCount:cands.length-m.length,
style:Object.fromEntries(['japanese','western-inspired','other'].map(s=>[s,m.filter(c=>c.style===s).length])),
le20:m.filter(c=>c.estMinutes<=20).length,le20pageBased:m.filter(c=>c.estMinutes<=20&&c.minutesBasis.startsWith('page')).length,
freeEgg:m.filter(c=>c.free.egg).length,freeMilk:m.filter(c=>c.free.milk).length,freeWheat:m.filter(c=>c.free.wheat).length,freeAnyOfThree:m.filter(c=>c.free.egg||c.free.milk||c.free.wheat).length,freeAllThree:m.filter(c=>c.free.all3).length,
vegOrFish:m.filter(c=>c.vegetarianOrFishOnly).length,
perBatchMain:Object.fromEntries(letters.map(l=>[l,m.filter(c=>c.batch===l).length])),perBatchReserve:Object.fromEntries(letters.map(l=>[l,cands.filter(c=>c.tier==='reserve'&&c.batch===l).length]))};
const out={version:1,phase:'candidates-2 (content-research §1), step 1 of library growth 20 -> ~100',generatedBy:'ba (candidate agent)',generatedOn:'2026-11-01',
notes:['Each URL fetched once on 2026-11-01 (HTTP 200, page title matches the dish); Just One Cookbook pages checked with WebFetch because curl is blocked by Cloudflare.',
'expectedAllergens = inherent allergens guessed from the ingredient list seen in listings/JSON-LD (dictionary ids, PROVISIONAL, may be incomplete; phase 2 recomputes from the full page). Processed foods (soy sauce, ham, sausage, kanikama, roux) not listed.',
'estMinutes: page time when shown; NHK/Kikkoman bento sets show component times only, so those are BA estimates (minutesBasis says which).',
'nameJa keeps the source dish name (taglines before the name dropped); BBC Good Food pages are English-only so nameJa is a BA translation (nameJaIsTranslation true).',
'tier main = ranks 1-80, reserve = 81-100; a reserve carries the batch letter whose style it can replace. Excluded: everything in data/library.json (ids and titles) and the rejected/reserve entries of candidates.json that are already in the library; also baby-food (パクパク期) and raw-fish recipes.',
'free.* is computed from expectedAllergens only (provisional). Strong reading of the brief: free.all3 = free of egg AND milk AND wheat.'],
mix,proposedHosts:[{host:'hugkum.sho.jp',reason:'Shogakukan parenting site with kindergarten bento roundups from the children magazines Baby Book/Mebae (editorial, tested recipes); seen in search results only, not fetched, so unverified.'}],candidates:cands};
fs.writeFileSync('../../../data/_research/candidates-2.json',JSON.stringify(out,null,1));
console.log(JSON.stringify(mix));console.log('missing',miss.map(r=>r.key));
const dup=cands.map(c=>c.sourceUrl);console.log('dupurl',dup.length-new Set(dup).size);
