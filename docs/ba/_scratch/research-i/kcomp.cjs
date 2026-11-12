const fs=require('fs');
const sets=process.argv.slice(2);const out=[];
for(const s of sets){
 const h=fs.readFileSync('kik/sets/'+s.replace('/','_')+'.html','utf8');
 const re=/<a[^>]+href="([^"]*search\/recipe\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>/g;let m;const seen=new Set();const ids=[];
 while(m=re.exec(h)){const lab=m[3].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();if(seen.has(m[2]))continue;seen.add(m[2]);if(lab==='')ids.push(m[2]);}
 // riceball: first 3
 console.log(s,ids.join(','));
 out.push(...ids);
}
fs.writeFileSync('kik/ids.txt',[...new Set(out)].join('\n'));
