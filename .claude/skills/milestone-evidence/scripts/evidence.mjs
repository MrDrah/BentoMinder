#!/usr/bin/env node
// app-boilerplate milestone evidence. Node >= 20, no dependencies.
// Collects an Engineering Evidence Package for a milestone from evidence that already exists (test
// results, the story file, the event log, CI runs, the live site), validates packages against the
// published schema, and freezes them so they are never silently overwritten.
//
//   node evidence.mjs init [--name "My App"] [--id my-app]
//   node evidence.mjs event <type> --summary "…" [--task t] [--milestone m] [--outcome success|failure]
//                     [--defect D-1 --severity P2 --state found|fixed|deferred] [--regression] [--minutes n] [--by role]
//   node evidence.mjs usage [--quiet]          (also run by the session-start hook)
//   node evidence.mjs collect --milestone <id> [--revise --reason "…"] [--run-tests] [--offline]
//                     [--ci-runs runs.json] [--usage usage.json] [--allow-dirty] [--date YYYY-MM-DD]
//   node evidence.mjs validate [--package <id>]
//   node evidence.mjs freeze --package <id>
//   node evidence.mjs status
//
// Config: quality-gate.json → "evidence". Exit codes: 0 pass, 1 fail, 2 misconfiguration.
// Every number comes from a file this script reads. A value it cannot read is null with a reason;
// it never defaults to zero or to success.
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync, appendFileSync, copyFileSync } from 'node:fs';
import { join, relative, resolve, dirname, sep, basename } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SECRET_PATTERNS, globToRegExp } from '../../quality-gate/scripts/validate.mjs';

export const VERSION = '0.5.0';
export const SCHEMA_VERSION = '1.1.0';
const TOOL = 'app-boilerplate/evidence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// In a project the templates live in .claude/templates; in the framework repo they live in templates/.
const SCHEMA_DIR = [join(here, '../../../templates/evidence'), join(here, '../../../../templates/evidence')].find((d) => existsSync(join(d, 'metrics.schema.json')));

// ---------- small utilities ----------
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const root = process.cwd();
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m', dim: '\x1b[2m', reset: '\x1b[0m' };
const color = !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (c, s) => (color ? C[c] + s + C.reset : s);
const ok = (m) => console.log(`${paint('green', 'PASS')} ${m}`);
const bad = (m) => console.log(`${paint('red', 'FAIL')} ${m}`);
const warn = (m) => console.log(`${paint('yellow', 'WARN')} ${m}`);
const info = (m) => console.log(paint('dim', `     ${m}`));
const toPosix = (p) => p.split(sep).join('/');
const git = (...a) => { const r = spawnSync('git', a, { cwd: root, encoding: 'utf8' }); return { code: r.status ?? 1, out: (r.stdout ?? '').trim() }; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
// Text is hashed with LF line endings, so a CRLF checkout on Windows doesn't look like tampering.
const normalize = (buf) => (buf.includes(0) ? buf : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')));
export const sha256 = (buf) => createHash('sha256').update(typeof buf === 'string' ? Buffer.from(buf) : normalize(buf)).digest('hex');
const round1 = (n) => Math.round(n * 10) / 10;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'project';
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

// ---------- JSON Schema (the subset the published schemas use) ----------
// Consumers can use any 2020-12 validator; this one keeps the framework dependency-free. It refuses
// keywords it doesn't implement rather than silently ignoring them.
const ANNOTATIONS = new Set(['$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', '$defs']);
const KEYWORDS = new Set(['$ref', 'type', 'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'allOf', 'anyOf', 'not', 'if', 'then', 'else']);
export function unsupportedKeywords(schema, path = '#') {
  if (!schema || typeof schema !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(schema)) {
    if (!ANNOTATIONS.has(k) && !KEYWORDS.has(k)) out.push(`${path}/${k}`);
    if (k === 'properties' || k === '$defs') for (const [n, s] of Object.entries(v)) out.push(...unsupportedKeywords(s, `${path}/${k}/${n}`));
    else if (['items', 'additionalProperties', 'not', 'if', 'then', 'else'].includes(k) && typeof v === 'object') out.push(...unsupportedKeywords(v, `${path}/${k}`));
    else if (k === 'allOf' || k === 'anyOf') v.forEach((s, i) => out.push(...unsupportedKeywords(s, `${path}/${k}/${i}`)));
  }
  return out;
}
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeMatches = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');
export function validateSchema(schema, data, rootSchema = schema, path = '$') {
  if (schema === true || schema === undefined) return [];
  if (schema === false) return [`${path}: not allowed`];
  const errs = [];
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], rootSchema);
    if (!target) return [`${path}: unresolvable $ref ${schema.$ref}`];
    errs.push(...validateSchema(target, data, rootSchema, path));
  }
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => typeMatches(data, t))) return [...errs, `${path}: expected ${types.join('|')}, got ${typeOf(data)}`];
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) errs.push(`${path}: ${JSON.stringify(data)} is not one of ${schema.enum.join(', ')}`);
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(data)) errs.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(data)) errs.push(`${path}: "${data.slice(0, 60)}" does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && [...data].length < schema.minLength) errs.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && [...data].length > schema.maxLength) errs.push(`${path}: longer than ${schema.maxLength}`);
  }
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) errs.push(`${path}: ${data} < ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) errs.push(`${path}: ${data} > ${schema.maximum}`);
  }
  if (typeOf(data) === 'object') {
    for (const k of schema.required ?? []) if (!(k in data)) errs.push(`${path}: missing required "${k}"`);
    for (const [k, v] of Object.entries(data)) {
      if (schema.properties && k in schema.properties) errs.push(...validateSchema(schema.properties[k], v, rootSchema, `${path}.${k}`));
      else if (schema.additionalProperties !== undefined) errs.push(...validateSchema(schema.additionalProperties, v, rootSchema, `${path}.${k}`).map((e) => (schema.additionalProperties === false ? `${path}: unexpected property "${k}"` : e)));
    }
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) data.forEach((d, i) => errs.push(...validateSchema(schema.items, d, rootSchema, `${path}[${i}]`)));
  }
  for (const s of schema.allOf ?? []) errs.push(...validateSchema(s, data, rootSchema, path));
  if (schema.anyOf) {
    const branches = schema.anyOf.map((s) => validateSchema(s, data, rootSchema, path));
    // Report the closest form's error, so "150 > 100" isn't hidden behind "none of the forms".
    if (branches.every((b) => b.length)) errs.push(`${path}: matches none of the allowed forms (closest: ${branches.sort((a, b) => a.length - b.length)[0][0].replace(`${path}: `, '')})`);
  }
  if (schema.not && !validateSchema(schema.not, data, rootSchema, path).length) errs.push(`${path}: matches a forbidden form`);
  if (schema.if) {
    const branch = validateSchema(schema.if, data, rootSchema, path).length ? schema.else : schema.then;
    if (branch) errs.push(...validateSchema(branch, data, rootSchema, path));
  }
  return errs;
}
const schemaFile = (name) => {
  if (!SCHEMA_DIR) { console.error('evidence schemas not found next to this script (.claude/templates/evidence/)'); process.exit(2); }
  return readJson(join(SCHEMA_DIR, `${name}.schema.json`));
};

// ---------- privacy: what a public package may never contain ----------
const ABS_PATH = /(^|[\s"'(=,[>])((?:[A-Za-z]:[\\/]|\\\\[^\s\\]+\\|\/(?:Users|home|root|private|var|tmp|mnt|opt|workspace)\/)[^\s"'<>]*)/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/;
export function sensitiveHits(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const [label, re] of SECRET_PATTERNS) if (re.test(line)) hits.push(`line ${i + 1}: possible ${label}`);
    if (ABS_PATH.test(line)) hits.push(`line ${i + 1}: absolute local path "${line.match(ABS_PATH)[2].slice(0, 60)}"`);
    if (EMAIL.test(line)) hits.push(`line ${i + 1}: email address`);
  });
  return hits;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Test reports go into a public package: drop logs and stack traces, and any local path. */
