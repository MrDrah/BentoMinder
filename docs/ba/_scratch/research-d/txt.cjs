const fs=require('fs');const f=process.argv[2];let h=fs.readFileSync(f,'utf8');
h=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<(br|\/p|\/li|\/tr|\/div|\/h\d|\/dt|\/dd)[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
console.log(h);
