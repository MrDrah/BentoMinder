// Adds the animalOrigin column (B14) to dictionary §4 and two new ingredients.
const fs=require('fs');const f='docs/ba/domain-dictionary.md';let s=fs.readFileSync(f,'utf8');
function rep(a,b){if(!s.includes(a)){console.error('MISSING:',a.slice(0,90));process.exit(1)}s=s.replace(a,b)}
// tags per id; ids not listed get '–' (no animal origin) — the script lists every non-plant id explicitly
const T={
 'ing-bread':'dairy, egg, ?','ing-bread-crumbs':'dairy, egg, ?','ing-chinese-noodles':'egg',
 'ing-egg':'egg','ing-quail-egg':'egg','ing-milk':'dairy','ing-cheese':'dairy','ing-yogurt':'dairy, gelatin',
 'ing-butter':'dairy','ing-cream':'dairy','ing-skim-milk':'dairy',
 'ing-chicken':'chicken','ing-chicken-thigh':'chicken','ing-chicken-breast':'chicken','ing-chicken-tender':'chicken','ing-ground-chicken':'chicken',
 'ing-pork':'pork','ing-ground-pork':'pork','ing-beef':'beef','ing-ground-beef':'beef','ing-ground-mixed':'beef, pork',
 'ing-ground-meat':'meat','ing-ham':'meat, pork','ing-sausage':'meat, pork','ing-bacon':'pork',
 'ing-mayonnaise':'egg','ing-worcester-sauce':'?','ing-curry-roux':'meat, pork, beef, chicken, dairy, ?',
 'ing-dashi':'fish-seafood, ?','ing-consomme':'beef, chicken, pork, ?','ing-gelatin':'gelatin',
 'ing-niboshi':'fish-seafood','ing-stew-roux':'meat, pork, beef, chicken, dairy, ?',
 'ing-hanpen':'fish-seafood, egg',
};
const fishLike=/^\| (ing-[a-z0-9-]+) \|.*\| (cat-fish|cat-seafood|cat-fish-processed) \|/;
// new rows
rep("| ing-bonito-flakes | かつおぶし | かつおぶし | Bonito flakes | cat-fish | かつお節, 鰹節, おかか, 削り節 | – | known |",
"| ing-bonito-flakes | かつおぶし | かつおぶし | Bonito flakes | cat-fish | かつお節, 鰹節, おかか, 削り節 | – | known |\n| ing-niboshi | 煮干し | にぼし | Dried baby sardines (for stock) | cat-fish | にぼし, いりこ | – | known |");
rep("| ing-curry-powder | カレー粉 | かれーこ | Curry powder | cat-seasoning | カレーパウダー | – | varies |",
"| ing-stew-roux | シチュールウ | しちゅーるう | Stew roux | cat-seasoning | シチュールー, クリームシチューのルウ | – | varies |\n| ing-curry-powder | カレー粉 | かれーこ | Curry powder | cat-seasoning | カレーパウダー | – | varies |");
const lines=s.split('\n');let n=0,tagged=0,unknown=[],none=0;
for(let i=0;i<lines.length;i++){const l=lines[i];
 if(l.startsWith('| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |')){lines[i]=l+' animalOrigin |';continue}
 if(l.startsWith('|----|------|------|---------|----------|----------|--------------------|------|')){lines[i]=l+'--------------|';continue}
 const m=l.match(/^\| (ing-[a-z0-9-]+) \|/); if(!m)continue;
 const cols=l.split('|').length-2; if(cols!==8){console.error('cols',cols,l);process.exit(1)}
 let v=T[m[1]]; if(!v&&fishLike.test(l)) v='fish-seafood'; if(!v) v='–';
 lines[i]=l+' '+v+' |'; n++; if(v==='–')none++; else tagged++; if(v.includes('?'))unknown.push(m[1]);
}
s=lines.join('\n');
for(const k of Object.keys(T)) if(!new RegExp('^\\| '+k+' \\|','m').test(s)){console.error('unknown id in T',k);process.exit(1)}
fs.writeFileSync(f,s);
console.log({ingredients:n,withTags:tagged,noAnimalOrigin:none,unknownOrigin:unknown});
