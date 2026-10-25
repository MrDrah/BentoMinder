// usage: node extract.mjs file.html... -> prints JSON-LD Recipe summary
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const h = fs.readFileSync(f, 'utf8');
  const blocks = [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let found = false;
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(visit);
    const t = [].concat(o['@type'] || []);
    if (t.includes('Recipe')) {
      found = true;
      const auth = [].concat(o.author || []).map(a => a.name || a).join(',');
      console.log(`== ${f} | ${o.name} | total=${o.totalTime} cook=${o.cookTime} prep=${o.prepTime} | yield=${o.recipeYield} | author=${auth}`);
      console.log('   ING: ' + [].concat(o.recipeIngredient || []).join(' / '));
    }
    if (o['@graph']) visit(o['@graph']);
  };
  for (const b of blocks) { try { visit(JSON.parse(b)); } catch (e) {} }
  if (!found) console.log(`== ${f} | no Recipe JSON-LD`);
}
