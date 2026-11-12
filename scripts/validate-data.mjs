#!/usr/bin/env node
// Data validator (architecture §11.3, contract §6). Runs the contract's zod schemas and the
// cross-field / cross-entity rules on every data file and fixture. Prints one line per
// problem as `<file> <rule-id> <path>` and exits 1 on any error. No network.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  bentoMinderStoreSchema,
  CURRENT_SCHEMA_VERSION,
  dictionaryIssues,
  dictionarySchema,
  extractedMenuSchema,
  recipeLibraryIssues,
  recipeSchema,
  toRuleIssues,
} from '../src/domain/schema/index.ts';
import { migrate } from '../src/domain/storage/migrations/index.ts';
import { parseModelReply } from '../src/domain/menu/extraction.ts';
import { buildDictionary } from './build-dictionary.mjs';
import { batchFiles, mergeBatches } from './merge-research.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p).replaceAll('\\', '/');

/**
 * Approved publishers (docs/ba/research-brief.md §3) as host names; subdomains match.
 * Manufacturer hosts are the Developer's reading of the brand names: the BA confirms them.
 */
export const APPROVED_HOSTS = [
  'maff.go.jp',
  'nipponham.co.jp',
  'shimadaya.co.jp',
  'hagoromofoods.co.jp',
  'marukome.co.jp',
  'nissui.co.jp',
  'meg-snow.com',
  'pref.kyoto.jp',
  'city.sendai.jp',
  'caa.go.jp',
  'cfa.go.jp',
  'mhlw.go.jp',
  'kyounoryouri.jp',
  'sirogohan.com',
  'orangepage.net',
  'lettuceclub.net',
  'ajinomoto.co.jp',
  'kikkoman.co.jp',
  'housefoods.jp',
  'mizkan.co.jp',
  'kurashiru.com',
  'delishkitchen.tv',
  'justonecookbook.com',
  'bbcgoodfood.com',
];

const errors = [];
const report = (file, rule, path = '') => errors.push(`${file} ${rule} ${path}`.trimEnd());

function readJson(path) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    report(rel(path), existsSync(path) ? 'json-parse' : 'file-missing', String(err.message ?? err).slice(0, 80));
    return { ok: false };
  }
}

function zodReport(file, error, prefix = '') {
  for (const i of toRuleIssues(error)) report(file, i.rule, [prefix, i.path].filter(Boolean).join('.'));
}

const listJson = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f)) : [];

// 1. Dictionary: schema, dictionary §8 rules, and in sync with the BA's markdown source.
const dictPath = join(root, 'data', 'dictionary.json');
let dictionary = null;
const dictJson = readJson(dictPath);
if (dictJson.ok) {
  const parsed = dictionarySchema.safeParse(dictJson.value);
  if (!parsed.success) zodReport('data/dictionary.json', parsed.error);
  else {
    dictionary = parsed.data;
    for (const i of dictionaryIssues(dictionary)) report('data/dictionary.json', i.rule, [i.id, i.detail].filter(Boolean).join(' '));
    const rebuilt = buildDictionary(readFileSync(join(root, 'docs', 'ba', 'domain-dictionary.md'), 'utf8'));
    if (JSON.stringify(rebuilt) !== JSON.stringify(dictJson.value)) {
      report('data/dictionary.json', 'generated-stale', 'run npm run build:dictionary');
    }
  }
}

// 2. Recipes: every batch record, the merged library, library-wide and dictionary rules.
const batches = batchFiles(join(root, 'data', '_research'));
for (const file of batches) {
  const doc = readJson(file);
  if (!doc.ok) continue;
  const items = Array.isArray(doc.value) ? doc.value : doc.value?.recipes;
  if (!Array.isArray(items)) {
    report(rel(file), 'batch-shape', 'expected an array or { recipes: [...] }');
    continue;
  }
  items.forEach((r, n) => {
    // dishType is required in data/library.json only; a batch may omit it (the merge step adds it), but a
    // value that is present must be valid (US-E17-01/AC9).
    const parsed = recipeSchema.safeParse(r && typeof r === 'object' && !('dishType' in r) ? { ...r, dishType: 'other' } : r);
    if (!parsed.success) zodReport(rel(file), parsed.error, `${n}(${r?.id ?? '?'})`);
  });
}
const libraryPath = join(root, 'data', 'library.json');
const libJson = readJson(libraryPath);
if (libJson.ok) {
  const parsed = z.array(recipeSchema).safeParse(libJson.value);
  if (!parsed.success) zodReport('data/library.json', parsed.error);
  else if (dictionary !== null) {
    for (const i of recipeLibraryIssues(parsed.data, dictionary, APPROVED_HOSTS)) {
      report('data/library.json', i.rule, `${i.recipeId}.${i.path}`);
    }
  }
  try {
    if (JSON.stringify(mergeBatches(batches)) !== JSON.stringify(libJson.value)) {
      report('data/library.json', 'generated-stale', 'run npm run merge:research');
    }
  } catch (err) {
    report('data/_research', 'json-parse', String(err.message ?? err).slice(0, 80));
  }
}

