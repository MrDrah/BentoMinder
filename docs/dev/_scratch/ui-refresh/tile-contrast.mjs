// Contrast for the day-tile redesign pairs. node docs/dev/_scratch/ui-refresh/tile-contrast.mjs
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('design/tokens.json', 'utf8'));
const lum = (hex) => { const n = hex.replace('#', ''); const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
['T01','ink-1','surface-2',4.5,'Day number on a normal tile (= P02)'],
['T02','ink-3','surface-1',4.5,'Past day number (weekday) on the transparent past tile (= P07)'],
['T03','ink-inverse','navy-fill',4.5,'Today: number'],
['T04','ink-2','surface-2',3,'School / home / unsure icon on a normal tile'],
['T05','ink-3','surface-1',3,'Past icon stroke on the transparent past tile'],
['T06','ink-inverse','navy-fill',3,'Today: icon stroke'],
['T07','ink-2','surface-3',3,'Icon on hover/active background'],
['T08','ink-1','surface-3',4.5,'Number on hover/active background'],
['T09','accent','surface-2',3,'Red dash and red top border on a normal tile'],
['T10','accent','surface-1',3,'Red top border against the page / past tile (transparent); dash never on past'],
['T11','accent','surface-3',3,'Red dash on hover/active background'],
['T12','planned-edge','navy-fill',3,'Red dash and top border on the today tile'],
['T13','planned-edge','surface-1',3,'Red top border of the today tile against the page'],
['T14','ink-1','surface-2',3,'Tomorrow border against tile fill'],
['T15','ink-1','surface-1',3,'Tomorrow border against the page'],
['T16','navy-fill','surface-1',3,'Today fill against the page'],
['T17','ink-1','surface-2',3,'Selected ring on a normal tile'],
['T18','ink-inverse','navy-fill',3,'Selected ring on the today tile'],
['T19','sunday','surface-2',4.5,'Holiday 祝 and Sunday number on a tile (= P25)'],
['T20','saturday','surface-2',4.5,'Saturday number on a tile (= P23)'],
['T21','sunday','surface-1',4.5,'Past Sunday/holiday number on the transparent past tile (= P24)'],
['T22','saturday','surface-1',4.5,'Past Saturday number (= P22)'],
['T23','warning-soft','navy-fill',3,'Needs-review badge on today tile (= U15)'],
['T24','warning','warning-soft',3,'Needs-review badge glyph (= P35)'],
['T25','focus-ring','focus-halo',3,'Focus ring on any tile (= U12)'],
['T26','focus-ring','surface-1',3,'Focus ring against page (= U10)'],
['T27','danger','danger-soft',4.5,'Allergen mark: ! glyph on its fill'],
['T28','danger','surface-2',3,'Allergen mark: ring against a normal / tomorrow tile'],
['T29','danger','surface-1',3,'Allergen mark: ring against a past (transparent) tile'],
['T30','danger','surface-3',3,'Allergen mark: ring on hover/active fill'],
['T31','danger-soft','navy-fill',3,'Allergen mark: fill against the today tile'],
];
let fail=0; const rows=[];
for (const [id,fg,bg,need,use] of pairs){ const c=(th)=>{const r=ratio(t.color[th][fg].value,t.color[th][bg].value); if(r<need)fail++; return r.toFixed(2)+(r<need?' FAIL':'');}; rows.push(`| ${id} | \`${fg}\` on \`${bg}\` | ${c('light')} | ${c('dark')} | ${need} | ${use} |`); }
console.log(rows.join('\n')); console.log('fails',fail);
