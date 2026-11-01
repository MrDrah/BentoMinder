const t=require('fs').readFileSync(process.argv[2],'utf8');
const i=t.indexOf('調理時間');const e=t.indexOf('ホームクッキング きょうの献立',i);
console.log(t.slice(Math.max(0,i-120),e>0?e:i+1500));
