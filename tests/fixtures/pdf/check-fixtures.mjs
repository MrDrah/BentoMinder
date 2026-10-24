#!/usr/bin/env node
// Checks every synthetic menu fixture (tests/fixtures/menus/<id>/) against the contract v1 zod
// schemas and the fixture conventions in tests/plan/fixtures-plan.md §7. No network.
//   - answer-key.json / review-data.json: `synthetic: true`, fixtureId = folder, `menu` parses
//     with extractedMenuSchema, hardFields resolve, weekday/date consistency (own calendar
//     arithmetic, not the app's), printed day numbers match dates.
//   - recorded/*.json: `synthetic: true`, `recordedBy: "hand"`, the model output parsed with the
//     strict schema (after adding the app-set id/source/extractedAt) gives exactly the expected
//     outcome and rule ids; differences from the answer key are exactly the declared ones; hard
//     fields come back uncertain where the stand-in says so.
//   - menu.pdf: present for every layout.html, starts with %PDF-, < 1 MB; layout prints the
//     fictional school name and footer. not-a-pdf.pdf does not start with %PDF-.
// Usage: node tests/fixtures/pdf/check-fixtures.mjs   (exit 1 on any problem)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractedMenuSchema, toRuleIssues } from '../../../src/domain/schema/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const menusDir = join(here, '..', 'menus');
const rel = (p) => relative(root, p).replaceAll('\\', '/');
const SCHOOL = 'テストようちえん（架空）';
const FOOTER = 'テスト用の架空の献立表です。実在の園とは関係ありません。';
const MAX_PDF = 1_048_576;
const WD = ['日', '月', '火', '水', '木', '金', '土'];

const problems = [];
let checks = 0;
const fail = (file, msg) => problems.push(`${rel(file)}: ${msg}`);
const check = (cond, file, msg) => {
  checks++;
  if (!cond) fail(file, msg);
  return cond;
};

// Independent calendar arithmetic (does not use src/domain/time).
function weekdayChar(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return WD[dt.getUTCDay()];
}

/** Resolve `days[YYYY-MM-DD].items[0].text`-style paths in a menu. */
function resolvePath(menu, path) {
  let cur = menu;
  for (const part of path.split('.')) {
    const m = /^(\w+)(?:\[([^\]]+)\])?$/.exec(part);
    if (!m || cur == null) return undefined;
    cur = cur[m[1]];
    if (m[2] !== undefined) {
      if (!Array.isArray(cur)) return undefined;
      cur = /^\d+$/.test(m[2]) ? cur[Number(m[2])] : cur.find((x) => (x.date ?? x.day?.date ?? x.noLunchDay?.date) === m[2]);
    }
  }
  return cur;
}
/** The object whose `verification` covers a hard-field path. */
function verificationOwner(menu, path) {
  const owner = path.endsWith('.verification') ? path.slice(0, -'.verification'.length) : path.replace(/\.(text|status|rawText)$/, '');
  return resolvePath(menu, owner);
}

/** Leaf differences between two menu-shaped values; days/noLunchDays keyed by date. */
function diff(a, b, path = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const keyed = /(^|\.)(days|noLunchDays)$/.test(path);
  if (keyed && Array.isArray(a) && Array.isArray(b)) {
    const ka = new Map(a.map((x) => [x.date, x]));
    const kb = new Map(b.map((x) => [x.date, x]));
    for (const k of new Set([...ka.keys(), ...kb.keys()])) diff(ka.get(k), kb.get(k), `${path}[${k}]`, out);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path ? `${path}.${k}` : k, out);
    return out;
  }
  out.push(path);
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(file, `not valid JSON (${String(err.message).slice(0, 60)})`);
    return null;
  }
}

