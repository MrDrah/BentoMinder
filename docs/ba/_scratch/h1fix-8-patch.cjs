const fs=require('fs');const f='docs/ba/_scratch/h1fix-8.cjs';let s=fs.readFileSync(f,'utf8');
const R=(a,b)=>{if(!s.includes(a))throw new Error('miss '+a.slice(0,60));s=s.replace(a,b)};
R('「とりももの照り焼き風」「とりむねのから揚げ」「カレーうどん」','「とりももの照り焼き風」「鶏むね肉のソテー」「カレーうどん」');
R('`ing-chicken-thigh` (「とりもも」, amb-momo rule), `dish-karaage`, `ing-chicken-breast` (「とりむね」),','`ing-chicken-thigh` (「とりもも」, amb-momo rule), `ing-chicken-breast`,');
R('Foods (11):','Foods (10):');
R(' `dish-karaage` (from 「から揚げ」 in 「とりむねのから揚げ」; its defining `ing-chicken` is not literally named there, so the dish is its own food and とりむね stays separate, being an item ingredient, not the defining id);','');
R('もも and むね liked (level 2, parent `ing-chicken`); `dish-karaage` liked (level 1 through its defining `ing-chicken`);','もも and むね liked (level 2, parent `ing-chicken`);');
R('So D = 4, L = 4.','So D = 4, L = 3.');
R('["  Then D = 2 (the chicken food and the salmon food)\\n```",',
 '["  And a school day lists 「とりにくのからあげ」 and 「鶏もも肉のてりやき」 with the ingredients 鶏肉, 鶏もも肉","  And a school day lists 「鶏肉と野菜のスープ」 and 「鶏もも肉のソテー」 with the ingredients 鶏肉, 鶏もも肉"],\n["  Then D = 2 (the chicken food and the salmon food)\\n```",');
R('US-E4-01/AC15 (title: "defining ingredient"; outcome unchanged)','US-E4-01/AC15 (title: "defining ingredient"; outcome unchanged), US-E4-01/AC16 (example items without a dish; outcome unchanged)');
fs.writeFileSync(f,s);console.log('patched');
