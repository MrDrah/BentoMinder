const d=require('../../../../data/dictionary.json');
for(const t of process.argv.slice(2)){
 const h=d.ingredients.filter(i=>i.ja.includes(t)||i.forms.some(f=>f.includes(t)));
 console.log(t,'=>',h.map(i=>`${i.id}[${i.ja}|${i.inherentAllergenIds}|${i.info}|${i.animalOrigin}${i.animalOriginKnown?'':'?'}]`).join('  '));
}
