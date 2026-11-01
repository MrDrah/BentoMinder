const fs=require('fs');const {execSync}=require('child_process');
const norm=s=>s.normalize('NFKC').replace(/[\s、。，．・「」（）()]/g,'');
const b=JSON.parse(fs.readFileSync('data/_research/batch-d.json','utf8'));
const dir='docs/ba/_scratch/research-d/pages/';
const map={};for(const f of fs.readdirSync(dir)){const h=fs.readFileSync(dir+f,'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ');map[f]=norm(h)}
function lcs(a,t,min){let best='';for(let i=0;i+min<=a.length;i++){let l=best.length>=min?best.length:min;if(t.includes(a.slice(i,i+l))){let e=i+l;while(e<a.length&&t.includes(a.slice(i,e+1)))e++;if(e-i>best.length)best=a.slice(i,e)}}return best}
const urlFile={};
for(const r of b){const txt=[r.description.ja,...r.steps.map(s=>s.ja),...r.storage.map(s=>s.ja),...r.adaptations.map(s=>s.ja)];
 let worst='';for(const f in map){for(const t of txt){const m=lcs(norm(t),map[f],8);if(m.length>(worst.split(' [')[0]).length)worst=m+' ['+f+']'}}
 console.log(r.id,worst.split(' [')[0].length,worst.slice(0,70))}
