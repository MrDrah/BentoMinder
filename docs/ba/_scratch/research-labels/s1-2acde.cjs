const fs=require('fs');
const pb='data/_research/batch-b.json', pa='data/_research/batch-a.json';
const b=JSON.parse(fs.readFileSync(pb,'utf8')), a=JSON.parse(fs.readFileSync(pa,'utf8'));
// 2a + 2e curry-chahan
let r=b.find(r=>r.id==='rcp-house-hajimete-curry-chahan');
let s=JSON.stringify(r);
s=s.replace('子ども向けのカレールウ（顆粒）1/3袋','x');
s=s.replace('子ども向けカレールウ（顆粒）1/3袋','子ども向けカレールウ1/3袋')
 .replace("children's curry roux granules made without the 8 specified allergens (1/3 sachet)","children's curry roux made without the 8 specified allergens (1/3 sachet)")
 .replace('子ども向けの顆粒カレールウ','子ども向けのカレールウ')
 .replace("a children's granulated curry roux","a children's curry roux")
 .replace('sprinkle in the curry granules a little at a time','sprinkle in the curry roux a little at a time');
r=JSON.parse(s);
const gb=r.ingredients.find(i=>i.ingredientId==='ing-green-beans');
gb.label={ja:'さやいんげん（元の2本の1/3）',en:'green beans (1/3 of the source\'s 2 beans)'};gb.quantity=0.67;gb.unit='piece';
r.yield={ja:'1人分（元の3人分の1/3）',en:'1 serving (1/3 of the source\'s 3 servings)'};
r.adaptations=r.adaptations.filter(x=>!x.ja.startsWith('さやいんげんは元の表記'));
r.adaptations[0]={ja:'元のレシピ（3人分＝大人2人と幼児1人の分量）を1/3にし、ごはん120gの1人分にしました。元のレシピには幼児の取り分が書かれていないため、幼児用の分量とはしていません。少量の材料は1/3量（約6.7g）を7gに丸め、ルウは1袋20gの1/3、サラダ油は大さじ1の1/3（小さじ1）です。',en:'The source (3 servings: an amount for 2 adults and 1 small child) is scaled to 1/3, one serving with 120 g rice. The source does not state the child\'s share, so this is not presented as a child-sized portion. Small amounts (1/3 = about 6.7 g) are rounded to 7 g; the roux is 1/3 of a 20 g sachet and the oil 1/3 of 1 tbsp (1 tsp).'};
r.adaptations.splice(1,0,{ja:'さやいんげんは元のレシピに「2本」とだけ書かれていて重さの記載はないため、その1/3（約0.67本）としました。',en:'The source gives the green beans only as 2 beans, with no weight, so 1/3 of that (about 0.67 bean) is used.'});
r.adaptations.push({ja:'参照した表示の「特定原材料に準ずるもの」の一覧にはピスタチオの項目がありません。ピスタチオのアレルギーがある場合は、この表示だけでは分からないので、製品の表示を確認してください。',en:'The list of recommended items on the cited label has no pistachio entry, so the label alone cannot tell you about pistachio. If your child has a pistachio allergy, check the pack.'});
b[b.findIndex(x=>x.id===r.id)]=r;
// 2c quesadilla
const q=b.find(x=>x.id==='rcp-bbc-black-bean-quesadilla');
q.yield={ja:'1〜2人分（トルティーヤ1枚分）',en:'1 to 2 servings (one tortilla)'};
const sp=q.ingredients.find(i=>i.ingredientId==='ing-salt');sp.unit='to-taste';
q.adaptations.push({ja:'塩こしょうは元のレシピに分量がなく、「塩とこしょうで味をととのえる」とだけあるため、適量としました。元のレシピは「2〜4人分」で、子ども向けの分量の記載はありません。',en:'The source gives no amount for salt and pepper, only to season with them, so it is listed as "to taste". The source says "serves 2-4" and gives no child portion.'});
// 2d
const h=a.find(x=>x.id==='rcp-kikkoman-sake-hamburg-bento');
h.storage.splice(1,1);
h.sources=h.sources.filter(x=>x.id!=='src-maff-lunchbox');
fs.writeFileSync(pb,JSON.stringify(b,null,2)+'\n');fs.writeFileSync(pa,JSON.stringify(a,null,2)+'\n');
