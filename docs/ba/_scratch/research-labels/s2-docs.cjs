const fs=require('fs');
function rep(p,pairs){let t=fs.readFileSync(p,'utf8');for(const[a,b]of pairs){if(a==='@@START'){const m=t.match(/`varies-by-product` (processed food:[^
|]*?|[^
]*?establishes)/);if(!m)throw new Error('start');t=t.replace(m[0],()=>b);continue;}if(!t.includes(a))throw new Error('missing '+a.slice(0,50));t=t.replace(a,()=>b);}fs.writeFileSync(p,t);}
rep('docs/ba/data-contract.md',[
['@@START',
 '`varies-by-product` (processed food: ウインナー, カレールー, ケチャップ, みそ…; the allergens of the one maker label the recipe cites, in `allergenIds` when the food itself defines them and otherwise in `possibleAllergenIds`; the recipe adds an adaptation telling the parent to 「表示を確認」, check the label of the product they use) \| `unknown` (processed food for which no label could be fetched or the label is ambiguous; it is never shown as allergen-free)'],
['non-empty iff `varies-by-product`; empty for `known` and `unknown`; from the source or typical product labels, cited (`recipe-possible-allergens`)',
 'only `varies-by-product` may list entries (empty for `known` and `unknown`); it may be empty when the cited label declares no allergen beyond `allergenIds`; entries come from the cited maker label, never from "typical" products (`recipe-possible-allergens`)'],
['| `recipe-possible-allergens` | S | `possibleAllergenIds` is non-empty iff `allergenInfo = varies-by-product`. |',
 '| `recipe-possible-allergens` | S | `possibleAllergenIds` is non-empty only when `allergenInfo = varies-by-product` (it may be empty there when the cited label declares none). |'],
['No host in `APPROVED_HOSTS` belongs to a different publisher',
 '| `nipponham.co.jp`, `hagoromofoods.co.jp`, `marukome.co.jp`, `nissui.co.jp`, `meg-snow.com` (label round, 2026-10-30; Orchestrator to mirror in `APPROVED_HOSTS` and run the source/overlap audit) | 日本ハム株式会社; はごろもフーズ株式会社; マルコメ株式会社; 株式会社ニッスイ; 雪印メグミルク株式会社 | Maker product pages used only for the ingredient label and allergen list of one named product (`usedFor: ["allergen"]`), never for recipes | Fetched with HTTP 200 and page titles checked, 2026-10-30 |\n\nNo host in `APPROVED_HOSTS` belongs to a different publisher'],
]);
rep('docs/PROJECT_BRIEF.md',[
['- **Child profile and plans:**','- **Processed-food allergens:** for processed ingredients (ham, sausage, ketchup, miso, canned tuna…) a recipe records the allergens printed on one cited maker label and tells the parent to check the label of the product they use (`varies-by-product`). Where no label could be fetched the ingredient stays `unknown`, and the recipe is shown as allergen data incomplete, never as allergen-free.\n- **Child profile and plans:**'],
]);
