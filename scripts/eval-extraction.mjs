#!/usr/bin/env node
// Live AI extraction eval (architecture §6, ADR 002 §6). OPT-IN: makes real Gemini calls with the
// key from .env (loaded by `npm run eval:extraction` via --env-file; GEMINI_API_KEY), counts
// against the free tier, and is never part of any gate or test script.
//   npm run eval:extraction [-- <fixture-id> ...]   (default: every fixture PDF)
// Reports per fixture: provider calls, token usage, date mapping, dish recall, extra dishes and
// invented allergens (a day with a declared allergen list the answer key does not have). Writes
// reports/eval-<timestamp>.json. The key is never printed or written.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModelReply } from '../src/domain/menu/extraction.ts';
import { memoryCache, runExtraction, windowCap } from '../server/menu/extract.ts';
import { createGeminiTransport } from '../server/menu/gemini-transport.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const menusDir = join(root, 'tests', 'fixtures', 'menus');
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey === undefined || apiKey.trim() === '') {
  console.error('eval:extraction needs GEMINI_API_KEY in .env (see .env.example). Nothing was called.');
  process.exit(1);
}

// EVAL_DEBUG=1: per call print model, HTTP status, finishReason, token counts, the raw candidate
// text (first 2,000 chars; synthetic fixtures only) and the validation issues; the full raw text of
// the last reply goes to reports/ (git-ignored). Wraps fetch only: no key, header or request body.
const debug = process.env.EVAL_DEBUG === '1';
let lastRaw = null;
const debugFetch = async (url, init) => {
  const res = await globalThis.fetch(url, init);
  const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? '?';
  const body = await res.clone().json().catch(() => null);
  const cand = body?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).filter((p) => p.thought !== true && typeof p.text === 'string').map((p) => p.text).join('');
  const u = body?.usageMetadata ?? {};
  console.log(`  [debug] model=${model} status=${res.status} finishReason=${cand?.finishReason ?? '-'} promptTokens=${u.promptTokenCount ?? '-'} candidateTokens=${u.candidatesTokenCount ?? '-'} thoughtTokens=${u.thoughtsTokenCount ?? '-'}`);
  if (!res.ok) console.log(`  [debug] error=${JSON.stringify(body?.error ?? null).slice(0, 1000)}`);
  if (res.ok) {
    lastRaw = text;
    console.log(`  [debug] raw(first 2000)=${text.slice(0, 2000)}`);
    const out = parseModelReply(text, { targetMonth: '2026-11', sha256: 'x'.repeat(64), byteSize: 1, model, promptVersion: 1, at: new Date().toISOString() });
    console.log(`  [debug] parse=${out.kind}${out.kind === 'malformed' ? ' issues=' + JSON.stringify(out.issues) : ''}`);
  }
  return res;
};

const usage = [];
const transport = createGeminiTransport({
  apiKey,
  fetch: debug ? debugFetch : globalThis.fetch,
  ...(process.env.AI_ALLOW_PAID_MODELS === 'true' ? { allowedModels: null } : {}),
  log: (m) => console.log(`  [log] ${m}`),
  onUsage: (model, u) => usage.push({ model, ...u }),
});

const wanted = process.argv.slice(2);
const ids = readdirSync(menusDir).filter((id) => wanted.length === 0 || wanted.includes(id));
const results = [];
for (const id of ids) {
  let pdf;
  let key;
  try {
    pdf = new Uint8Array(readFileSync(join(menusDir, id, 'menu.pdf')));
    key = JSON.parse(readFileSync(join(menusDir, id, 'answer-key.json'), 'utf8')).menu;
  } catch {
    continue;
  }
  const before = usage.length;
  const res = await runExtraction(
    { pdf, targetMonth: key.targetMonth },
    {
      transport,
      primaryModel: process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.8-flash',
      fallbackModel: process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.5-flash-lite',
      cache: memoryCache(),
      cap: windowCap({ perHour: 100, perDay: 100 }, Date.now),
      timestamp: () => new Date().toISOString(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      log: (m) => console.log(`  [log] ${m}`),
      bypassCache: true,
    },
  );
  const row = { fixture: id, ok: res.ok, providerCalls: res.ok ? res.meta.providerCalls : res.providerCalls, usage: usage.slice(before) };
  if (res.ok) {
    const got = new Map(res.menu.days.map((d) => [d.date, d.items.map((i) => i.text)]));
    const want = new Map(key.days.map((d) => [d.date, d.items.map((i) => i.text)]));
    const dates = [...want.keys()];
    const dateHits = dates.filter((d) => got.has(d)).length;
    const dishes = [...want].flatMap(([d, items]) => items.map((t) => [d, t]));
    const dishHits = dishes.filter(([d, t]) => got.get(d)?.includes(t)).length;
    const extra = [...got].flatMap(([d, items]) => items.filter((t) => !want.get(d)?.includes(t)).map((t) => `${d} ${t}`));
    const declared = (menu) => new Set(menu.days.filter((d) => d.allergenDeclaration?.status === 'declared').map((d) => d.date));
    const wantDeclared = declared(key);
    const invented = [...declared(res.menu)].filter((d) => !wantDeclared.has(d));
    Object.assign(row, { model: res.meta.model, dateMapping: `${dateHits}/${dates.length}`, dishRecall: `${dishHits}/${dishes.length}`, extraDishes: extra, inventedAllergenDays: invented });
  } else {
    row.error = res.error;
  }
  results.push(row);
  console.log(JSON.stringify(row));
}
mkdirSync(join(root, 'reports'), { recursive: true });
const file = join(root, 'reports', `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
if (debug && lastRaw !== null) writeFileSync(file.replace(/\.json$/, '.raw.txt'), lastRaw);
console.log(`Wrote ${file}. Total provider calls: ${results.reduce((n, r) => n + r.providerCalls, 0)}.`);
