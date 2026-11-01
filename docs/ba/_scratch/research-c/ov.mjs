import fs from 'node:fs';
const recs = JSON.parse(fs.readFileSync('data/_research/batch-c.json','utf8'));
const pdir='docs/ba/_scratch/research-c/pages/';
const strip=(h)=>h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' ');
const norm=(s)=>s.normalize('NFKC').replace(/[\s、。，．・「」（）()\[\]【】※＊*！!？?～~\-]/g,'');
const pages=fs.readdirSync(pdir).filter(f=>!f.startsWith('lbl')).map(f=>[f,norm(strip(fs.readFileSync(pdir+f,'utf8')))]);
function lcs(a,b){ // longest common substring length via simple expand on sampled starts
  let best=0,bs='';
  const set=new Map();
  for(let L=8;L<=40;L++){}
  // suffix-free approach: for each start i in a, find longest match in b using indexOf growth
  for(let i=0;i<a.length;i++){
    let l=Math.max(best+1,6);
    while(i+l<=a.length && b.includes(a.slice(i,i+l))){best=l;bs=a.slice(i,i+l);l++;}
  }
  return [best,bs];
}
for(const r of recs){
  const texts=[r.description.ja,...r.steps.map(s=>s.ja),...r.storage.map(s=>s.ja),...r.adaptations.map(s=>s.ja)];
  let worst=[0,''];
  for(const t of texts){const a=norm(t);for(const [f,p] of pages){const x=lcs(a,p);if(x[0]>worst[0])worst=[x[0],x[1],f]}}
  console.log(r.id,worst[0],worst[1],worst[2]);
}
const ids=recs.map(r=>r.id),sn=recs.map(r=>r.shortNameJa);
console.log(new Set(ids).size===ids.length, new Set(sn).size===sn.length);
