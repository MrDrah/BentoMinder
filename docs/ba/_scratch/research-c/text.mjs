// usage: node text.mjs file.html [start-regex] [maxchars] -> visible text
import fs from 'node:fs';
let h = fs.readFileSync(process.argv[2], 'utf8');
h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
let t = h.replace(/<(br|\/p|\/li|\/h\d|\/tr|\/div|\/dt|\/dd)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&#x27;|&rsquo;/g,"'").replace(/&frac12;/g,'1/2').replace(/&frac14;/g,'1/4');
t = t.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
const start = process.argv[3] ? t.search(new RegExp(process.argv[3])) : 0;
console.log(t.slice(Math.max(0,start), Math.max(0,start) + Number(process.argv[4] || 6000)));
