const fs=require('fs');
function rep(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))console.log('MISSING',a.slice(0,30));s=s.split(a).join(b)}fs.writeFileSync(f,s)}
rep('r1.cjs',[
['味つけしたブロッコリーを入れて','味をつけたブロッコリーを加えて'],
]);
rep('r4.cjs',[
['フライパンにオリーブオイル大さじ1/2を熱し、','オリーブオイル大さじ1/2をフライパンで熱し、'],
['しょうゆ（大さじ1と1/2＋小さじ1）','しょうゆ（大さじ1.5と小さじ1）'],
]);
