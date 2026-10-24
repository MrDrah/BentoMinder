import { readFileSync } from 'node:fs';
const md = readFileSync('design/copy.md','utf8').split('\n');
const tail = md.slice(md.findIndex(l=>l.startsWith('## Strings no AC defines'))).join('\n');
const pats = [...tail.matchAll(/`([^`]+)`/g)].map(m=>m[1]);
const rows = md.map((l,i)=>[i+1,l]).filter(([,l])=>/^\| [a-zA-Z0-9_.]+ \|/.test(l));
const out=new Map();
for (const p of pats) {
  const re = new RegExp('^'+p.replace(/\./g,'\.').replace(/\*/g,'[A-Za-z0-9_.]*').replace(/\/(\w+)/g,'|$1')+'$');
  // handle "storage.corrupt.title/body/reset*"
  let alts=[p];
  if (p.includes('/')) { const [head,...rest]=p.split('/'); const base=head.slice(0,head.lastIndexOf('.')+1); alts=[head,...rest.map(r=>base+r)]; }
  for (const a of alts) {
    const r2 = new RegExp('^'+a.replace(/\./g,'\.').replace(/\*/g,'[A-Za-z0-9_.]*')+'$');
    for (const [n,l] of rows) { const k=l.split('|')[1].trim(); if (r2.test(k)) out.set(n,l); }
  }
}
for (const [n,l] of [...out].sort((a,b)=>a[0]-b[0])) console.log(n+': '+l);
console.error(out.size);