export function sanitizeJUnit(xml, rootDir = root) {
  let s = xml
    .replace(/<system-(out|err)\b[^>]*>[\s\S]*?<\/system-\1>/g, '')
    .replace(/<system-(out|err)\b[^>]*\/>/g, '')
    .replace(/\s(hostname|file|filepath)="[^"]*"/g, '')
    .replace(/<(failure|error)\b([^>]*?)(?:\/>|>[\s\S]*?<\/\1>)/g, (_, tag, attrs) => `<${tag}${attrs}/>`);
  for (const r of new Set([rootDir, toPosix(rootDir), rootDir.replace(/\//g, '\\')])) s = s.replace(new RegExp(escapeRe(r), 'gi'), '.');
  return s.replace(new RegExp(ABS_PATH.source, 'g'), (_, pre) => `${pre}[path]`);
}

// ---------- config ----------
const EVENT_TYPES = ['product-decision', 'approval', 'technical-correction', 'agent-failure', 'manual-implementation', 'task-start', 'task-end', 'interruption', 'resume', 'recovery-test', 'defect', 'verification', 'milestone'];
const INTERVENTIONS = ['product-decision', 'approval', 'technical-correction', 'agent-failure', 'manual-implementation'];
const CORRECTIVE = new Set(['technical-correction', 'agent-failure', 'manual-implementation']);
export const EVIDENCE_DEFAULTS = {
  dir: 'engineering-evidence',
  events: 'docs/evidence/events.jsonl',
  project: { id: null, name: null, repository: null },
  milestones: [{ id: 'mvp', label: 'MVP' }, { id: 'beta-0.5', label: 'Beta 0.5' }, { id: 'release-1.0', label: 'Version 1.0' }],
  testResults: ['reports/junit*.xml', 'test-results/junit*.xml'],
  testCommand: null,
  coverageSummary: 'coverage/coverage-summary.json',
  seededDefects: null,
  billingModel: 'unknown',
  usage: null,
  usageLog: 'docs/evidence/usage.jsonl',
  pricing: null,
  ci: { workflow: '.github/workflows/ci.yml', deployWorkflow: '.github/workflows/deploy.yml' },
  liveUrl: null,
  smokeMarker: null,
};
function loadConfig({ required = true } = {}) {
  const path = resolve(root, opt('config', 'quality-gate.json'));
  const qg = existsSync(path) ? readJson(path) : {};
  if (!qg.evidence && required) { console.error('evidence is not configured: run "node .claude/skills/milestone-evidence/scripts/evidence.mjs init" first'); process.exit(2); }
  const e = { ...EVIDENCE_DEFAULTS, ...(qg.evidence ?? {}) };
  e.ci = { ...EVIDENCE_DEFAULTS.ci, ...(qg.evidence?.ci ?? {}) };
  e.project = { ...EVIDENCE_DEFAULTS.project, ...(qg.evidence?.project ?? {}) };
  e.trace = { stories: 'docs/ba/user-stories.md', pattern: 'US-[A-Z0-9]+-\\d+', allowUntested: [], ...(qg.trace ?? {}) };
  e.configured = !!qg.evidence;
  e.repository = e.project.repository ?? repositoryUrl();
  e.project.id = e.project.id ?? slug(basename(root));
  e.project.name = e.project.name ?? basename(root);
  return e;
}
/** The origin remote as a public https URL, with any user name or token removed. */
function repositoryUrl() {
  const r = git('remote', 'get-url', 'origin');
  if (r.code !== 0 || !r.out) return null;
  let u = r.out.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
  u = u.replace(/^https?:\/\/[^@/]+@/, 'https://');
  return /^https:\/\//.test(u) ? u : null;
}

// ---------- event log ----------
export function readEvents(path) {
  if (!existsSync(path)) return { events: null, errors: [] };
  const schema = schemaFile('event');
  const events = [], errors = [];
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    let e;
    try { e = JSON.parse(line); } catch { errors.push(`line ${i + 1}: not JSON`); return; }
    const errs = validateSchema(schema, e);
    if (errs.length) errors.push(`line ${i + 1}: ${errs[0]}`);
    else events.push(e);
  });
  return { events, errors };
}
export function appendEvent(eventsPath, e) {
  const ev = { v: 1, at: new Date().toISOString(), ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) };
  const errs = validateSchema(schemaFile('event'), ev);
  if (errs.length) return { error: errs[0] };
  const leak = sensitiveHits(ev.summary);
  if (leak.length) return { error: `summary is not public-safe (${leak[0].replace(/^line \d+: /, '')}). Keep it short, no secrets, emails or local paths.` };
  mkdirSync(dirname(eventsPath), { recursive: true });
  appendFileSync(eventsPath, JSON.stringify(ev) + '\n');
  return { event: ev };
}

// ---------- token usage (Claude Code session logs → docs/evidence/usage.jsonl) ----------
// Claude Code writes every API response, with its token usage, to session logs under
// <config dir>/projects/<project path with non-alphanumerics as "-">/ (sub-agents in <session>/subagents/,
// their type in a .meta.json). It deletes old logs after a while, so the project keeps its own snapshot:
// per session, hour, model and agent, numbers only. A response appears on several lines while it streams;
// it is counted once (message id + request id).
const usageKey = (b) => `${b.session}|${b.hour}|${b.model}|${b.agent}`;
const USAGE_FIELDS = ['requests', 'inputTokens', 'outputTokens', 'cacheWriteTokens', 'cacheReadTokens'];
const transcriptsDir = () => resolve(opt('transcripts') ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects'));
/** The main checkout, so sessions run in its worktrees count for the same project. */
function projectRoot() {
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  if (common.code === 0 && basename(common.out) === '.git') return dirname(resolve(common.out));
  const top = git('rev-parse', '--show-toplevel');
  return top.code === 0 ? resolve(top.out) : root;
}
const insideDir = (p, dir) => {
  const norm = (x) => (process.platform === 'win32' ? resolve(x).toLowerCase() : resolve(x));
  return norm(p) === norm(dir) || norm(p).startsWith(norm(dir) + sep);
};
export function readTranscripts(dir, projectDir) {
  const prefix = projectDir.replace(/[^a-zA-Z0-9]/g, '-');
  if (!existsSync(dir)) return { buckets: new Map(), files: 0 };
  const files = readdirSync(dir).filter((n) => n === prefix || n.startsWith(`${prefix}-`)).flatMap((n) => walk(join(dir, n))).filter((f) => f.endsWith('.jsonl'));
  const responses = new Map();
  for (const f of files) {
    let agent = 'main';
    if (/[\\/]subagents[\\/]/.test(f)) {
      try { agent = slug(readJson(f.replace(/\.jsonl$/, '.meta.json')).agentType ?? 'subagent'); } catch { agent = 'subagent'; }
    }
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!line.includes('"usage"')) continue;
      let o;
      try { o = JSON.parse(line); } catch { continue; }
      const u = o.message?.usage;
      // Other projects whose folder names share the prefix are excluded by their working directory.
      if (o.type !== 'assistant' || !u || !o.timestamp || !o.cwd || !o.message.model || o.message.model.startsWith('<') || !insideDir(o.cwd, projectDir)) continue;
      const key = `${o.message.id}|${o.requestId}`;
      const prev = responses.get(key);
      if (!prev || (u.output_tokens ?? 0) >= (prev.u.output_tokens ?? 0)) responses.set(key, { u, o, agent });
    }
  }
  const buckets = new Map();
  for (const { u, o, agent } of responses.values()) {
    const b = { session: sha256(String(o.sessionId ?? 'unknown')).slice(0, 12), hour: new Date(o.timestamp).toISOString().slice(0, 13), model: o.message.model, agent };
    const t = buckets.get(usageKey(b)) ?? { ...b, requests: 0, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
    t.requests += 1;
    t.inputTokens += u.input_tokens ?? 0;
    t.outputTokens += u.output_tokens ?? 0;
    t.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
    t.cacheReadTokens += u.cache_read_input_tokens ?? 0;
    buckets.set(usageKey(b), t);
  }
  return { buckets, files: files.length };
}
/** Latest record per bucket (each snapshot appends the bucket's running total). */
export function readUsageLog(path) {
  const entries = new Map(), errors = [];
  if (!existsSync(path)) return { entries, errors, exists: false };
  const schema = schemaFile('usage');
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    let u;
    try { u = JSON.parse(line); } catch { errors.push(`line ${i + 1}: not JSON`); return; }
    const errs = validateSchema(schema, u);
    if (errs.length) { errors.push(`line ${i + 1}: ${errs[0]}`); return; }
    const k = usageKey(u);
    if (!entries.has(k) || entries.get(k).at <= u.at) entries.set(k, u);
  });
  return { entries, errors, exists: true };
}
function usageSnapshot(e, { quiet = false } = {}) {
  const logPath = join(root, e.usageLog);
  const { entries, errors } = readUsageLog(logPath);
  if (errors.length) { if (!quiet) bad(`the usage log ${e.usageLog} has invalid lines: ${errors[0]}`); return { error: errors[0] }; }
  const { buckets, files } = readTranscripts(transcriptsDir(), projectRoot());
  const at = new Date().toISOString();
  const lines = [];
  for (const [k, b] of buckets) {
    const old = entries.get(k);
    // Never go backwards: Claude Code deletes old session logs, and the snapshot is then the only record.
    if (old && USAGE_FIELDS.every((f) => b[f] <= old[f])) continue;
    lines.push(JSON.stringify({ v: 1, at, ...b }));
  }
  if (lines.length) { mkdirSync(dirname(logPath), { recursive: true }); appendFileSync(logPath, lines.join('\n') + '\n'); }
  if (!quiet) ok(`token usage: ${lines.length} new or grown records from ${files} session logs appended to ${e.usageLog}`);
  else if (lines.length) console.log(`Token usage: ${lines.length} records added to ${e.usageLog} (commit it with your work).`);
  return { added: lines.length, files };
}

// ---------- evidence readers ----------
export function parseJUnit(xml) {
  const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
  const cases = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((a) => [a[1], decode(a[2] ?? a[3])]));
    const body = m[2] ?? '';
    const status = /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
    cases.push({ name: attrs.name ?? '', classname: attrs.classname ?? '', status });
  }
  return cases;
}

/** Criteria = acceptance criteria where a story lists AC IDs ("Scenario: AC1 …" or "US-E1-01/AC1"), the story itself where it doesn't. */
export function storyCriteria(text, pattern) {
  const storyRe = new RegExp(pattern, 'g');
  const stories = [...new Set(text.match(storyRe) ?? [])];
  const acs = new Map(stories.map((s) => [s, new Set()]));
  let current = null;
  for (const line of text.split('\n')) {
    const heading = /^#{1,6}\s/.test(line) ? line.match(new RegExp(pattern)) : null;
    if (heading) { current = heading[0]; continue; }
    if (/^#{1,6}\s/.test(line)) { current = null; continue; }
    for (const m of line.matchAll(new RegExp(`(${pattern})/AC(\\d+)\\b`, 'g'))) acs.get(m[1])?.add(Number(m[2]));
    if (current) for (const m of line.replace(new RegExp(`(${pattern})/AC\\d+`, 'g'), '').matchAll(/\bAC(\d+)\b/g)) acs.get(current)?.add(Number(m[1]));
  }
  const criteria = [];
  for (const s of stories) {
    const list = [...acs.get(s)].sort((a, b) => a - b);
    if (list.length) list.forEach((n) => criteria.push({ id: `${s}/AC${n}`, story: s }));
    else criteria.push({ id: s, story: s });
  }
  const withAcs = stories.filter((s) => acs.get(s).size).length;
  return { criteria, stories, denominator: withAcs === 0 ? 'stories' : withAcs === stories.length ? 'acceptance-criteria' : 'mixed', storiesWithoutAcs: stories.length - withAcs };
}
const mentions = (text, id) => new RegExp(`(?<![A-Za-z0-9-])${escapeRe(id)}(?![0-9])`).test(text);

function gitInfo(e) {
  const head = git('rev-parse', 'HEAD');
  if (head.code !== 0) { console.error('collect needs a git repository with at least one commit'); process.exit(2); }
  const ignore = [e.dir, e.events, e.usageLog, '.claude/state', '.claude/.upgrade-backup'].filter(Boolean).map((p) => p.replace(/\/$/, ''));
  const dirty = git('status', '--porcelain', '--untracked-files=all').out.split('\n').filter(Boolean)
    .map((l) => l.replace(/^.{1,2}?\s/, '').replace(/^"|"$/g, '')).filter((f) => !ignore.some((p) => f === p || f.startsWith(`${p}/`)));
  return {
    commit: head.out,
    committedAt: git('log', '-1', '--format=%cI', 'HEAD').out,
    ref: git('tag', '--points-at', 'HEAD').out.split('\n').filter(Boolean)[0] ?? null,
    dirty,
    shallow: git('rev-parse', '--is-shallow-repository').out === 'true',
  };
}

// ---------- measurement helpers ----------
const measured = (value, unit, method, sources) => ({ value, unit, basis: 'measured', method, sources });
const recorded = (value, unit, method) => ({ value, unit, basis: 'recorded', method, sources: ['events'] });
const unavailable = (unit, method, reason) => ({ value: null, unit, basis: 'unavailable', method, reason });
const notApplicable = (unit, method, reason) => ({ value: null, unit, basis: 'not_applicable', method, reason });
const isMeasurement = (v) => v && typeof v === 'object' && 'basis' in v && 'unit' in v;
function measurements(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (isMeasurement(v)) out.push([`${prefix}.${k}`, v]);
    else if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...measurements(v, `${prefix}.${k}`));
  }
  return out;
}
const worst = (...verdicts) => (verdicts.includes('FAIL') ? 'FAIL' : verdicts.includes('UNVERIFIED') ? 'UNVERIFIED' : verdicts.every((v) => v === 'NOT_APPLICABLE') ? 'NOT_APPLICABLE' : 'PASS');

// ---------- index and package files ----------
const evidenceDir = (e) => join(root, e.dir);
const indexPath = (e) => join(evidenceDir(e), 'index.json');
const loadIndex = (e) => (existsSync(indexPath(e)) ? readJson(indexPath(e)) : null);
/** Every file of a package with its sha256, and one hash over the sorted list. */
export function packageFiles(dir) {
  const files = Object.fromEntries(walk(dir).map((f) => [toPosix(relative(dir, f)), sha256(readFileSync(f))]).sort(([a], [b]) => (a < b ? -1 : 1)));
  const tree = sha256(Object.entries(files).map(([p, h]) => `${p} ${h}`).join('\n') + '\n');
  return { files, tree };
}
function copySchemas(e) {
  const out = join(evidenceDir(e), 'schema', 'v1');
  for (const n of ['metrics', 'index', 'event', 'usage']) {
    const src = join(SCHEMA_DIR, `${n}.schema.json`), dest = join(out, `${n}.schema.json`);
    if (!existsSync(dest) || sha256(readFileSync(dest)) !== sha256(readFileSync(src))) { mkdirSync(out, { recursive: true }); copyFileSync(src, dest); }
  }
}

