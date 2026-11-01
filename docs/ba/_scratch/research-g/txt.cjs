const fs=require('fs');const f=process.argv[2];let h=fs.readFileSync(f,'utf8');
const ld=[...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const l of ld){try{const j=JSON.parse(l);const arr=Array.isArray(j)?j:[j];for(const o of arr){if(o['@type']==='Recipe'){console.log(JSON.stringify({n:o.name,y:o.recipeYield,t:o.totalTime,ing:o.recipeIngredient,steps:(o.recipeInstructions||[]).map(s=>s.text||s)},null,0));}}}catch(e){}}
let t=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
fs.writeFileSync(f.replace('.html','.txt'),t);
console.log('TEXTLEN',t.length);