function checkMenuConsistency(file, menu) {
  for (const d of menu.days ?? []) {
    const actual = weekdayChar(d.date);
    if (!check(actual !== null, file, `${d.date}: not a calendar date`)) continue;
    if (d.printedWeekday !== null) {
      const flagged = d.verification?.status === 'uncertain' && d.verification?.reason === 'weekday-mismatch';
      check(d.printedWeekday === actual || flagged, file, `${d.date}: printed ${d.printedWeekday} but the date is ${actual} and the day is not flagged weekday-mismatch`);
      check(d.printedWeekday !== actual || !flagged, file, `${d.date}: flagged weekday-mismatch but ${d.printedWeekday} is correct`);
    }
    if (d.printedDateText) {
      const n = /\d+/.exec(d.printedDateText)?.[0];
      check(n === undefined || Number(n) === Number(d.date.slice(8)), file, `${d.date}: printedDateText 「${d.printedDateText}」 has another day number`);
      const w = /[（(]([日月火水木金土])[）)]/.exec(d.printedDateText)?.[1];
      check(w === undefined || w === d.printedWeekday, file, `${d.date}: weekday in printedDateText differs from printedWeekday`);
    }
    check(d.allergenDeclaration?.status !== 'declared-none' || d.allergenDeclaration?.rawText, file, `${d.date}: declared-none without printed text (BR-08)`);
  }
  for (const n of menu.noLunchDays ?? []) check(weekdayChar(n.date) !== null, file, `${n.date}: not a calendar date`);
}

function parseStrict(menu) {
  const r = extractedMenuSchema.safeParse(menu);
  return r.success ? { valid: true, rules: [] } : { valid: false, rules: [...new Set(toRuleIssues(r.error).map((i) => i.rule))].sort() };
}