// ---------- collect ----------
async function collect() {
  const e = loadConfig();
  const milestoneId = opt('milestone');
  const milestone = e.milestones.find((m) => m.id === milestoneId);
  if (!milestone) { console.error(`--milestone must be one of the milestones configured in quality-gate.json → evidence.milestones: ${e.milestones.map((m) => m.id).join(', ')}`); return 2; }
  // Package id and revision. A frozen package is never overwritten.
  const index = loadIndex(e) ?? { packages: [] };
  const frozenOf = index.packages.filter((p) => p.milestoneId === milestone.id).sort((a, b) => a.revision - b.revision);
  let revision = 1, supersedes = null;
  const reviseReason = opt('reason');
  if (flag('revise')) {
    if (!frozenOf.length) { console.error(`--revise: milestone "${milestone.id}" has no frozen package yet; collect it without --revise`); return 2; }
    if (!reviseReason || reviseReason.length < 10) { console.error('--revise needs --reason "<why the frozen package is being superseded>" (≥ 10 characters)'); return 2; }
    revision = frozenOf.at(-1).revision + 1;
    supersedes = frozenOf.at(-1).id;
  } else if (frozenOf.length) {
    console.error(`milestone "${milestone.id}" already has a frozen package (${frozenOf.map((p) => p.id).join(', ')}). It is never overwritten; to publish a corrected snapshot run: collect --milestone ${milestone.id} --revise --reason "…"`);
    return 1;
  }
  const packageId = revision === 1 ? milestone.id : `${milestone.id}-r${revision}`;
  const pkg = join(evidenceDir(e), packageId);
  if (index.packages.some((p) => p.id === packageId)) { console.error(`package ${packageId} is frozen`); return 1; }
  const g = gitInfo(e);
  if (g.dirty.length && !flag('allow-dirty')) {
    console.error(`the working tree has uncommitted changes, so no single commit describes what is measured:\n  ${g.dirty.slice(0, 10).join('\n  ')}\nCommit them first (or pass --allow-dirty; the package then records it as a limitation).`);
    return 1;
  }
  if (existsSync(pkg)) { rmSync(pkg, { recursive: true, force: true }); info(`replaced the unfrozen draft ${e.dir}/${packageId}`); }
  mkdirSync(join(pkg, 'evidence'), { recursive: true });

  const collectedAt = new Date().toISOString();
  const evidence = [];
  const limitations = [];
  const addFile = (id, kind, description, rel, content) => {
    writeFileSync(join(pkg, rel), content);
    evidence.push({ id, kind, description, path: rel, sha256: sha256(readFileSync(join(pkg, rel))) });
  };
  addFile('git', 'git', 'The measured commit as git reported it', 'evidence/git.json', JSON.stringify({ commit: g.commit, committedAt: g.committedAt, ref: g.ref, uncommittedFiles: g.dirty.length }, null, 2) + '\n');
  if (g.dirty.length) limitations.push(`Collected with ${g.dirty.length} uncommitted file(s) in the working tree, so the measured state is not exactly commit ${g.commit.slice(0, 7)}.`);

  // Window: since the latest frozen package of an earlier milestone.
  const earlier = index.packages.filter((p) => p.milestoneId !== milestone.id && !p.supersededBy).sort((a, b) => (a.collectedAt < b.collectedAt ? -1 : 1)).at(-1) ?? null;
  const from = earlier?.collectedAt ?? null;
  const inWindow = (ev) => (!from || ev.at > from) && ev.at <= collectedAt;

  // --- tests
  if (flag('run-tests')) {
    if (!e.testCommand) { console.error('--run-tests needs quality-gate.json → evidence.testCommand (a command that writes JUnit XML)'); return 2; }
    info(`running ${e.testCommand}`);
    const r = spawnSync(e.testCommand, { cwd: root, shell: true, stdio: 'inherit' });
    info(`test command exited ${r.status} (failures are read from the JUnit report)`);
  }
  const junitFiles = walk(root).map((f) => toPosix(relative(root, f))).filter((f) => !f.startsWith('node_modules/') && !f.startsWith('.git/') && !f.startsWith(`${e.dir}/`) && e.testResults.some((gl) => globToRegExp(gl).test(f))).sort();
  const commitTime = Date.parse(g.committedAt);
  const stale = junitFiles.filter((f) => statSync(join(root, f)).mtimeMs < commitTime);
  let cases = [];
  junitFiles.forEach((f, i) => {
    const xml = readFileSync(join(root, f), 'utf8');
    cases.push(...parseJUnit(xml));
    addFile(i ? `junit-${i + 1}` : 'junit', 'test-results', `JUnit test results (${f}), logs and stack traces removed`, `evidence/junit-${i + 1}.xml`, sanitizeJUnit(xml));
  });
  const junitIds = evidence.filter((x) => x.kind === 'test-results').map((x) => x.id);
  const testsUsable = junitFiles.length > 0 && !stale.length;
  const noTests = !junitFiles.length ? `no JUnit results match ${e.testResults.join(', ')}` : stale.length ? `test results are older than the measured commit (${stale.join(', ')}); rerun the tests or pass --run-tests` : null;
  if (noTests) limitations.push(`Tests: ${noTests}.`);

  // --- stories and criteria
  const storiesPath = join(root, e.trace.stories);
  const storiesText = existsSync(storiesPath) ? readFileSync(storiesPath, 'utf8') : '';
  if (storiesText) addFile('stories', 'stories', `User stories and acceptance criteria (${e.trace.stories})`, 'evidence/stories.md', storiesText);
  const sc = storyCriteria(storiesText, e.trace.pattern);
  const criteria = sc.criteria.map((c) => {
    const hit = cases.filter((t) => mentions(`${t.classname} ${t.name}`, c.id));
    const passed = hit.filter((t) => t.status === 'passed').length, failed = hit.filter((t) => t.status === 'failed').length;
    const deferred = e.trace.allowUntested.includes(c.story) && !passed && !failed;
    const status = !testsUsable ? 'UNVERIFIED' : deferred ? 'DEFERRED' : failed ? 'FAIL' : passed ? 'PASS' : 'UNVERIFIED';
    return { id: c.id, status, passed: testsUsable ? passed : 0, failed: testsUsable ? failed : 0 };
  });
  const countOf = (s) => criteria.filter((c) => c.status === s).length;
  const fSrc = ['stories', ...junitIds];
  const critMethod = (what) => `criteria (${sc.denominator}) from ${e.trace.stories} ${what}; a criterion passes only when ≥1 executed JUnit test names its ID and none fails`;
  const fcount = (v, what) => (testsUsable && storiesText ? measured(v, 'count', critMethod(what), fSrc) : unavailable('count', critMethod(what), noTests ?? `no stories file at ${e.trace.stories}`));
  const criteriaTests = cases.filter((t) => sc.criteria.some((c) => mentions(`${t.classname} ${t.name}`, c.id)));
  const functional = {
    status: 'UNVERIFIED',
    denominator: sc.denominator,
    criteriaTotal: storiesText ? measured(criteria.length, 'count', `distinct criteria in ${e.trace.stories}`, ['stories']) : unavailable('count', 'criteria in the stories file', `no stories file at ${e.trace.stories}`),
    criteriaPassing: fcount(countOf('PASS'), 'with status PASS'),
    criteriaFailing: fcount(countOf('FAIL'), 'with ≥1 failing test'),
    criteriaUnverified: fcount(countOf('UNVERIFIED'), 'with no executed test'),
    criteriaDeferred: fcount(countOf('DEFERRED'), 'deferred in quality-gate.json → trace.allowUntested'),
    testsPassed: testsUsable ? measured(criteriaTests.filter((t) => t.status === 'passed').length, 'count', 'JUnit test cases naming ≥1 criterion that passed', junitIds) : unavailable('count', 'JUnit test cases naming a criterion', noTests),
    testsFailed: testsUsable ? measured(criteriaTests.filter((t) => t.status === 'failed').length, 'count', 'JUnit test cases naming ≥1 criterion that failed', junitIds) : unavailable('count', 'JUnit test cases naming a criterion', noTests),
    completionPercent: testsUsable && criteria.length ? measured(round1((countOf('PASS') / criteria.length) * 100), 'percent', 'criteriaPassing / criteriaTotal × 100 (deferred and unverified criteria count as not complete)', fSrc) : unavailable('percent', 'criteriaPassing / criteriaTotal × 100', noTests ?? 'no criteria found'),
    criteria,
  };
  functional.status = !testsUsable || !criteria.length ? 'UNVERIFIED' : countOf('FAIL') ? 'FAIL' : countOf('UNVERIFIED') ? 'UNVERIFIED' : 'PASS';
  if (sc.denominator !== 'acceptance-criteria' && criteria.length) limitations.push(`${sc.storiesWithoutAcs} of ${sc.stories.length} stories have no AC IDs, so they are counted as one criterion each.`);
  const storyOnly = sc.criteria.filter((c) => c.id !== c.story && criteria.find((x) => x.id === c.id).status === 'UNVERIFIED' && cases.some((t) => mentions(`${t.classname} ${t.name}`, c.story) && !/\/AC\d/.test(t.name)));
  if (storyOnly.length && testsUsable) limitations.push(`${storyOnly.length} acceptance criteria have tests that name only their story, not the AC ID; they stay unverified until a test names the AC.`);

  // --- event log
  const eventsPath = join(root, e.events);
  const { events, errors: eventErrors } = readEvents(eventsPath);
  if (eventErrors.length) { console.error(`the event log ${e.events} has invalid lines:\n  ${eventErrors.slice(0, 10).join('\n  ')}`); return 1; }
  const win = (events ?? []).filter(inWindow);
  const defectEvents = (events ?? []).filter((ev) => ev.type === 'defect' && ev.at <= collectedAt);
  if (events) addFile('events', 'event-log', `Event log entries in this window, plus every defect event up to collection (${e.events})`, 'evidence/events.jsonl', [...new Set([...win, ...defectEvents])].sort((a, b) => (a.at < b.at ? -1 : 1)).map((ev) => JSON.stringify(ev)).join('\n') + (win.length || defectEvents.length ? '\n' : ''));
  const noLog = `no event log at ${e.events}`;
  const rec = (v, unit, method) => (events ? recorded(v, unit, method) : unavailable(unit, method, noLog));
  if (events) limitations.push('Intervention, defect and recovery counts come from the project event log and are only as complete as that log.');
  else limitations.push(`No event log (${e.events}): interventions, defects and recovery are unavailable.`);

  // --- intervention
  const iv = win.filter((ev) => INTERVENTIONS.includes(ev.type));
  const tasks = [...new Set(win.filter((ev) => ev.type === 'task-start').map((ev) => ev.task))];
  const correctedTasks = new Set(iv.filter((ev) => CORRECTIVE.has(ev.type) && ev.task).map((ev) => ev.task));
  const cleanTasks = tasks.filter((t) => win.filter((ev) => ev.type === 'task-end' && ev.task === t).at(-1)?.outcome === 'success' && !correctedTasks.has(t));
  const intervention = {
    status: events ? 'PASS' : 'UNVERIFIED',
    total: rec(iv.length, 'count', 'intervention events in the window'),
    corrective: rec(iv.filter((ev) => CORRECTIVE.has(ev.type)).length, 'count', 'technical-correction + agent-failure + manual-implementation events'),
    byType: Object.fromEntries(INTERVENTIONS.map((t) => [t, rec(iv.filter((ev) => ev.type === t).length, 'count', `"${t}" events in the window`)])),
    agentTasks: rec(tasks.length, 'count', 'distinct tasks with a task-start event (validate.mjs task-start)'),
    agentTasksWithoutCorrection: rec(cleanTasks.length, 'count', 'tasks whose last task-end succeeded (diff-guard) and that no corrective event names'),
    items: iv.map((ev) => ({ at: ev.at, type: ev.type, corrective: CORRECTIVE.has(ev.type), ...(ev.task ? { task: ev.task } : {}), ...(ev.milestone ? { milestone: ev.milestone } : {}), summary: ev.summary })),
  };

  // --- QA
  const run = cases.filter((t) => t.status !== 'skipped');
  const tcount = (v, method) => (testsUsable ? measured(v, 'count', method, junitIds) : unavailable('count', method, noTests));
  const defects = new Map();
  for (const ev of defectEvents) defects.set(ev.defect, { severity: ev.severity, state: ev.state });
  const dlist = [...defects.values()];
  const drec = (v, method) => rec(v, 'count', `${method} (cumulative to collection; latest state per defect ID)`);
  // Regressions: tests that passed in the previous milestone's package and fail now.
  let regression = notApplicable('count', 'tests passing in the previous milestone package and failing now', 'no earlier frozen milestone package to compare with');
  if (earlier && testsUsable) {
    const prevDir = join(evidenceDir(e), earlier.path, 'evidence');
    const prev = walk(prevDir).filter((f) => /junit-\d+\.xml$/.test(f)).flatMap((f) => parseJUnit(readFileSync(f, 'utf8')));
    const key = (t) => `${t.classname}|${t.name}`;
    const prevPassed = new Set(prev.filter((t) => t.status === 'passed').map(key));
    // Cited by URL: a package path may not leave its own directory.
    if (!e.repository) regression = unavailable('count', 'tests passing in the previous package and failing now', 'no repository URL to cite the previous package');
    else {
      evidence.push({ id: 'previous', kind: 'previous-package', description: `Previous milestone package ${earlier.id} (frozen, tree sha256 ${earlier.sha256})`, url: `${e.repository}/tree/${g.commit}/${e.dir}/${earlier.path}` });
      regression = measured(cases.filter((t) => t.status === 'failed' && prevPassed.has(key(t))).length, 'count', `tests that passed in ${earlier.id} and fail now (same classname and name)`, [...junitIds, 'previous']);
    }
  } else if (earlier) regression = unavailable('count', 'tests passing in the previous package and failing now', noTests);
  const covPath = join(root, e.coverageSummary ?? '');
  let codeCoverage = unavailable('percent', `line coverage from ${e.coverageSummary}`, `no coverage summary at ${e.coverageSummary}`);
  if (e.coverageSummary && existsSync(covPath)) {
    if (statSync(covPath).mtimeMs < commitTime) codeCoverage = unavailable('percent', `line coverage from ${e.coverageSummary}`, 'coverage summary is older than the measured commit');
    else {
      const total = readJson(covPath).total;
      addFile('coverage', 'coverage', `Coverage totals (${e.coverageSummary}; per-file entries removed)`, 'evidence/coverage-summary.json', JSON.stringify({ total }, null, 2) + '\n');
      codeCoverage = measured(round1(total.lines.pct), 'percent', 'total.lines.pct from the coverage summary (which code ran, not whether it is correct)', ['coverage']);
    }
  }
  let detection = notApplicable('percent', 'seeded defects detected / seeded defects × 100', 'no seeded-defect baseline (quality-gate.json → evidence.seededDefects); without one, detection effectiveness cannot be measured');
  if (e.seededDefects && existsSync(join(root, e.seededDefects))) {
    const seeded = readJson(join(root, e.seededDefects));
    addFile('seeded', 'test-results', `Seeded-defect results (${e.seededDefects})`, 'evidence/seeded-defects.json', JSON.stringify(seeded, null, 2) + '\n');
    detection = seeded.length ? measured(round1((seeded.filter((s) => s.detected === true).length / seeded.length) * 100), 'percent', 'seeded defects with detected = true / seeded defects × 100', ['seeded']) : unavailable('percent', 'seeded defects detected / seeded', 'the seeded-defect file is empty');
  }
  const verifications = win.filter((ev) => ev.type === 'verification');
  const qa = {
    status: 'UNVERIFIED',
    testsExecuted: tcount(run.length, 'JUnit test cases not skipped'),
    testsPassed: tcount(cases.filter((t) => t.status === 'passed').length, 'JUnit test cases without failure, error or skipped'),
    testsFailed: tcount(cases.filter((t) => t.status === 'failed').length, 'JUnit test cases with a failure or error'),
    testsSkipped: tcount(cases.filter((t) => t.status === 'skipped').length, 'JUnit test cases marked skipped'),
    defectsFound: drec(dlist.length, 'distinct defect IDs'),
    defectsBySeverity: Object.fromEntries(['P1', 'P2', 'P3', 'P4'].map((s) => [s, drec(dlist.filter((d) => d.severity === s).length, `distinct ${s} defect IDs`)])),
    defectsFixed: drec(dlist.filter((d) => d.state === 'fixed').length, 'defects whose latest state is fixed'),
    defectsDeferred: drec(dlist.filter((d) => d.state === 'deferred').length, 'defects whose latest state is deferred'),
    defectsOpen: drec(dlist.filter((d) => d.state === 'found').length, 'defects whose latest state is found'),
    regressionFailures: regression,
    verificationsPassed: rec(verifications.filter((v) => v.outcome === 'success').length, 'count', 'verification events with outcome success in the window'),
    verificationsFailed: rec(verifications.filter((v) => v.outcome === 'failure').length, 'count', 'verification events with outcome failure in the window'),
    requirementCoveragePercent: testsUsable && criteria.length ? measured(round1((criteria.filter((c) => c.passed + c.failed > 0).length / criteria.length) * 100), 'percent', 'criteria with ≥1 executed test / criteriaTotal × 100 (requirement coverage, not code coverage)', fSrc) : unavailable('percent', 'criteria with ≥1 executed test / criteriaTotal × 100', noTests ?? 'no criteria found'),
    codeCoveragePercent: codeCoverage,
    detectionEffectiveness: detection,
  };
  const openSevere = dlist.filter((d) => d.state === 'found' && (d.severity === 'P1' || d.severity === 'P2')).length;
  qa.status = !testsUsable ? 'UNVERIFIED' : qa.testsFailed.value || openSevere || (regression.basis === 'measured' && regression.value) ? 'FAIL' : events ? 'PASS' : 'UNVERIFIED';
  if (qa.codeCoveragePercent.basis === 'measured') limitations.push('Code coverage shows which lines ran during tests; it is not evidence that the code has no defects.');

  // --- cost
  // An explicit usage file wins; otherwise the project's token-usage log (snapshotted from Claude Code
  // session logs at every session start and again here) covers the window.
  const usagePath = opt('usage') ?? e.usage;
  let usage = null, usageFromLog = false;
  if (usagePath) {
    if (!existsSync(resolve(root, usagePath))) { console.error(`usage file ${usagePath} not found`); return 2; }
    usage = readJson(resolve(root, usagePath));
    const leak = sensitiveHits(JSON.stringify(usage, null, 1));
    if (leak.length) { console.error(`usage file ${usagePath} is not public-safe: ${leak[0]}`); return 1; }
    addFile('usage', 'usage', `Model and infrastructure usage supplied for this milestone${usage.source ? ` (${usage.source})` : ''}`, 'evidence/usage.json', JSON.stringify(usage, null, 2) + '\n');
  } else if (e.usageLog) {
    if (!flag('no-usage-snapshot')) usageSnapshot(e, { quiet: true });
    const { entries: logged, errors: usageErrors } = readUsageLog(join(root, e.usageLog));
    if (usageErrors.length) { console.error(`the usage log ${e.usageLog} has invalid lines:\n  ${usageErrors.slice(0, 10).join('\n  ')}`); return 1; }
    const fromHour = from ? Date.parse(`${from.slice(0, 13)}:00:00Z`) : -Infinity;
    const buckets = [...logged.values()].filter((b) => { const h = Date.parse(`${b.hour}:00:00Z`); return h > fromHour && h <= Date.parse(collectedAt); });
    if (buckets.length) {
      usageFromLog = true;
      const byModel = new Map();
      for (const b of buckets) {
        const k = `${b.model}|${b.agent}`;
        const t = byModel.get(k) ?? { category: 'model', name: b.model, phase: b.agent, requests: 0, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
        for (const f of ['requests', 'inputTokens', 'outputTokens', 'cacheWriteTokens', 'cacheReadTokens']) t[f] += b[f];
        byModel.set(k, t);
      }
      const entries = [...byModel.values()].sort((a, b) => (a.name + a.phase < b.name + b.phase ? -1 : 1)).map((t) => {
        const p = e.pricing?.[t.name];
        const costUsd = p ? Math.round(((t.inputTokens * p.inputPerMTok + t.outputTokens * p.outputPerMTok + t.cacheWriteTokens * (p.cacheWritePerMTok ?? 0) + t.cacheReadTokens * (p.cacheReadPerMTok ?? 0)) / 1e6) * 10000) / 10000 : null;
        return { ...t, costUsd, basis: 'measured', ...(p ? { costBasis: 'estimated' } : {}) };
      });
      usage = { billingModel: e.billingModel ?? 'unknown', source: 'Claude Code session logs, snapshotted by evidence.mjs usage', entries };
      addFile('usage', 'usage', `Token usage per model and agent from the project usage log (${e.usageLog}), hour buckets in this window${e.pricing ? ', with the configured list prices' : ''}`, 'evidence/usage.json', JSON.stringify({ source: usage.source, pricing: e.pricing ?? null, buckets: buckets.map(({ at, v, ...b }) => b) }, null, 2) + '\n');
      limitations.push('Token usage comes from Claude Code session logs snapshotted on the machines that ran this project (hour buckets; the boundary hour belongs to the earlier milestone). Sessions on other machines or in the cloud are missing unless they were snapshotted there.');
    }
  }
  const billingModel = usage?.billingModel ?? e.billingModel ?? 'unknown';
  const items = (usage?.entries ?? []).map((x) => ({
    category: x.category ?? 'model', name: x.name, ...(x.phase ? { phase: x.phase } : {}), ...(x.requests !== undefined ? { requests: x.requests } : {}),
    inputTokens: x.inputTokens ?? null, outputTokens: x.outputTokens ?? null,
    ...(x.cacheWriteTokens !== undefined ? { cacheWriteTokens: x.cacheWriteTokens, cacheReadTokens: x.cacheReadTokens ?? 0 } : {}),
    costUsd: x.costUsd ?? null, basis: x.basis === 'measured' ? 'measured' : 'estimated', ...(x.costBasis ? { costBasis: x.costBasis } : {}),
  }));
  const models = items.filter((x) => x.category === 'model'), infra = items.filter((x) => x.category === 'infrastructure');
  const basisOf = (list) => (list.every((x) => x.basis === 'measured') ? 'measured' : 'estimated');
  const costBasisOf = (list) => (list.every((x) => (x.costBasis ?? x.basis) === 'measured') ? 'measured' : 'estimated');
  const sum = (list, f) => list.reduce((s, x) => s + (x[f] ?? 0), 0);
  const noUsage = billingModel === 'subscription'
    ? 'usage ran on a subscription plan with no per-run billing data; this is not zero-cost execution'
    : 'no usage export supplied (evidence.mjs collect --usage <file>)';
  const withTokens = models.filter((x) => x.inputTokens !== null || x.outputTokens !== null);
  const withCost = models.filter((x) => x.costUsd !== null);
  const unpriced = [...new Set(models.filter((x) => x.costUsd === null).map((x) => x.name))];
  const noTokens = usageFromLog || usage || !e.usageLog ? noUsage
    : `no token usage in ${e.usageLog} for this window (snapshots run at session start and on collect)${billingModel === 'subscription' ? '; the subscription is not zero-cost execution' : ''}`;
  const noCost = usageFromLog && unpriced.length
    ? `no list price configured for ${unpriced.join(', ')} (quality-gate.json → evidence.pricing)${billingModel === 'subscription' ? '; the subscription itself is billed separately and this is not zero-cost execution' : ''}`
    : noTokens;
  const withCache = models.filter((x) => x.cacheWriteTokens !== undefined);
  const cost = {
    status: 'UNVERIFIED',
    billingModel,
    totalTokens: withTokens.length ? { value: sum(withTokens, 'inputTokens') + sum(withTokens, 'outputTokens'), unit: 'tokens', basis: basisOf(withTokens), method: 'sum of input + output tokens over model usage entries (cache tokens are reported separately)', sources: ['usage'] } : unavailable('tokens', 'sum of input + output tokens', noTokens),
    ...(withCache.length ? { cacheTokens: { value: sum(withCache, 'cacheWriteTokens') + sum(withCache, 'cacheReadTokens'), unit: 'tokens', basis: basisOf(withCache), method: 'sum of cache-write + cache-read input tokens over model usage entries', sources: ['usage'] } } : {}),
    apiCostUsd: withCost.length && !(usageFromLog && unpriced.length)
      ? { value: round1(sum(withCost, 'costUsd') * 100) / 100, unit: 'usd', basis: costBasisOf(withCost), method: usageFromLog ? `tokens × list prices in quality-gate.json → evidence.pricing${billingModel === 'subscription' ? ' (API-equivalent: the subscription is billed separately)' : ''}` : 'sum of costUsd over model usage entries', sources: ['usage'] }
      : unavailable('usd', 'sum of model costUsd', noCost),
    infrastructureCostUsd: infra.some((x) => x.costUsd !== null) ? { value: round1(sum(infra, 'costUsd') * 100) / 100, unit: 'usd', basis: basisOf(infra), method: 'sum of costUsd over infrastructure entries', sources: ['usage'] } : unavailable('usd', 'sum of infrastructure costUsd', usage && !usageFromLog ? 'the usage file lists no infrastructure costs' : usageFromLog ? 'the usage log covers model tokens only; supply infrastructure costs with --usage' : noUsage),
    items,
  };
  cost.status = cost.totalTokens.value !== null && cost.apiCostUsd.value !== null ? 'PASS' : 'UNVERIFIED';
  if (cost.status !== 'PASS') limitations.push(`Development cost is incomplete: ${cost.totalTokens.reason ?? cost.apiCostUsd.reason}.`);
  if (cost.apiCostUsd.basis === 'estimated' && usageFromLog) limitations.push(`API cost is an estimate: measured tokens × configured list prices${billingModel === 'subscription' ? ', i.e. what the same use would cost on the API; the subscription is billed separately' : ''}.`);

  // --- recovery
  const interruptions = win.filter((ev) => ev.type === 'interruption'), resumes = win.filter((ev) => ev.type === 'resume'), rtests = win.filter((ev) => ev.type === 'recovery-test');
  const minutes = [...interruptions, ...resumes].filter((ev) => typeof ev.minutes === 'number');
  const recovery = {
    status: 'UNVERIFIED',
    interruptions: rec(interruptions.length, 'count', 'interruption events in the window'),
    recoveryAttempts: rec(resumes.length, 'count', 'resume events in the window'),
    resumptionsSucceeded: rec(resumes.filter((r) => r.outcome === 'success').length, 'count', 'resume events with outcome success'),
    resumptionsFailed: rec(resumes.filter((r) => r.outcome === 'failure').length, 'count', 'resume events with outcome failure'),
    reworkMinutes: !events ? unavailable('minutes', 'sum of minutes on interruption/resume events', noLog)
      : !interruptions.length && !resumes.length ? recorded(0, 'minutes', 'no interruption or resume events in the window')
        : minutes.length ? recorded(minutes.reduce((s, ev) => s + ev.minutes, 0), 'minutes', 'sum of minutes on interruption/resume events that recorded them')
          : unavailable('minutes', 'sum of minutes on interruption/resume events', 'interruptions were logged without minutes of rework'),
    recoveryTestsPassed: rec(rtests.filter((r) => r.outcome === 'success').length, 'count', 'controlled recovery tests (fresh session restored state from CATCH-UP.md) that succeeded'),
    recoveryTestsFailed: rec(rtests.filter((r) => r.outcome === 'failure').length, 'count', 'controlled recovery tests that failed'),
  };
  recovery.status = !events ? 'UNVERIFIED' : rtests.some((r) => r.outcome === 'failure') ? 'FAIL' : rtests.some((r) => r.outcome === 'success') ? 'PASS' : 'UNVERIFIED';
  if (recovery.status === 'UNVERIFIED' && events) limitations.push('No controlled recovery test in this window: the absence of recorded failures is not evidence that work can be resumed reliably.');

  // --- delivery
  const gh = e.repository?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  let runs = null, runsWhy = null;
  if (opt('ci-runs')) runs = readJson(resolve(root, opt('ci-runs')));
  else if (flag('offline')) runsWhy = 'collected with --offline';
  else if (!gh) runsWhy = 'the repository is not a GitHub URL, so CI runs could not be looked up';
  else {
    const path = `repos/${gh[1]}/${gh[2]}/actions/runs?head_sha=${g.commit}&per_page=100`;
    const viaGh = spawnSync('gh', ['api', path], { cwd: root, encoding: 'utf8' });
    if (viaGh.status === 0) runs = JSON.parse(viaGh.stdout).workflow_runs;
    else {
      try {
        const res = await fetch(`https://api.github.com/${path}`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } });
        if (res.ok) runs = (await res.json()).workflow_runs; else runsWhy = `GitHub API answered ${res.status}`;
      } catch (err) { runsWhy = `GitHub API unreachable (${err.cause?.code ?? err.message})`; }
    }
  }
  if (runs) {
    runs = runs.map((r) => ({ id: r.id, name: r.name, path: r.path, event: r.event, status: r.status, conclusion: r.conclusion, head_sha: r.head_sha, created_at: r.created_at, html_url: r.html_url }));
    addFile('ci-runs', 'ci-runs', `GitHub Actions runs for commit ${g.commit.slice(0, 7)}`, 'evidence/ci-runs.json', JSON.stringify(runs, null, 2) + '\n');
  }
  const runResult = (workflow, what, applicable) => {
    if (!applicable) return { conclusion: notApplicable('text', `${what} workflow run for the commit`, `${workflow} does not exist in this repository`), runIds: [] };
    if (!runs) return { conclusion: unavailable('text', `${what} workflow run for the commit`, runsWhy), runIds: [] };
    const mine = runs.filter((r) => r.head_sha === g.commit && (r.path ?? '').split('@')[0].endsWith(workflow)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const latest = mine[0];
    const conclusion = !latest ? 'not_found' : latest.status !== 'completed' ? 'in_progress' : latest.conclusion;
    return { conclusion: measured(conclusion, 'text', `latest ${workflow} run for the commit (GitHub Actions)`, ['ci-runs']), runIds: mine.map((r) => r.id), urls: mine.map((r) => r.html_url).filter((u) => /^https:\/\//.test(u ?? '')) };
  };
  const ci = runResult(e.ci.workflow, 'CI', existsSync(join(root, e.ci.workflow)));
  const deploy = runResult(e.ci.deployWorkflow, 'deploy', !!e.ci.deployWorkflow && existsSync(join(root, e.ci.deployWorkflow)));
  let smokeTest = notApplicable('text', 'fetch the live URL', 'no live URL configured (quality-gate.json → evidence.liveUrl)');
  let liveUrl = notApplicable('text', 'quality-gate.json → evidence.liveUrl', 'the project has no live site configured');
  if (e.liveUrl) {
    if (flag('offline')) {
      smokeTest = unavailable('text', 'fetch the live URL', 'collected with --offline');
      liveUrl = unavailable('text', `configured live URL ${e.liveUrl}`, 'not fetched (collected with --offline)');
    } else {
      liveUrl = measured(e.liveUrl, 'text', 'configured live URL, fetched during collection', ['smoke']);
      let status = 0, body = '';
      try { const r = await fetch(e.liveUrl, { redirect: 'follow' }); status = r.status; body = await r.text(); } catch (err) { status = -1; body = ''; }
      const markerFound = e.smokeMarker ? body.includes(e.smokeMarker) : null;
      addFile('smoke', 'smoke', `Smoke check of ${e.liveUrl}`, 'evidence/smoke.json', JSON.stringify({ url: e.liveUrl, fetchedAt: new Date().toISOString(), httpStatus: status, marker: e.smokeMarker, markerFound, bodySha256: body ? sha256(body) : null }, null, 2) + '\n');
      const pass = status === 200 && markerFound !== false;
      smokeTest = measured(pass ? 'pass' : 'fail', 'text', e.smokeMarker ? `HTTP 200 and the page contains the configured marker` : 'HTTP 200 (no marker configured, so this does not prove the page serves this commit)', ['smoke']);
      if (!e.smokeMarker) limitations.push('The live check has no version marker (evidence.smokeMarker), so it shows the site is up, not that it serves this commit.');
    }
  }
  const blockers = [];
  if (countOf('FAIL')) blockers.push(`${countOf('FAIL')} acceptance criteria failing`);
  if (openSevere) blockers.push(`${openSevere} open P1/P2 defects`);
  if (qa.testsFailed.value) blockers.push(`${qa.testsFailed.value} failing tests`);
  if (ci.conclusion.basis === 'measured' && ci.conclusion.value !== 'success') blockers.push(`CI ${ci.conclusion.value} for ${g.commit.slice(0, 7)}`);
  if (deploy.conclusion.basis === 'measured' && deploy.conclusion.value !== 'success') blockers.push(`deploy ${deploy.conclusion.value} for ${g.commit.slice(0, 7)}`);
  if (smokeTest.value === 'fail') blockers.push('live smoke check failed');
  const verdictOf = (m) => (m.basis === 'not_applicable' ? 'NOT_APPLICABLE' : m.basis !== 'measured' ? 'UNVERIFIED' : ['success', 'pass'].includes(m.value) ? 'PASS' : ['in_progress', 'not_found'].includes(m.value) ? 'UNVERIFIED' : 'FAIL');
  const deliveryStatus = worst(verdictOf(ci.conclusion), verdictOf(deploy.conclusion), verdictOf(smokeTest));
  const delivery = {
    // Without a CI workflow there is nothing to prove the release was built and checked.
    status: verdictOf(ci.conclusion) === 'NOT_APPLICABLE' && deliveryStatus === 'PASS' ? 'UNVERIFIED' : deliveryStatus,
    releaseRef: g.ref ? measured(g.ref, 'text', 'git tag pointing at the measured commit', ['git']) : unavailable('text', 'git tag pointing at the measured commit', 'no tag points at the measured commit'),
    ci, deploy, liveUrl, smokeTest, blockers,
    milestoneComplete: null,
  };
  const core = [functional.status, qa.status, delivery.status];
  delivery.milestoneComplete = blockers.length
    ? measured(false, 'boolean', 'false when any blocker exists', ['git', ...evidence.filter((x) => ['test-results', 'ci-runs', 'smoke'].includes(x.kind)).map((x) => x.id)])
    : core.every((s) => s === 'PASS') ? measured(true, 'boolean', 'true when there are no blockers and functional, QA and delivery are PASS', evidence.filter((x) => ['test-results', 'ci-runs'].includes(x.kind)).map((x) => x.id))
      : unavailable('boolean', 'true when there are no blockers and functional, QA and delivery are PASS', 'functional, QA or delivery evidence is unverified');
  if (delivery.status === 'UNVERIFIED') limitations.push(`Delivery is unverified: ${[ci.conclusion.reason, deploy.conclusion.reason, smokeTest.reason].filter(Boolean).filter((r, i, a) => a.indexOf(r) === i).join('; ') || 'CI has not completed successfully for this commit yet'}.`);
  if (supersedes) limitations.push(`Revision ${revision} supersedes ${supersedes}: ${reviseReason}`);

  const metrics = { functional, intervention, qa, cost, recovery, delivery };
  const missing = Object.entries(metrics).flatMap(([cat, obj]) => measurements(obj, cat)).filter(([, m]) => m.basis === 'unavailable').map(([metric, m]) => ({ metric, reason: m.reason }));
  const categories = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, v.status]));
  const doc = {
    $schema: '../schema/v1/metrics.schema.json',
    schemaVersion: SCHEMA_VERSION,
    kind: 'engineering-evidence/metrics',
    project: { id: e.project.id, name: e.project.name, repository: e.repository },
    milestone: { id: milestone.id, packageId, label: milestone.label, date: opt('date') ?? collectedAt.slice(0, 10), revision, supersedes },
    framework: { name: 'app-boilerplate', version: frameworkVersion() },
    source: { commit: g.commit, committedAt: g.committedAt, ref: g.ref, clean: !g.dirty.length },
    collectedAt,
    collector: { tool: TOOL, version: VERSION },
    window: { from, to: collectedAt },
    metrics,
    evidence,
    missing,
    assessment: { status: overallStatus(categories), categories, limitations },
  };
  writeJson(join(pkg, 'metrics.json'), doc);
  writeFileSync(join(pkg, 'summary.md'), summaryOf(doc));
  copySchemas(e);
  const res = validatePackage(e, packageId, { draft: true });
  for (const w of res.warnings) warn(w);
  for (const er of res.errors) bad(er);
  console.log(`\n${e.dir}/${packageId}: ${doc.assessment.status} (functional ${categories.functional}, intervention ${categories.intervention}, qa ${categories.qa}, cost ${categories.cost}, recovery ${categories.recovery}, delivery ${categories.delivery})`);
  console.log(`${missing.length} measurements unavailable, ${limitations.length} limitations. Draft: add findings to summary.md, then "evidence.mjs freeze --package ${packageId}".`);
  return res.errors.length ? 1 : 0;
}
/** Overall verdict: FAIL if any category fails; PASS only if functional, QA and delivery pass. Intervention, cost and recovery inform but don't gate. */
export const overallStatus = (c) => (Object.values(c).includes('FAIL') ? 'FAIL' : [c.functional, c.qa, c.delivery].every((s) => s === 'PASS') ? 'PASS' : 'UNVERIFIED');
const frameworkVersion = () => (existsSync(join(root, '.claude/framework.json')) ? readJson(join(root, '.claude/framework.json')).version : VERSION);

