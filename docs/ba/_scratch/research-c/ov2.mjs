import fs from 'node:fs';
const recs = JSON.parse(fs.readFileSync('data/_research/batch-c.json','utf8'));
const pdir='docs/ba/_scratch/research-c/pages/';
const TH=Number(process.argv[2]||11);
const strip=(h)=>h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' ');
const norm=(s)=>s.normalize('NFKC').replace(/[\s、。，．・「」（）()\[\]【】※＊*！!？?～~\-]/g,'');
const all=fs.readdirSync(pdir).filter(f=>!f.startsWith('lbl')).map(f=>[f,norm(strip(fs.readFileSync(pdir+f,'utf8')))]);
const srcIdMap={};
function runs(a,b){const out=[];let i=0;while(i<a.length){let l=1,best=0;while(i+l<=a.length&&b.includes(a.slice(i,i+l))){best=l;l++;}if(best>=TH){out.push(a.slice(i,i+best));i+=best;}else i++;}return out}
for(const r of recs){
  const fields=[['desc',r.description.ja],...r.steps.map((s,i)=>['step'+i,s.ja]),...r.storage.map((s,i)=>['stor'+i,s.ja]),...r.adaptations.map((s,i)=>['adapt'+i,s.ja]),...(r.makeAhead?[['make',r.makeAhead.ja]]:[])];
  for(const [n,t] of fields){const a=norm(t);const seen=new Set();for(const [f,p] of all){for(const x of runs(a,p)){if(!seen.has(x)){seen.add(x);console.log(r.id.slice(4),n,x.length,x,'<=',f)}}}}
}