const dirs = readdirSync(menusDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const summary = [];

for (const id of dirs) {
  const dir = join(menusDir, id);
  const keyFile = existsSync(join(dir, 'answer-key.json')) ? join(dir, 'answer-key.json') : join(dir, 'review-data.json');
  if (!check(existsSync(keyFile), dir, 'no answer-key.json or review-data.json')) continue;
  const key = readJson(keyFile);
  if (!key) continue;
  check(key.synthetic === true, keyFile, '"synthetic": true missing');
  check(key.fixtureId === id, keyFile, `fixtureId ${key.fixtureId} ≠ folder ${id}`);
  check(Array.isArray(key.hardFields), keyFile, 'hardFields[] missing');
  const parsed = parseStrict(key.menu);
  check(parsed.valid, keyFile, `menu is not a valid ExtractedMenu: ${parsed.rules.join(', ')}`);
  check(key.menu?.source?.kind === 'fixture', keyFile, 'menu.source.kind must be "fixture"');
  check(key.menu?.id?.startsWith(`ext-${key.menu?.targetMonth}-`), keyFile, 'menu.id must start with ext-<targetMonth>-');
  checkMenuConsistency(keyFile, key.menu ?? {});
  for (const h of key.hardFields ?? []) check(resolvePath(key.menu, h) !== undefined, keyFile, `hardField ${h} does not resolve`);
  check(existsSync(join(dir, 'README.md')) && /Answer-key review/.test(readFileSync(join(dir, 'README.md'), 'utf8')), dir, 'README.md with an answer-key review line missing');

  // Layout and PDF.
  const layout = join(dir, 'layout.html');
  let pdfInfo = 'no PDF (JSON only)';
  if (existsSync(layout)) {
    const html = readFileSync(layout, 'utf8');
    const scanOf = /data-scan-of="([^"]+)"/.exec(html)?.[1];
    const printed = scanOf ? readFileSync(join(menusDir, scanOf, 'layout.html'), 'utf8') : html;
    check(printed.includes(SCHOOL), layout, `school name 「${SCHOOL}」 not printed`);
    check(printed.includes(FOOTER), layout, 'fictional-menu footer not printed');
    check(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), layout, 'layout references a URL (must be self-contained)');
    const pdf = join(dir, 'menu.pdf');
    if (check(existsSync(pdf), dir, 'menu.pdf missing: run node tests/fixtures/pdf/generate-menus.mjs')) {
      const bytes = readFileSync(pdf);
      check(bytes.subarray(0, 5).toString('latin1') === '%PDF-', pdf, 'does not start with %PDF-');
      check(bytes.length < MAX_PDF, pdf, `${bytes.length} bytes ≥ 1 MB`);
      pdfInfo = `menu.pdf ${(bytes.length / 1024).toFixed(1)} KB`;
    }
  }

  // Recorded stand-ins.
  const recDir = join(dir, 'recorded');
  const recFiles = existsSync(recDir) ? readdirSync(recDir).filter((f) => f.endsWith('.json')).sort() : [];
  for (const f of recFiles) {
    const file = join(recDir, f);
    const rec = readJson(file);
    if (!rec) continue;
    check(rec.synthetic === true, file, '"synthetic": true missing');
    check(rec.recordedBy === 'hand' || rec.recordedBy === 'live', file, 'recordedBy must be "hand" (or "live" from M5)');
    check(rec.fixtureId === id, file, `fixtureId ${rec.fixtureId} ≠ folder ${id}`);
    check(typeof rec.scenario === 'string' && rec.expect && typeof rec.expect === 'object', file, 'scenario and expect required');
    const res = rec.response ?? {};
    if (res.httpStatus !== 200) {
      check(Number.isInteger(res.httpStatus) && res.httpStatus >= 400, file, 'failure response needs an HTTP error status');
      check(res.retryAfterSeconds === null || Number.isInteger(res.retryAfterSeconds), file, 'retryAfterSeconds must be an integer or null');
      continue;
    }
    if (res.rawText !== undefined) {
      let parses = true;
      try {
        JSON.parse(res.rawText);
      } catch {
        parses = false;
      }
      check(parses === rec.expect.jsonParses, file, `rawText JSON.parse ${parses ? 'succeeds' : 'fails'}, expected jsonParses ${rec.expect.jsonParses}`);
      continue;
    }
    const out = res.modelOutput;
    if (!check(out && typeof out === 'object', file, 'response.modelOutput missing')) continue;
    for (const k of ['id', 'source', 'extractedAt']) check(!(k in out), file, `modelOutput must not contain app-set field ${k} (ADR 002 §3)`);
    const full = { id: key.menu.id, ...out, source: key.menu.source, extractedAt: key.menu.extractedAt };
    const r = parseStrict(full);
    check(r.valid === rec.expect.strictSchemaValid, file, `strict schema ${r.valid ? 'accepts' : `rejects (${r.rules.join(', ')})`}, expected strictSchemaValid ${rec.expect.strictSchemaValid}`);
    if (rec.expect.strictSchemaRules) {
      check(JSON.stringify(r.rules) === JSON.stringify([...rec.expect.strictSchemaRules].sort()), file, `rule ids ${JSON.stringify(r.rules)} ≠ expected ${JSON.stringify(rec.expect.strictSchemaRules)}`);
    }
    if (r.valid) checkMenuConsistency(file, full);
    if (rec.expect.differsFromAnswerKeyAt) {
      const { id: _i, source: _s, extractedAt: _e, ...answer } = key.menu;
      void _i; void _s; void _e;
      const leaves = diff(answer, out);
      const declared = rec.expect.differsFromAnswerKeyAt;
      const under = (leaf, p) => leaf === p || leaf.startsWith(`${p}.`) || leaf.startsWith(`${p}[`);
      for (const leaf of leaves) check(declared.some((p) => under(leaf, p)), file, `undeclared difference from the answer key at ${leaf}`);
      for (const p of declared) check(leaves.some((leaf) => under(leaf, p)), file, `declared difference ${p} not present`);
    }
    if (rec.expect.flagsHardFields) {
      for (const h of key.hardFields) {
        const owner = verificationOwner(out, h);
        check(owner?.verification?.status === 'uncertain', file, `hard field ${h} is not uncertain in the stand-in`);
      }
    }
  }
  summary.push(`${id.padEnd(34)} days ${String(key.menu?.days?.length ?? 0).padStart(2)}  no-lunch ${String(key.menu?.noLunchDays?.length ?? 0).padStart(2)}  recorded ${recFiles.length}  ${pdfInfo}`);
}

// File fixture: a .pdf that is not a PDF.
const notPdf = join(here, 'not-a-pdf.pdf');
if (check(existsSync(notPdf), notPdf, 'missing: run generate-menus.mjs')) {
  const b = readFileSync(notPdf);
  check(b.length > 0 && b.subarray(0, 5).toString('latin1') !== '%PDF-', notPdf, 'must be non-empty text bytes without the %PDF- header');
  summary.push(`not-a-pdf.pdf                      ${statSync(notPdf).size} bytes, no %PDF- header`);
}

console.log(summary.join('\n'));
if (problems.length > 0) {
  console.error(`\n${problems.join('\n')}\n\ncheck-fixtures: ${problems.length} problem(s) in ${checks} checks`);
  process.exit(1);
}
console.log(`\ncheck-fixtures: OK (${dirs.length} fixtures, ${checks} checks)`);
