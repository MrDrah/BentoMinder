#!/usr/bin/env node
// Builds data/library.json (GENERATED, never hand-edited) from data/_research/batch-*.json.
// Sorted by id; `[]` when there are no batches yet. Validation is validate-data's job.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'data', '_research');

export function batchFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((f) => /^batch-.*\.json$/.test(f))
    .sort()
    .map((f) => join(directory, f));
}

/** Reads every batch (an array of recipes, or `{ recipes: [...] }`) and returns them sorted by id. */
export function mergeBatches(files) {
  const recipes = [];
  for (const file of files) {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const items = Array.isArray(doc) ? doc : doc.recipes;
    if (!Array.isArray(items)) throw new Error(`${file}: expected an array of recipes or { recipes: [...] }`);
    recipes.push(...items);
  }
  return recipes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function main() {
  const files = batchFiles(dir);
  const recipes = mergeBatches(files);
  writeFileSync(join(root, 'data', 'library.json'), `${JSON.stringify(recipes, null, 2)}\n`);
  console.log(`wrote data/library.json: ${recipes.length} recipes from ${files.length} batch file(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
