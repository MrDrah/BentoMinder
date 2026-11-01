import { readFileSync } from 'node:fs';
import { parseModelReply } from '../../../src/domain/menu/extraction.ts';
const [file, month] = process.argv.slice(2);
const text = readFileSync(file, 'utf8');
const out = parseModelReply(text, { targetMonth: month, sha256: 'a'.repeat(64), byteSize: 1, model: 'm', promptVersion: 3, at: '2026-11-01T00:00:00+09:00' });
console.log(out.kind, JSON.stringify(out.issues ?? ''));
const j = JSON.parse(text);
console.log(Object.keys(j), j.days?.length, j.noLunchDays?.length, j.outOfMonthDays?.length);
