import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 700, height: 1200 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(resolve('design/preview/index.html')).href);
await p.locator('#legendBtn').click();
const r = await p.evaluate(() => {
  const out = []; let n = 0;
  const hit = (a, c) => !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
  document.querySelectorAll('.tl.has-allergen').forEach((t) => {
    n++;
    const tr = t.getBoundingClientRect(), al = t.querySelector('.tl-al').getBoundingClientRect();
    const num = t.querySelector('.tl-num').getBoundingClientRect();
    const hol = t.querySelector('.tl-hol')?.getBoundingClientRect();
    const ic = t.querySelector('.tl-icon').getBoundingClientRect();
    // lunchbox rect: x 3..21, y 6.5..18.5 of 24
    const k = ic.width / 24, box = { left: ic.left + 3 * k, right: ic.left + 21 * k, top: ic.top + 6.5 * k, bottom: ic.top + 18.5 * k };
    const bw = parseFloat(getComputedStyle(t).borderTopWidth);
    const ringIn = t.className.includes('is-tomorrow') ? 4 : 3; // inset ring depth from outer edge
    const info = { cls: t.className.replace('tl ', ''), w: Math.round(tr.width), h: Math.round(tr.height), badge: Math.round(al.width),
      gapBox: +(al.top - box.bottom).toFixed(1), numHit: hit(al, num), holHit: hol ? hit(al, hol) : false, iconBoxHit: hit(al, box),
      ringClear: +(Math.min(tr.right - al.right, tr.bottom - al.bottom) - ringIn).toFixed(1), insideTile: al.right <= tr.right && al.bottom <= tr.bottom, glyph: getComputedStyle(t.querySelector('.tl-al')).fontSize, hasDash: !!t.querySelector('.tl-dash') };
    out.push(info);
  });
  return { n, out };
});
let bad = 0;
for (const i of r.out) { const fail = i.numHit || i.holHit || i.iconBoxHit || i.gapBox < 2 || i.ringClear < 1 || !i.insideTile || i.hasDash; if (fail) bad++; if (fail || /wd|satc|sunc|is-today/.test(i.cls)) {} }
const uniq = new Map(); r.out.forEach((i) => uniq.set(`${i.w}x${i.h}|${i.badge}|${i.glyph}|${i.gapBox}|${i.ringClear}`, i.cls));
console.log('tiles with mark', r.n, 'failing', bad); console.log([...uniq.entries()].map(([k, v]) => k + '  e.g. ' + v).join('\n'));
await b.close();
