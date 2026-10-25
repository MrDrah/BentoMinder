// Computes WCAG 2.1 contrast for every token pair the components use, both themes.
// node design/_scratch/contrast.mjs  -> prints a markdown table; exit 1 if any pair fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, '..', 'tokens.json'), 'utf8'));

const lum = (hex) => {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [id, fg, bg, need, where it is used]  need: 4.5 text, 3 large text / UI part / icon
const pairs = [
  ['P01', 'ink-1', 'surface-1', 4.5, 'Body text on page'],
  ['P02', 'ink-1', 'surface-2', 4.5, 'Text on cards, sheets, cells; date-correction grid numerals'],
  ['P03', 'ink-1', 'surface-3', 4.5, 'Chip text, read-only input, illustration panel caption'],
  ['P04', 'ink-2', 'surface-1', 4.5, 'Secondary text on page; food-picker group headings'],
  ['P05', 'ink-2', 'surface-2', 4.5, 'Secondary text on cards; cell word 給食; marks ○ △ —; food-picker group headings and date-correction legend in sheets'],
  ['P06', 'ink-2', 'surface-3', 4.5, 'Secondary text on sunken areas'],
  ['P07', 'ink-3', 'surface-1', 4.5, 'Hints, past-day numerals on page'],
  ['P08', 'ink-3', 'surface-2', 4.5, 'Hints in cards; past numerals in cells; current and taken numerals in the date-correction grid'],
  ['P09', 'ink-3', 'surface-3', 4.5, 'Disabled button/chip text on disabled fill'],
  ['P10', 'ink-inverse', 'navy-fill', 4.5, 'Planned cell text and icons; planned banner; selected chip; toast; selected date-correction cell (numeral, bar)'],
  ['P11', 'navy-fill', 'ink-inverse', 4.5, 'Today numeral on a planned cell (inverted circle)'],
  ['P12', 'surface-2', 'ink-1', 4.5, 'Today numeral (navy circle), step numbers, active toggle side'],
  ['P13', 'ink-inverse', 'accent-strong', 4.5, 'Primary button label'],
  ['P14', 'ink-inverse', 'accent-strong-hover', 4.5, 'Primary button hover/pressed'],
  ['P15', 'ink-inverse', 'danger-strong', 4.5, 'Destructive button label'],
  ['P16', 'ink-inverse', 'danger-strong-hover', 4.5, 'Destructive button hover/pressed'],
  ['P17', 'accent-ink', 'surface-1', 4.5, 'Red text on page'],
  ['P18', 'accent-ink', 'surface-2', 4.5, 'Low-preference ? mark and label in cells and cards'],
  ['P19', 'accent-ink', 'accent-soft', 4.5, '苦手 tag; low-preference chip'],
  ['P20', 'ink-1', 'accent-soft', 4.5, 'Assessment sentence in the low-preference block'],
  ['P21', 'ink-2', 'accent-soft', 4.5, 'Secondary text in the low-preference block'],
  ['P22', 'saturday', 'surface-1', 4.5, 'Saturday numeral/header on page'],
  ['P23', 'saturday', 'surface-2', 4.5, 'Saturday numeral in a cell'],
  ['P24', 'sunday', 'surface-1', 4.5, 'Sunday/holiday numeral/header on page'],
  ['P25', 'sunday', 'surface-2', 4.5, 'Holiday numeral and 祝 in a cell'],
  ['P26', 'info', 'surface-1', 4.5, 'Info text on page'],
  ['P27', 'info', 'surface-2', 4.5, 'Info icon/text in cards'],
  ['P28', 'ink-1', 'info-soft', 4.5, 'Info banner and disclaimer text'],
  ['P29', 'info', 'info-soft', 4.5, 'Info banner icon and title'],
  ['P30', 'link', 'surface-1', 4.5, 'Inline link on page'],
  ['P31', 'link', 'surface-2', 4.5, 'Inline link in cards and sheets'],
  ['P32', 'success', 'success-soft', 4.5, 'Success banner text'],
  ['P33', 'success', 'surface-2', 4.5, 'Success icon/text in cards'],
  ['P34', 'ink-1', 'success-soft', 4.5, 'Success banner body'],
  ['P35', 'warning', 'warning-soft', 4.5, 'Warning banner title, uncertain label, needs-review badge'],
  ['P36', 'ink-1', 'warning-soft', 4.5, 'Warning banner body; uncertain field value'],
  ['P37', 'warning', 'surface-2', 4.5, 'Warning icon/text in cards and sheets'],
  ['P38', 'warning', 'surface-1', 4.5, 'Warning text on page'],
  ['P39', 'danger', 'surface-1', 4.5, 'Error text under a field on page'],
  ['P40', 'danger', 'surface-2', 4.5, 'Error text in cards and sheets'],
  ['P41', 'danger', 'danger-soft', 4.5, 'Error banner title'],
  ['P42', 'ink-1', 'danger-soft', 4.5, 'Error banner body'],
  ['P43', 'ink-2', 'line-1', 4.5, 'Label on hatch (label sits on its own surface-2 pill; worst case)'],
  ['P44', 'ink-1', 'surface-disabled', 4.5, 'n/a placeholder', true],
  ['U01', 'line-ui', 'surface-1', 3, 'Input/checkbox/radio/switch border on page'],
  ['U02', 'line-ui', 'surface-2', 3, 'Input/checkbox/radio border in cards and sheets; dashed current-date cell in the date-correction grid'],
  ['U03', 'line-ui', 'surface-3', 3, 'Disabled control dashed border on disabled fill'],
  ['U04', 'ink-1', 'surface-2', 3, 'Secondary button border; not-confirmed cell solid outline; same-weekday bar in the date-correction grid'],
  ['U05', 'accent', 'surface-1', 3, 'Dashed suggestion outline (low-preference, still school lunch) on page'],
  ['U06', 'accent', 'surface-2', 3, 'Dashed suggestion outline on cell surface'],
  ['U07', 'accent-strong', 'surface-1', 3, 'Primary button fill boundary on page'],
  ['U08', 'accent-strong', 'surface-2', 3, 'Primary button fill boundary in cards'],
  ['U09', 'danger', 'surface-2', 3, 'Invalid input border'],
  ['U10', 'focus-ring', 'surface-1', 3, 'Focus ring on page'],
  ['U11', 'focus-ring', 'surface-2', 3, 'Focus ring in cards and sheets'],
  ['U12', 'focus-ring', 'focus-halo', 3, 'Focus ring against its halo (on any fill, incl. planned cells)'],
  ['U13', 'navy-fill', 'surface-1', 3, 'Planned cell fill boundary on page'],
  ['U14', 'warning', 'surface-2', 3, 'Uncertain field 2 px border; needs-review badge border'],
  ['U15', 'warning-soft', 'navy-fill', 3, 'Needs-review badge on a planned (filled) cell'],
  ['U16', 'success', 'surface-2', 3, 'Checked checkbox fill; switch on track'],
  ['U17', 'ink-inverse', 'success', 3, 'Check mark on the checked checkbox / switch knob'],
  ['U18', 'accent-ink', 'surface-2', 3, 'Low-preference ? mark (icon)'],
  ['U19', 'ink-2', 'surface-2', 3, 'Assessment marks ○ △ — (icons); taken-date dot in the date-correction grid'],
  ['U20', 'planned-edge', 'navy-fill', 3, 'Red top edge of a planned cell and planned banner edge'],
  ['U21', 'accent', 'surface-3', 3, 'Stripe band on illustration panels (decorative)'],
  ['U22', 'stripe-a', 'surface-1', 3, 'Navy stripe band under the app bar (decorative)'],
  ['U23', 'line-ui', 'navy-fill', 3, 'Cell hover border on planned cell (uses ink-inverse 1px inset instead; listed for completeness)', true],
  ['D01', 'debug-ink', 'debug-surface', 4.5, 'Debug panel text (dev only)'],
  ['D02', 'debug-accent', 'debug-surface', 3, 'Debug panel borders and controls (dev only)'],
  ['D03', 'debug-surface', 'debug-accent', 4.5, 'DEV pill text on accent (dev only)'],
];

const out = [];
let fail = 0;
let lowest = { r: 99 };
out.push('| # | Foreground on background | Light | Dark | Needs | Used for |');
out.push('|---|---|---|---|---|---|');
for (const [id, fg, bg, need, use, skip] of pairs) {
  if (skip) continue;
  const cell = (theme) => {
    const f = t.color[theme][fg]?.value; const b = t.color[theme][bg]?.value;
    if (!f || !b) throw new Error(`missing ${fg}/${bg} in ${theme}`);
    const r = ratio(f, b);
    if (r < need) fail++;
    if (r < lowest.r) lowest = { r, id, fg, bg, theme, need };
    return `${r.toFixed(2)}${r < need ? ' **FAIL**' : ''}`;
  };
  out.push(`| ${id} | \`${fg}\` on \`${bg}\` | ${cell('light')} | ${cell('dark')} | ${need} | ${use} |`);
}
console.log(out.join('\n'));
console.log(`\nfails: ${fail}; lowest: ${lowest.id} ${lowest.fg} on ${lowest.bg} (${lowest.theme}) ${lowest.r.toFixed(2)} (needs ${lowest.need})`);
// lowest text pair
process.exitCode = fail ? 1 : 0;
