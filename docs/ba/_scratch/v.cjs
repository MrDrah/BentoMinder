const fs=require('fs');const [inf,outf]=process.argv.slice(2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const lines=fs.readFileSync(inf,'utf8').split('\n').filter(Boolean);
(async()=>{for(const l of lines){const [key,url]=l.split('|');let o={key,url};
try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'},redirect:'follow'});o.code=r.status;const s=await r.text();
o.title=(s.match(/<title>([^<]*)/)||[])[1]?.slice(0,80);
const lds=[...s.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
for(const m of lds){try{let j=JSON.parse(m[1]);const arr=Array.isArray(j)?j:(j['@graph']||[j]);for(const x of arr){if(x['@type']==='Recipe'||(Array.isArray(x['@type'])&&x['@type'].includes('Recipe'))){o.ld=x.name;o.total=x.totalTime||x.cookTime;o.ing=(x.recipeIngredient||[]).map(i=>typeof i==='string'?i:i.name).join(',').slice(0,160);o.yield=x.recipeYield}}}catch(e){}}
if(!o.total){const t=s.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');o.tm=(t.match(/(?:調理時間|所要時間|時間)[^0-9]{0,6}(\d+ *分)/)||[])[1]||(t.match(/(\d+ *分)/)||[])[1]}
}catch(e){o.code='ERR '+e.message}
fs.appendFileSync(outf,JSON.stringify(o)+'\n');await sleep(2500)}})();
