const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
let m=h.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)||[];
let out=[];for(const s of m){out.push(s.replace(/<[^>]+>/g,''));}
let t=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/\n\s*\n+/g,'\n');
console.log(out.join('\n').slice(0,6000));console.log('-----');console.log(t.slice(0,+process.argv[3]||5000));
