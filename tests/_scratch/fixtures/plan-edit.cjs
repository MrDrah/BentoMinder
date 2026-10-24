const fs = require('fs');
const f = 'C:/Projects/BentoMinder/tests/plan/fixtures-plan.md';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.replace(a, b); };
rep('Owner: QA (with BA for answer keys) · 2026-10-24 · Status: H1 plan ·', 'Owner: QA (with BA for answer keys) · 2026-10-24 · Status: menu fixtures FX-01…FX-08 **built** (M1 prep, §7); BA answer-key review pending; §3–§5 partly built ·');
rep('(`npm run fixtures:menus`, Playwright `page.pdf()` with a bundled OFL-licensed Japanese font such as Noto Sans JP)', '(`node tests/fixtures/pdf/generate-menus.mjs`, alias `npm run fixtures:menus` requested; Playwright Chromium `page.pdf()`, A4, using only Japanese fonts installed with Windows: "Yu Gothic", "Meiryo", "BIZ UDGothic"; nothing downloaded; see §7)');
rep('| 12-24 … 1-7 | band 「冬休み（12月24日〜1月7日）」 | `noLunchDays` `closed` for 12-24, 12-25, 12-28, 12-29, 12-30, 12-31 (in-month weekdays; see FX-Q1); nothing for January |',
    "| 12-24 … 1-6 | band 「冬休み（12月24日〜1月6日）」 (built with 1月6日 so it agrees with FX-05's 1-07 始業式) | `noLunchDays` `closed` for 12-24, 12-25, 12-28, 12-29, 12-30, 12-31 (in-month weekdays; see FX-Q1); January part → `outOfMonthDays` `no-lunch-day` `closed` for 2027-01-01, 01-04, 01-05, 01-06 (contract H1, FX-Q3, US-E2-05/AC4) |");
rep('Variant: **FX-05b** recorded output that shifts the right-hand block by one week (a realistic misreading)', 'Variant: **FX-05b** recorded output that misreads the side-by-side blocks (built as: the weeks of 1-18 and 1-25 swapped, 10 of 15 lunch days wrong; schema-valid)');
rep('- **FX-Q3** Contract gap:', '- **FX-Q4** (new, M1 prep) Grid layout (FX-02): the weekday is printed only as the column header, not next to the day number. Built as `printedDateText` "1" and `printedWeekday` = the column header. Alternative: `printedWeekday` null.\n- **FX-Q3** (resolved at H1: contract `OutOfMonthEntry` holds both kinds) Contract gap:');
s = s.replace(/\s*$/, '\n');
s += fs.readFileSync('C:/Projects/BentoMinder/tests/_scratch/fixtures/plan-s7.md', 'utf8');
fs.writeFileSync(f, s);
console.log('ok');