// 3. Saved-data fixtures: the current version validates; older ones migrate, then validate.
for (const file of listJson(join(root, 'tests', 'fixtures', 'state'))) {
  const doc = readJson(file);
  if (!doc.ok) continue;
  const version = doc.value?.schemaVersion;
  let candidate = doc.value;
  if (typeof version === 'number' && version < CURRENT_SCHEMA_VERSION) {
    try {
      candidate = migrate(doc.value, version, CURRENT_SCHEMA_VERSION);
    } catch {
      report(rel(file), 'migration-failed', `from v${version}`);
      continue;
    }
  }
  const parsed = bentoMinderStoreSchema.safeParse(candidate);
  if (!parsed.success) zodReport(rel(file), parsed.error);
}

// 4. Menu fixtures (finding F-2): QA's nested folders tests/fixtures/menus/<id>/.
//    - answer-key.json / review-data.json → `.menu` must be a valid ExtractedMenu;
//    - recorded/*.json with a model output: the app's own pipeline (JSON → F-1 normaliser →
//      strict schema, src/domain/menu/extraction.ts) must give the outcome the stand-in expects
//      (`ok` stays ok; MALFORMED / NOT_A_MENU stand-ins must not pass), and stand-ins declared
//      strictly valid must also pass the strict schema as recorded.
//    QA's check-fixtures.mjs (npm run check:fixtures) checks the fixture conventions themselves
//    (answer-key diffs, hard fields, PDFs); this step checks that the *app* reads every fixture.
const menusDir = join(root, 'tests', 'fixtures', 'menus');
let menuFixtures = 0;
let recordedChecked = 0;
for (const id of existsSync(menusDir) ? readdirSync(menusDir).sort() : []) {
  const dir = join(menusDir, id);
  const keyFile = ['answer-key.json', 'review-data.json'].map((f) => join(dir, f)).find((f) => existsSync(f));
  if (keyFile === undefined) continue;
  const key = readJson(keyFile);
  if (!key.ok) continue;
  menuFixtures += 1;
  const parsed = extractedMenuSchema.safeParse(key.value?.menu);
  if (!parsed.success) zodReport(rel(keyFile), parsed.error, 'menu');
  for (const file of listJson(join(dir, 'recorded'))) {
    const doc = readJson(file);
    if (!doc.ok) continue;
    const res = doc.value?.response ?? {};
    const expected = String(doc.value?.expect?.extractResult ?? '');
    if (res.httpStatus !== 200) continue;
    const text = res.rawText ?? JSON.stringify(res.modelOutput);
    const month = String(res.modelOutput?.targetMonth ?? key.value?.menu?.targetMonth ?? '');
    const outcome = parseModelReply(text, {
      targetMonth: month,
      sha256: '0'.repeat(64),
      byteSize: 1,
      model: String(doc.value?.model ?? 'fixture'),
      promptVersion: 1,
      at: '2026-10-24T00:00:00+09:00',
    });
    recordedChecked += 1;
    const wantOk = expected === 'ok';
    if (wantOk && outcome.kind !== 'ok') report(rel(file), 'fixture-pipeline', `expected ok, got ${outcome.kind} ${outcome.issues?.join(';') ?? ''}`.trim());
    if (!wantOk && outcome.kind === 'ok') report(rel(file), 'fixture-pipeline', `expected "${expected}", the pipeline accepted it`);
    if (doc.value?.expect?.strictSchemaValid === true && res.modelOutput !== undefined && parsed.success) {
      const full = { id: parsed.data.id, ...res.modelOutput, source: parsed.data.source, extractedAt: parsed.data.extractedAt };
      const strict = extractedMenuSchema.safeParse(full);
      if (!strict.success) zodReport(rel(file), strict.error, 'modelOutput');
    }
  }
}

// 5. Banned phrases (BA-owned list the UI must never contain; BR-07, BR-18, BR-19).
const bannedSchema = z.strictObject({
  version: z.number().int().min(1),
  ja: z.array(z.string().min(1)),
  en: z.array(z.string().min(1)),
});
const banned = readJson(join(root, 'data', 'banned-phrases.json'));
if (banned.ok) {
  const parsed = bannedSchema.safeParse(banned.value);
  if (!parsed.success) for (const i of parsed.error.issues) report('data/banned-phrases.json', 'banned-phrases-schema', i.path.join('.'));
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  console.error(`\nvalidate-data: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(
  `validate-data: OK (dictionary ${dictionary ? 'valid' : 'missing'}, ${batches.length} batch file(s), ` +
    `library ${libJson.ok ? libJson.value.length : 0} recipes, state fixtures, ${menuFixtures} menu fixtures / ${recordedChecked} recorded replies, banned phrases)`,
);
