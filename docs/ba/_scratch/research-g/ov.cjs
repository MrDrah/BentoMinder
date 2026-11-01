const fs=require('fs');const path=require('path');
const recs=JSON.parse(fs.readFileSync('../../../../data/_research/batch-g.json','utf8'));
const pages=fs.readdirSync('pages').filter(f=>f.endsWith('.txt')).map(f=>fs.readFileSync('pages/'+f,'utf8').replace(/\s+/g,''));
const N=11; // flag runs >= 11 chars
for(const r of recs){
  const texts=[r.description.ja,...r.steps.map(s=>s.ja),...r.storage.map(s=>s.ja),...r.adaptations.map(s=>s.ja)];
  for(const t0 of texts){const t=t0.replace(/\s+/g,'');
    for(let i=0;i+N<=t.length;i++){const sub=t.slice(i,i+N);if(pages.some(p=>p.includes(sub))){let j=N;while(i+j<=t.length&&pages.some(p=>p.includes(t.slice(i,i+j))))j++;console.log(r.id,'|',t.slice(i,i+j-1),(j-1));i+=j-2;}}
  }
}
