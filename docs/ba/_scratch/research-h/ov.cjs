const fs=require('fs');const path=require('path');
const recs=JSON.parse(fs.readFileSync('data/_research/batch-h.json','utf8'));
const pdir='docs/ba/_scratch/research-h/pages';
const norm=t=>t.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,'').replace(/&[a-z#0-9]+;/g,'').replace(/[\s　、。，．！？!?・（）()「」『』【】☆♪]/g,'');
const pages=fs.readdirSync(pdir).map(f=>[f,norm(fs.readFileSync(path.join(pdir,f),'utf8'))]);
let bad=0;
for(const r of recs){const texts=[r.description.ja,...r.steps.map(s=>s.ja),...r.storage.map(s=>s.ja),...r.adaptations.map(s=>s.ja)];
 for(const t of texts){const n=t.replace(/[\s　、。，．！？!?・（）()「」『』【】☆♪]/g,'');
  for(let i=0;i+12<=n.length;i++){const w=n.slice(i,i+12);for(const [f,p] of pages){if(p.includes(w)){let l=12;while(i+l<n.length&&p.includes(n.slice(i,i+l+1)))l++;console.log(r.id,f,l,n.slice(i,i+l));bad++;i+=l;break}}}}}
console.log('hits',bad);
