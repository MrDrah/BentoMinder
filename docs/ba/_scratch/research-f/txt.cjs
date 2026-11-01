const fs=require('fs');const f=process.argv[2];let h=fs.readFileSync(f,'utf8');
h=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/\n\s*\n+/g,'\n');
let i=h.indexOf('\nレビュー\n'); if(i>0) h=h.slice(0,i);
const j=h.indexOf('材料'); 
console.log(h.slice(0,+process.argv[3]||5000));
