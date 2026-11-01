const fs=require('fs');const t=fs.readFileSync(process.argv[2],'utf8');
let i=t.indexOf('調理時間');if(i<0)i=t.indexOf('材料');
let e=t.indexOf('レビュー',i);if(e<0)e=i+3000;
console.log(t.slice(Math.max(0,i-300),Math.min(e,i+3500)));
console.log('PREMIUM?',/プレミアム限定|プレミアムサービスに登録|会員限定/.test(t));
