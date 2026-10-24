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
    const parsed = recipeSchema.safeParse(r);
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

// 4. Menu fixtures (extracted menus, M1+).
for (const file of listJson(join(root, 'tests', 'fixtures', 'menus'))) {
  const doc = readJson(file);
  if (!doc.ok) continue;
  const parsed = extractedMenuSchema.safeParse(doc.value);
  if (!parsed.success) zodReport(rel(file), parsed.error);
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
    `library ${libJson.ok ? libJson.value.length : 0} recipes, state + menu fixtures, banned phrases)`,
);
