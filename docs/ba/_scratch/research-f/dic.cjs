const d=require('../../../../data/dictionary.json');
for(const q of process.argv.slice(2)){const r=d.ingredients.filter(i=>JSON.stringify(i).includes(q)).map(i=>`${i.id} ${i.ja} info=${i.info} alg=${i.inherentAllergenIds} ao=${i.animalOrigin}${i.animalOriginKnown?'':'?'}`);console.log(q,'=>',r.join(' | ')||'NONE');}