const FINDINGS = '## Findings (Metrics agent)';
function summaryOf(d) {
  const m = d.metrics;
  const v = (x) => (x.value === null ? `n/a (${x.basis})` : `${x.value}${x.unit === 'percent' ? '%' : x.unit === 'usd' ? ' USD' : ''}`);
  const rows = [
    ['Functional', m.functional.status, `${v(m.functional.criteriaPassing)} of ${v(m.functional.criteriaTotal)} criteria passing (${m.functional.denominator}), ${v(m.functional.criteriaFailing)} failing, ${v(m.functional.criteriaUnverified)} unverified, ${v(m.functional.criteriaDeferred)} deferred; completion ${v(m.functional.completionPercent)}`],
    ['Human intervention', m.intervention.status, `${v(m.intervention.total)} interventions, ${v(m.intervention.corrective)} corrective; ${v(m.intervention.agentTasksWithoutCorrection)} of ${v(m.intervention.agentTasks)} agent tasks without correction`],
    ['QA', m.qa.status, `${v(m.qa.testsPassed)} passed / ${v(m.qa.testsFailed)} failed / ${v(m.qa.testsSkipped)} skipped; defects ${v(m.qa.defectsFound)} found, ${v(m.qa.defectsOpen)} open; requirement coverage ${v(m.qa.requirementCoveragePercent)}, code coverage ${v(m.qa.codeCoveragePercent)}`],
    ['Development cost', m.cost.status, `billing ${m.cost.billingModel}; tokens ${v(m.cost.totalTokens)}; API cost ${v(m.cost.apiCostUsd)}; infrastructure ${v(m.cost.infrastructureCostUsd)}`],
    ['Recovery', m.recovery.status, `${v(m.recovery.interruptions)} interruptions, ${v(m.recovery.resumptionsSucceeded)} resumed, ${v(m.recovery.resumptionsFailed)} failed; recovery tests ${v(m.recovery.recoveryTestsPassed)} passed`],
    ['Delivery', m.delivery.status, `CI ${v(m.delivery.ci.conclusion)}, deploy ${v(m.delivery.deploy.conclusion)}, smoke ${v(m.delivery.smokeTest)}; ${m.delivery.blockers.length} blockers`],
  ];
  return [
    `# ${d.project.name} — ${d.milestone.label} engineering evidence${d.milestone.revision > 1 ? ` (revision ${d.milestone.revision})` : ''}`,
    '',
    `Source commit \`${d.source.commit}\`${d.source.ref ? ` (${d.source.ref})` : ''} · collected ${d.collectedAt} by ${d.collector.tool} ${d.collector.version} · framework ${d.framework.name} ${d.framework.version}`,
    '',
    `Overall: **${d.assessment.status}**`,
    '',
    '<!-- Generated from metrics.json. Do not edit the numbers here; metrics.json is the record. -->',
    '',
    '| Category | Status | Figures |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    '## Blockers',
    ...(d.metrics.delivery.blockers.length ? d.metrics.delivery.blockers.map((b) => `- ${b}`) : ['- none recorded']),
    '',
    '## Missing or unverifiable',
    ...(d.missing.length ? d.missing.map((x) => `- \`${x.metric}\`: ${x.reason}`) : ['- nothing']),
    '',
    '## Limitations',
    ...d.assessment.limitations.map((l) => `- ${l}`),
    '',
    FINDINGS,
    '',
    '<!-- The metrics agent writes its interpretation here before freeze: what the figures show, what they do not, and what evidence to collect next. No new numbers. -->',
    '',
  ].join('\n');
}

