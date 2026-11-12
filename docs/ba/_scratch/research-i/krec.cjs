const fs=require('fs');const id=process.argv[2];
let h=fs.readFileSync('kik/rec/'+id+'.html','utf8');
const t=(h.match(/<title>([\s\S]*?)<\/title>/)||[])[1].trim();
let s=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<br\s*\/?>/g,'\n').replace(/<\/(p|li|div|tr|dt|dd|h\d|th|td|span)>/g,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').split('\n').map(x=>x.trim()).filter(Boolean);
const a=s.findIndex(x=>/^材料/.test(x));
let b=s.findIndex((x,i)=>i>a&&/^(こちらもおすすめ|関連|このレシピ|レシピ.*注意|お気に入り)/.test(x));
console.log('#'+id,t);
const body=s.slice(Math.max(0,a-12),b>a?b:a+70);
console.log(body.join(' / '));
