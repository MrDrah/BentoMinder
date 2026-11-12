const fs=require('fs');
for(const f of fs.readdirSync('html')){
 const id=f.replace('.html','');const h=fs.readFileSync('html/'+f,'utf8');
 const t=(h.match(/<title>([\s\S]*?)<\/title>/)||[])[1];
 let out='TITLE: '+t+'\n';
 const ld=[...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
 let done=false;
 for(const m of ld){try{let j=JSON.parse(m[1]);const arr=Array.isArray(j)?j:(j['@graph']||[j]);for(const x of arr){if(x['@type']==='Recipe'){done=true;out+=JSON.stringify({name:x.name,desc:x.description,yield:x.recipeYield,total:x.totalTime,cook:x.cookTime,ing:x.recipeIngredient,steps:(x.recipeInstructions||[]).map(s=>s.text||s.name||s)},null,0)+'\n';}}}catch(e){}}
 if(!done){
  let b=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<br\s*\/?>/g,'\n').replace(/<\/(p|li|div|tr|dt|dd|h\d|th|td)>/g,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\n\s*\n+/g,'\n');
  out+=b;
 }
 fs.writeFileSync('txt/'+id+'.txt',out);
}