// ---------- validate ----------
const near = (a, b) => Math.abs(a - b) <= 0.051;
/** Errors make a package invalid; warnings don't. */
export function validatePackage(e, packageId, { draft = false, frozen = null } = {}) {
  const errors = [], warnings = [];
  const dir = join(evidenceDir(e), packageId);
  const mPath = join(dir, 'metrics.json');
  if (!existsSync(mPath)) return { errors: [`${packageId}: metrics.json is missing`], warnings };
  let d;
  try { d = readJson(mPath); } catch (err) { return { errors: [`${packageId}: metrics.json is not valid JSON (${err.message})`], warnings }; }
  const [major, minor] = String(d.schemaVersion ?? '').split('.').map(Number);
  const [ourMajor, ourMinor] = SCHEMA_VERSION.split('.').map(Number);
  if (major !== ourMajor) return { errors: [`${packageId}: schemaVersion "${d.schemaVersion}" is not supported (this validator reads ${ourMajor}.x)`], warnings };
  if (minor > ourMinor) return { errors: [`${packageId}: schemaVersion ${d.schemaVersion} is newer than this framework (${SCHEMA_VERSION}); upgrade the framework to validate it`], warnings };
  const schemaErrors = validateSchema(schemaFile('metrics'), d);
  errors.push(...schemaErrors.slice(0, 25).map((x) => `${packageId}: schema ${x}`));
  if (schemaErrors.length) return { errors, warnings };

  const E = (m) => errors.push(`${packageId}: ${m}`);
  const val = (x) => x.value;
  // Identity
  const expected = d.milestone.revision === 1 ? d.milestone.id : `${d.milestone.id}-r${d.milestone.revision}`;
  if (d.milestone.packageId !== packageId || expected !== packageId) E(`directory, milestone.packageId and milestone id/revision disagree (expected "${expected}")`);
  if ((d.milestone.revision === 1) !== (d.milestone.supersedes === null)) E('revision 1 must not supersede anything; later revisions must name the package they supersede');
  if (Date.parse(d.collectedAt) < Date.parse(d.source.committedAt)) E('collectedAt is earlier than the measured commit');
  if (!d.source.clean && !d.assessment.limitations.some((l) => /uncommitted/i.test(l))) E('source.clean is false but no limitation says so');
  // Evidence references
  const ids = new Set();
  for (const x of d.evidence) {
    if (ids.has(x.id)) E(`evidence id "${x.id}" is used twice`);
    ids.add(x.id);
    if (x.path) {
      const p = join(dir, x.path);
      if (!existsSync(p)) E(`evidence "${x.id}" points to ${x.path}, which is missing`);
      else if (sha256(readFileSync(p)) !== x.sha256) E(`evidence "${x.id}" (${x.path}) does not match its sha256`);
    }
  }
  const listed = new Set(d.evidence.map((x) => x.path).filter(Boolean));
  for (const f of walk(join(dir, 'evidence')).map((f) => toPosix(relative(dir, f)))) if (!listed.has(f)) warnings.push(`${packageId}: ${f} is not referenced by any evidence entry`);
  const allM = Object.entries(d.metrics).flatMap(([cat, obj]) => measurements(obj, cat));
  for (const [path, m] of allM) for (const s of m.sources ?? []) if (!ids.has(s)) E(`${path} cites evidence "${s}", which is not in evidence[]`);
  const unavailableSet = new Set(allM.filter(([, m]) => m.basis === 'unavailable').map(([p]) => p));
  const missingSet = new Set(d.missing.map((x) => x.metric));
  for (const p of unavailableSet) if (!missingSet.has(p)) E(`${p} is unavailable but not listed in missing[]`);
  for (const p of missingSet) if (!unavailableSet.has(p)) E(`missing[] lists ${p}, which is not an unavailable measurement`);
  const kindOf = (id) => d.evidence.find((x) => x.id === id)?.kind;
  for (const [path, m] of allM) {
    if (m.basis === 'measured' && !(m.sources ?? []).some((s) => kindOf(s) && kindOf(s) !== 'config')) E(`${path} is "measured" without a measured evidence source`);
    if (m.basis === 'recorded' && !(m.sources ?? []).some((s) => kindOf(s) === 'event-log')) E(`${path} is "recorded" but does not cite the event log`);
  }
  // Arithmetic
  const f = d.metrics.functional;
  const fv = [f.criteriaTotal, f.criteriaPassing, f.criteriaFailing, f.criteriaUnverified, f.criteriaDeferred].map(val);
  if (fv.every((x) => x !== null) && fv[1] + fv[2] + fv[3] + fv[4] !== fv[0]) E(`functional: passing + failing + unverified + deferred (${fv[1] + fv[2] + fv[3] + fv[4]}) ≠ criteriaTotal (${fv[0]})`);
  if (val(f.completionPercent) !== null) {
    if (!fv[0]) E('functional.completionPercent has a value but criteriaTotal is 0 or unknown');
    else if (!near(val(f.completionPercent), round1((fv[1] / fv[0]) * 100))) E(`functional.completionPercent ${val(f.completionPercent)} ≠ criteriaPassing / criteriaTotal × 100 (${round1((fv[1] / fv[0]) * 100)})`);
  }
  if (f.criteria && fv[0] !== null) {
    if (f.criteria.length !== fv[0]) E(`functional.criteria lists ${f.criteria.length} criteria but criteriaTotal is ${fv[0]}`);
    const t = (s) => f.criteria.filter((c) => c.status === s).length;
    if (fv[1] !== null && (t('PASS') !== fv[1] || t('FAIL') !== fv[2] || t('UNVERIFIED') !== fv[3] || t('DEFERRED') !== fv[4])) E('functional counts do not match the per-criterion list');
    for (const c of f.criteria) if ((c.status === 'PASS' && (!c.passed || c.failed)) || (c.status === 'FAIL' && !c.failed)) E(`criterion ${c.id} is ${c.status} with ${c.passed} passed / ${c.failed} failed tests`);
    if (new Set(f.criteria.map((c) => c.id)).size !== f.criteria.length) E('functional.criteria has duplicate IDs');
  }
  if (f.status === 'PASS' && !(fv[0] > 0 && fv[2] === 0 && fv[3] === 0)) E('functional.status is PASS but criteria are missing, failing or unverified');
  const q = d.metrics.qa;
  const qv = [q.testsExecuted, q.testsPassed, q.testsFailed].map(val);
  if (qv.every((x) => x !== null) && qv[1] + qv[2] !== qv[0]) E(`qa: testsPassed + testsFailed (${qv[1] + qv[2]}) ≠ testsExecuted (${qv[0]})`);
  const dv = [q.defectsFound, q.defectsFixed, q.defectsDeferred, q.defectsOpen].map(val);
  if (dv.every((x) => x !== null) && dv[1] + dv[2] + dv[3] !== dv[0]) E(`qa: fixed + deferred + open (${dv[1] + dv[2] + dv[3]}) ≠ defectsFound (${dv[0]})`);
  const sev = Object.values(q.defectsBySeverity).map(val);
  if (dv[0] !== null && sev.every((x) => x !== null) && sev.reduce((a, b) => a + b, 0) !== dv[0]) E('qa: defects by severity do not add up to defectsFound');
  if (q.status === 'PASS' && (val(q.testsFailed) !== 0 || val(q.testsExecuted) === null)) E('qa.status is PASS with failing or unknown test results');
  const iv = d.metrics.intervention;
  const byType = Object.values(iv.byType).map(val);
  if (val(iv.total) !== null && byType.every((x) => x !== null) && byType.reduce((a, b) => a + b, 0) !== val(iv.total)) E('intervention: byType does not add up to total');
  const corr = ['technical-correction', 'agent-failure', 'manual-implementation'].map((t) => val(iv.byType[t]));
  if (val(iv.corrective) !== null && corr.every((x) => x !== null) && corr.reduce((a, b) => a + b, 0) !== val(iv.corrective)) E('intervention: corrective ≠ technical-correction + agent-failure + manual-implementation');
  if (val(iv.agentTasksWithoutCorrection) > val(iv.agentTasks)) E('intervention: more tasks without correction than tasks');
  if (val(iv.total) !== null && iv.items.length !== val(iv.total)) E(`intervention: ${iv.items.length} items listed but total is ${val(iv.total)}`);
  const r = d.metrics.recovery;
  if (val(r.resumptionsSucceeded) + val(r.resumptionsFailed) > val(r.recoveryAttempts)) E('recovery: more resumptions than recovery attempts');
  if (r.status === 'PASS' && !(val(r.recoveryTestsPassed) > 0)) E('recovery.status is PASS without a passed controlled recovery test (absence of failures is not evidence)');
  const c = d.metrics.cost;
  if (c.billingModel === 'subscription' && (val(c.apiCostUsd) === 0 || val(c.totalTokens) === 0)) E('cost: subscription usage is reported as zero; record it as unavailable with a reason instead');
  if (c.billingModel === 'subscription' && c.apiCostUsd.basis === 'measured') E('cost: a subscription has no per-run bill, so its API cost can only be an estimate, not "measured"');
  if (c.apiCostUsd.basis === 'measured' && c.items.some((x) => x.category === 'model' && x.basis !== 'measured')) E('cost.apiCostUsd is "measured" but some model entries are estimates');
  // Delivery claims need delivery evidence
  const dl = d.metrics.delivery;
  const ciEvidence = (m) => m.basis === 'measured' && (m.sources ?? []).some((s) => kindOf(s) === 'ci-runs');
  if (val(dl.ci.conclusion) === 'success' && !ciEvidence(dl.ci.conclusion)) E('delivery.ci claims success without CI run evidence');
  if (val(dl.deploy.conclusion) === 'success' && !ciEvidence(dl.deploy.conclusion)) E('delivery.deploy claims success without deployment run evidence');
  if (val(dl.ci.conclusion) === 'success' && !dl.ci.runIds.length) E('delivery.ci claims success without a run id');
  if (val(dl.deploy.conclusion) === 'success' && !dl.deploy.runIds.length) E('delivery.deploy claims success without a run id');
  if (val(dl.smokeTest) === 'pass' && !(dl.smokeTest.sources ?? []).some((s) => kindOf(s) === 'smoke')) E('delivery.smokeTest claims pass without smoke evidence');
  const deployOk = dl.deploy.conclusion.basis === 'not_applicable' || val(dl.deploy.conclusion) === 'success';
  const smokeOk = dl.smokeTest.basis === 'not_applicable' || val(dl.smokeTest) === 'pass';
  if (dl.status === 'PASS' && !(val(dl.ci.conclusion) === 'success' && deployOk && smokeOk)) E('delivery.status is PASS without successful CI, deploy and smoke evidence');
  if (val(dl.milestoneComplete) === true && dl.blockers.length) E('delivery.milestoneComplete is true while blockers exist');
  // Assessment
  for (const k of Object.keys(d.metrics)) if (d.assessment.categories[k] !== d.metrics[k].status) E(`assessment.categories.${k} (${d.assessment.categories[k]}) ≠ metrics.${k}.status (${d.metrics[k].status})`);
  if (d.assessment.status !== overallStatus(d.assessment.categories)) E(`assessment.status ${d.assessment.status} does not follow from the categories (expected ${overallStatus(d.assessment.categories)})`);
  // Source revision
  if (git('rev-parse', '--is-inside-work-tree').out === 'true') {
    if (git('cat-file', '-e', `${d.source.commit}^{commit}`).code === 0) {
      if (git('merge-base', '--is-ancestor', d.source.commit, 'HEAD').code !== 0) warnings.push(`${packageId}: source commit ${d.source.commit.slice(0, 7)} is not an ancestor of HEAD`);
    } else if (git('rev-parse', '--is-shallow-repository').out === 'true') warnings.push(`${packageId}: shallow clone, so source commit ${d.source.commit.slice(0, 7)} cannot be checked (fetch-depth: 0)`);
    else E(`source commit ${d.source.commit} is not in this repository`);
  }
  // Summary and privacy
  const sPath = join(dir, 'summary.md');
  if (!existsSync(sPath)) E('summary.md is missing');
  else {
    const s = readFileSync(sPath, 'utf8');
    if (!s.includes(`Overall: **${d.assessment.status}**`)) E('summary.md does not state the overall status from metrics.json');
  }
  for (const file of walk(dir)) {
    const buf = readFileSync(file);
    if (buf.includes(0)) continue;
    for (const h of sensitiveHits(buf.toString('utf8')).slice(0, 5)) E(`${toPosix(relative(dir, file))} ${h}`);
  }
  return { errors, warnings };
}

