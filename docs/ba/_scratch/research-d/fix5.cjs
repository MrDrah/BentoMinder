const fs=require('fs');
function rep(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))console.log('MISSING',a.slice(0,30));s=s.split(a).join(b)}fs.writeFileSync(f,s)}
rep('r1.cjs',[
['ブロッコリーに塩、ごま油、しょうがを加え、熱いまま混ぜます。','ブロッコリーにしょうが、塩、ごま油を合わせ、熱いまま混ぜます。'],
]);
rep('r2.cjs',[
['かぼちゃをボウルに入れてフォークで粗くつぶし、','かぼちゃをボウルに移し、フォークで粗くつぶして'],
]);
rep('r4.cjs',[
['パン粉大さじ1と1/2、粉チーズ、パセリを混ぜておきます。','粉チーズとパセリに、パン粉大さじ1.5を合わせておきます。'],
['しょうゆ大さじ1と1/2、だし、砂糖小さじ2、片栗粉小さじ2を混ぜたたれを加え','だし、しょうゆ大さじ1.5、片栗粉と砂糖を各小さじ2混ぜたたれを加え'],
]);
