// In-memory merge of all batches + the library rules validate-data runs on data/library.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { recipeSchema, recipeLibraryIssues } from '../../../../src/domain/schema/index.ts';
import { batchFiles, mergeBatches } from '../../../../scripts/merge-research.mjs';

const root = 'C:/Projects/BentoMinder';
const APPROVED_HOSTS = ['maff.go.jp', 'pref.kyoto.jp', 'city.sendai.jp', 'caa.go.jp', 'cfa.go.jp', 'mhlw.go.jp',
  'kyounoryouri.jp', 'sirogohan.com', 'orangepage.net', 'lettuceclub.net', 'ajinomoto.co.jp', 'kikkoman.co.jp',
  'housefoods.jp', 'mizkan.co.jp', 'kurashiru.com', 'delishkitchen.tv', 'justonecookbook.com', 'bbcgoodfood.com'];
const src = readFileSync(join(root, 'scripts/validate-data.mjs'), 'utf8');
const hostsInValidator = [...src.matchAll(/^\s+'([a-z0-9.-]+\.[a-z]+)',$/gm)].map((m) => m[1]);
console.log('hosts match validator:', JSON.stringify(hostsInValidator.sort()) === JSON.stringify([...APPROVED_HOSTS].sort()));
const dict = JSON.parse(readFileSync(join(root, 'data/dictionary.json'), 'utf8'));
const merged = mergeBatches(batchFiles(join(root, 'data/_research')));
const parsed = z.array(recipeSchema).safeParse(merged);
if (!parsed.success) console.log('schema issues', parsed.error.issues.slice(0, 10));
const issues = recipeLibraryIssues(merged, dict, APPROVED_HOSTS);
console.log(`merged ${merged.length} recipes; library issues: ${issues.length}`);
for (const x of issues) console.log(' ', x.rule, x.recipeId, x.path);
const a = JSON.parse(readFileSync(join(root, 'data/_research/batch-a.json'), 'utf8'));
for (const r of a) console.log(r.id.padEnd(44), r.shortNameJa.padEnd(9), r.minutes, r.themeId ?? '-', 'allergenComplete=' + r.allergenDataComplete, 'dietComplete=' + r.dietDataComplete, '[' + r.allergenIds.join(',') + ']', 'may[' + r.mayContainAllergenIds.join(',') + ']', 'diets[' + r.dietOk.join(',') + ']');