function validateAll() {
  const e = loadConfig({ required: false });
  const dir = evidenceDir(e);
  // Token usage is only auditable if it is snapshotted regularly: Claude Code deletes old session logs.
  if (e.configured && e.usageLog) {
    const { entries, errors: ue, exists } = readUsageLog(join(root, e.usageLog));
    const last = [...entries.values()].map((u) => u.at).sort().at(-1);
    const lastCommit = git('log', '-1', '--format=%cI').out;
    if (ue.length) { bad(`the usage log ${e.usageLog} has invalid lines: ${ue[0]}`); return 1; }
    if (!exists) warn(`no token-usage log at ${e.usageLog}: run "evidence.mjs usage" (the session-start hook does it every session)`);
    else if (last && lastCommit && Date.parse(lastCommit) - Date.parse(last) > 7 * 86400000) warn(`the token-usage log was last snapshotted ${last.slice(0, 10)}, more than 7 days before the latest commit: run "evidence.mjs usage" and commit ${e.usageLog}`);
  }
  if (!existsSync(dir)) { console.log(`NOT_APPLICABLE no ${e.dir}/ directory: no evidence packages to validate`); return 0; }
  const errors = [], warnings = [];
  const index = loadIndex(e);
  const frozen = new Map();
  if (index) {
    const errs = validateSchema(schemaFile('index'), index);
    errors.push(...errs.slice(0, 20).map((x) => `index.json: ${x}`));
    if (!errs.length) {
      const seen = new Set(), seenRev = new Set();
      for (const p of index.packages) {
        if (seen.has(p.id)) errors.push(`index.json: duplicate package id "${p.id}"`);
        if (seenRev.has(`${p.milestoneId}#${p.revision}`)) errors.push(`index.json: milestone "${p.milestoneId}" has revision ${p.revision} twice`);
        seen.add(p.id); seenRev.add(`${p.milestoneId}#${p.revision}`);
        if (p.id !== p.path) errors.push(`index.json: package "${p.id}" has path "${p.path}"`);
        frozen.set(p.id, p);
      }
      for (const p of index.packages) {
        if (p.supersedes && !frozen.has(p.supersedes)) errors.push(`index.json: ${p.id} supersedes unknown package ${p.supersedes}`);
        if (p.supersededBy && frozen.get(p.supersededBy)?.supersedes !== p.id) errors.push(`index.json: ${p.id} supersededBy ${p.supersededBy}, which does not supersede it`);
      }
    }
  }
  const dirs = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory() && n !== 'schema');
  for (const id of new Set([...dirs, ...frozen.keys()])) {
    const p = frozen.get(id);
    if (p && !existsSync(join(dir, id))) { errors.push(`${id}: listed as frozen in index.json but the directory is gone`); continue; }
    const res = validatePackage(e, id, { draft: !p, frozen: p });
    errors.push(...res.errors); warnings.push(...res.warnings);
    if (p) {
      const { files, tree } = packageFiles(join(dir, id));
      const changed = [...new Set([...Object.keys(files), ...Object.keys(p.files)])].filter((f) => files[f] !== p.files[f]);
      if (changed.length || tree !== p.sha256) errors.push(`${id}: frozen package was modified after freeze (${changed.slice(0, 5).join(', ') || 'tree hash'}). Frozen packages are never edited; publish a correction with collect --revise.`);
      else ok(`${id} (frozen ${p.frozenAt.slice(0, 10)}, ${p.assessment})`);
      const m = existsSync(join(dir, id, 'metrics.json')) ? readJson(join(dir, id, 'metrics.json')) : null;
      if (m && (m.milestone?.id !== p.milestoneId || m.source?.commit !== p.sourceCommit)) errors.push(`${id}: index.json entry disagrees with metrics.json (milestone or commit)`);
    } else if (!res.errors.length) warnings.push(`${id} is a draft (not frozen, not listed in index.json, not published)`);
  }
  const milestoneIds = readdirSync(dir).filter((n) => existsSync(join(dir, n, 'metrics.json'))).map((n) => { try { const m = readJson(join(dir, n, 'metrics.json')); return `${m.milestone.id}#${m.milestone.revision}`; } catch { return null; } }).filter(Boolean);
  const dup = milestoneIds.filter((x, i) => milestoneIds.indexOf(x) !== i);
  if (dup.length) errors.push(`duplicate milestone revisions across packages: ${[...new Set(dup)].join(', ')}`);
  for (const w of warnings) warn(w);
  for (const er of errors) bad(er);
  if (!errors.length) ok(`${dirs.length} evidence packages valid (${frozen.size} frozen)`);
  return errors.length ? 1 : 0;
}

