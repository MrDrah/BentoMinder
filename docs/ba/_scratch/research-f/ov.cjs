const fs=require('fs');const path=require('path');
const recs=JSON.parse(fs.readFileSync('../../../../data/_research/batch-f.json','utf8'));
const norm=s=>s.normalize('NFKC').replace(/[\s、。，．・,.;:!?！？「」『』（）()\[\]【】〜~\-]/g,'').toLowerCase();
const pages={};for(const f of fs.readdirSync('pages')){const h=fs.readFileSync('pages/'+f,'utf8');pages[f]=norm(h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' '));}
const enWords=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
let bad=0;
for(const r of recs){
 const fields=[r.description,...r.steps,...r.storage,...r.adaptations];
 for(const [i,f] of fields.entries()){
  const n=norm(f.ja);let maxRun=0,where='';
  for(const [pf,pt] of Object.entries(pages)){
    // longest common substring via sliding windows of 8..
    let L=8;for(let s=0;s+L<=n.length;s++){let l=L;while(s+l<=n.length&&pt.includes(n.slice(s,s+l)))l++;if(l-1>=L){ if(l-1>maxRun){maxRun=l-1;where=pf+': '+n.slice(s,s+l-1)}}}
  }
  if(maxRun>=10){bad++;console.log(r.id,'JA run',maxRun,where)}
  const w=enWords(f.en);
  for(const [pf,h] of Object.entries(pages)){}
 }
}
console.log('done',bad);
