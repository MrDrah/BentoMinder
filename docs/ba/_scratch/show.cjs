const fs=require('fs');for(const f of process.argv.slice(2)){for(const l of fs.readFileSync(f,'utf8').split('\n').filter(Boolean)){const o=JSON.parse(l);
let tm=o.total&&o.total!=='PT0M'?o.total.replace('PT',''):o.tm||'?';
console.log(o.key,o.code,'|',(o.ld||o.title||'').slice(0,40),'|',tm,'|',(o.ing||'').replace(/ /g,'').slice(0,110))}}