// ---------- freeze ----------
function freeze() {
  const e = loadConfig();
  const id = opt('package');
  if (!id) { console.error('usage: freeze --package <id>'); return 2; }
  const index = loadIndex(e) ?? { schemaVersion: SCHEMA_VERSION, kind: 'engineering-evidence/index', project: null, packages: [] };
  if (index.packages.some((p) => p.id === id)) { bad(`${id} is already frozen; frozen packages are never overwritten (publish a correction with collect --revise)`); return 1; }
  const res = validatePackage(e, id);
  for (const w of res.warnings) warn(w);
  if (res.errors.length) { res.errors.forEach(bad); bad(`${id} is not valid; nothing frozen`); return 1; }
  const m = readJson(join(evidenceDir(e), id, 'metrics.json'));
  if (index.packages.some((p) => p.milestoneId === m.milestone.id && p.revision === m.milestone.revision)) { bad(`milestone ${m.milestone.id} revision ${m.milestone.revision} is already frozen`); return 1; }
  if (m.milestone.supersedes) {
    const old = index.packages.find((p) => p.id === m.milestone.supersedes);
    if (!old) { bad(`${id} supersedes ${m.milestone.supersedes}, which is not frozen`); return 1; }
    if (old.supersededBy) { bad(`${old.id} is already superseded by ${old.supersededBy}`); return 1; }
    old.supersededBy = id;
  }
  const findings = readFileSync(join(evidenceDir(e), id, 'summary.md'), 'utf8').split(FINDINGS)[1] ?? '';
  if (!findings.replace(/<!--[\s\S]*?-->/g, '').trim()) warn(`${id}/summary.md has no findings yet (the metrics agent writes them before freeze)`);
  const { files, tree } = packageFiles(join(evidenceDir(e), id));
  index.schemaVersion = SCHEMA_VERSION;
  index.project = m.project;
  index.packages.push({
    id, milestoneId: m.milestone.id, label: m.milestone.label, revision: m.milestone.revision, path: id, schemaVersion: m.schemaVersion,
    sourceCommit: m.source.commit, collectedAt: m.collectedAt, frozenAt: new Date().toISOString(), sha256: tree, files,
    assessment: m.assessment.status, supersedes: m.milestone.supersedes, supersededBy: null,
  });
  index.packages.sort((a, b) => (a.collectedAt < b.collectedAt ? -1 : a.collectedAt > b.collectedAt ? 1 : a.revision - b.revision));
  writeJson(indexPath(e), { $schema: './schema/v1/index.schema.json', ...index });
  copySchemas(e);
  const evPath = join(root, e.events);
  if (existsSync(evPath)) appendEvent(evPath, { type: 'milestone', milestone: m.milestone.id, by: 'metrics', summary: `Evidence package ${id} frozen (${m.assessment.status})` });
  ok(`${id} frozen: sha256 ${tree.slice(0, 12)}…, ${Object.keys(files).length} files, listed in ${e.dir}/index.json`);
  return 0;
}

