const fs=require('fs');const id=process.argv[2];
let h=fs.readFileSync('html/'+id+'.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<br\s*\/?>/g,'\n').replace(/<\/(p|li|div|tr|dt|dd|h\d|th|td|span)>/g,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').split('\n').map(s=>s.trim()).filter(Boolean);
const a=h.findIndex(s=>/^材料/.test(s));const b=h.findIndex((s,i)=>i>a&&/(関連|このレシピを見た|レシピをシェア|みんなのつくったよ|エネルギー)/.test(s)&&i>a+5);
console.log(h.slice(Math.max(0,a-6),b>0?b:a+80).join('\n'));
