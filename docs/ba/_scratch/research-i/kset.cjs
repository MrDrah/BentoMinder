const fs=require('fs');
for(const f of fs.readdirSync('kik/sets')){
 const h=fs.readFileSync('kik/sets/'+f,'utf8');
 const t=(h.match(/<title>([\s\S]*?)<\/title>/)||[])[1].trim();
 const links=[];const re=/<a[^>]+href="([^"]*search\/recipe\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>/g;let m;const seen=new Set();
 while(m=re.exec(h)){if(seen.has(m[2]))continue;seen.add(m[2]);links.push(m[2]+':'+m[3].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,45));}
 console.log(f.replace('.html',''),'|',t.slice(0,40),'\n   ',links.slice(0,6).join('\n    '));
}