// ---------- init, event, status ----------
function init() {
  const path = resolve(root, opt('config', 'quality-gate.json'));
  const qg = existsSync(path) ? readJson(path) : {};
  if (qg.evidence) ok('quality-gate.json already has an "evidence" block; left unchanged');
  else {
    let pkgName = null;
    try { pkgName = readJson(join(root, 'package.json')).name; } catch { /* no package.json */ }
    const name = opt('name') ?? pkgName ?? basename(root);
    qg.evidence = { ...EVIDENCE_DEFAULTS, project: { id: opt('id') ?? slug(pkgName ?? name), name, repository: null } };
    writeJson(path, qg);
    ok(`added "evidence" to ${toPosix(relative(root, path))} (milestones: ${qg.evidence.milestones.map((m) => m.id).join(', ')}; edit them to match the plan)`);
  }
  const e = loadConfig();
  const ev = join(root, e.events);
  if (existsSync(ev)) ok(`${e.events} exists`);
  else { mkdirSync(dirname(ev), { recursive: true }); writeFileSync(ev, ''); ok(`created ${e.events} (append-only event log)`); }
  if (e.usageLog) {
    if (!existsSync(join(root, e.usageLog))) { mkdirSync(dirname(join(root, e.usageLog)), { recursive: true }); writeFileSync(join(root, e.usageLog), ''); ok(`created ${e.usageLog} (token-usage log, snapshotted at every session start)`); }
    usageSnapshot(e);
  }
  return 0;
}
function usage() {
  const e = loadConfig();
  if (!e.usageLog) { console.error('quality-gate.json → evidence.usageLog is null: token-usage logging is switched off'); return 2; }
  const r = usageSnapshot(e, { quiet: flag('quiet') });
  return r.error ? 1 : 0;
}
function event() {
  const e = loadConfig();
  const type = args[1];
  if (!EVENT_TYPES.includes(type)) { console.error(`usage: event <type> --summary "…"\ntypes: ${EVENT_TYPES.join(', ')}`); return 2; }
  const minutes = opt('minutes');
  const r = appendEvent(join(root, e.events), {
    type, summary: opt('summary'), by: opt('by'), task: opt('task'), milestone: opt('milestone'), outcome: opt('outcome'),
    defect: opt('defect'), severity: opt('severity'), state: opt('state'), regression: flag('regression') ? true : undefined,
    minutes: minutes === undefined ? undefined : Number(minutes),
  });
  if (r.error) { bad(`event not recorded: ${r.error}`); return 1; }
  ok(`${type} recorded in ${e.events}`);
  return 0;
}
function status() {
  const e = loadConfig();
  const index = loadIndex(e);
  const { events } = readEvents(join(root, e.events));
  console.log(`milestones: ${e.milestones.map((m) => `${m.id} (${m.label})`).join(', ')}`);
  console.log(`event log: ${events ? `${events.length} events in ${e.events}` : `missing (${e.events})`}`);
  if (e.usageLog) {
    const { entries, exists } = readUsageLog(join(root, e.usageLog));
    const all = [...entries.values()];
    const last = all.map((u) => u.at).sort().at(-1);
    const tok = (f) => all.reduce((s, u) => s + u[f], 0);
    console.log(`usage log: ${!exists ? `missing (${e.usageLog})` : `${all.length} buckets, ${tok('requests')} requests, ${tok('inputTokens') + tok('outputTokens')} input+output tokens, ${tok('cacheWriteTokens') + tok('cacheReadTokens')} cache tokens; last snapshot ${last ?? 'never'}`}`);
  }
  for (const p of index?.packages ?? []) console.log(`frozen: ${p.id} ${p.assessment} commit ${p.sourceCommit.slice(0, 7)}${p.supersededBy ? ` (superseded by ${p.supersededBy})` : ''}`);
  const drafts = existsSync(evidenceDir(e)) ? readdirSync(evidenceDir(e)).filter((n) => existsSync(join(evidenceDir(e), n, 'metrics.json')) && !index?.packages.some((p) => p.id === n)) : [];
  for (const d of drafts) console.log(`draft: ${d}`);
  return 0;
}

const USAGE = `app-boilerplate milestone evidence v${VERSION} (schema ${SCHEMA_VERSION})
usage: node evidence.mjs <command>
  init [--name "App"] [--id app]   add the "evidence" block to quality-gate.json and create the event log
  event <type> --summary "…" [--task t] [--milestone m] [--outcome success|failure] [--by role]
        [--defect id --severity P1-P4 --state found|fixed|deferred] [--regression] [--minutes n]
                                   append one event (types: ${EVENT_TYPES.join(', ')})
  usage [--quiet] [--transcripts <dir>]
                                   snapshot token usage from Claude Code session logs into the usage log
                                   (runs at every session start and before collect)
  collect --milestone <id> [--revise --reason "…"] [--run-tests] [--offline] [--ci-runs file] [--usage file]
          [--allow-dirty] [--no-usage-snapshot]
                                   write a draft package engineering-evidence/<id>/ from existing evidence
  validate [--package <id>]        schema, arithmetic, references, privacy, frozen-package integrity
  freeze --package <id>            publish: record the package's hashes in engineering-evidence/index.json
  status                           milestones, event log, usage log, frozen and draft packages`;

const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const main = async () => {
    if (!cmd || cmd === '--help' || cmd === '-h') { console.log(USAGE); return 0; }
    if (cmd === '--version') { console.log(VERSION); return 0; }
    if (cmd === 'init') return init();
    if (cmd === 'event') return event();
    if (cmd === 'usage') return usage();
    if (cmd === 'collect') return collect();
    if (cmd === 'freeze') return freeze();
    if (cmd === 'status') return status();
    if (cmd === 'validate') {
      if (!opt('package')) return validateAll();
      const e = loadConfig({ required: false });
      const index = loadIndex(e);
      const res = validatePackage(e, opt('package'), { frozen: index?.packages.find((p) => p.id === opt('package')) ?? null });
      res.warnings.forEach(warn); res.errors.forEach(bad);
      if (!res.errors.length) ok(`${opt('package')} is valid`);
      return res.errors.length ? 1 : 0;
    }
    console.error(USAGE);
    return 2;
  };
  main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(2); });
}
