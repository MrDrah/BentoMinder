#!/usr/bin/env node
// app-boilerplate quality gate. Node >= 20, no dependencies.
// Usage: node validate.mjs <command> [options]   (run with --help for the list)
// Config: quality-gate.json in the current directory (or --config <path>).
// Exit codes: 0 pass, 1 fail (including UNVERIFIED evidence), 2 misconfiguration.
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.5.0';

// ---------- small utilities ----------
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const optAll = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const root = process.cwd();
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m', dim: '\x1b[2m', reset: '\x1b[0m' };
const color = !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (c, s) => (color ? C[c] + s + C.reset : s);
const ok = (m) => console.log(`${paint('green', 'PASS')} ${m}`);
const bad = (m) => console.log(`${paint('red', 'FAIL')} ${m}`);
const unverified = (m) => console.log(`${paint('magenta', 'UNVERIFIED')} ${m}`);
const warn = (m) => console.log(`${paint('yellow', 'WARN')} ${m}`);
const info = (m) => console.log(paint('dim', `     ${m}`));

// For real executables (git, gh). No shell, so args such as "%an <%ae>" reach them intact.
const run = (command, a = []) => {
  const r = spawnSync(command, a, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? (r.error ? 127 : 1), out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};
const git = (...a) => run('git', a);

/** Convert a glob (supports **, *, ?, {a,b}) to a RegExp over forward-slash paths. */
export function globToRegExp(glob) {
  let re = '';
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') { re += '(?:'; depth++; }
    else if (c === '}' && depth) { re += ')'; depth--; }
    else if (c === ',' && depth) re += '|';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));
const toPosix = (p) => p.split(sep).join('/');

function walk(dir, skip = ['node_modules', '.git']) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p, skip));
    else out.push(toPosix(relative(root, p)));
  }
  return out;
}
const listFiles = (globs) => walk(root).filter((f) => matchesAny(f, globs));

/** Tracked + untracked-but-not-ignored files (falls back to a walk outside git). */
function repoFiles() {
  const r = git('ls-files', '-co', '--exclude-standard');
  return r.code === 0 ? r.out.split('\n').filter(Boolean) : walk(root);
}
const STATE_DIR = '.claude/state';

// ---------- config ----------
const DEFAULTS = {
  commands: [],
  generated: [],
  docs: {
    required: ['CATCH-UP.md', 'docs/PLAN.md'],
    catchUp: 'CATCH-UP.md',
    maxStaleDays: 7,
    decisionLog: { file: 'docs/PLAN.md', heading: 'Decision' },
  },
  trace: {
    stories: 'docs/ba/user-stories.md',
    // Only executable test files count. IDs must appear in a test/describe title, not in comments or docs.
    tests: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}', 'src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}'],
    pattern: 'US-[A-Z0-9]+-\\d+',
    allowUntested: [],
  },
  budgets: [],
  secrets: { exclude: ['package-lock.json', '**/*.lock', '**/*.min.js'] },
  overlap: null,
  preflight: { nodeMajor: 20, requireRemote: true, optional: ['gh', 'playwright'] },
  stages: {
    // dev: what a developer must pass before handing to QA (H3). QA still owns some story tests.
    dev: ['preflight', 'secrets', 'commands', 'budget'],
    // release: everything, before H4 sign-off and before anything reaches main.
    release: ['preflight', 'docs', 'trace', 'secrets', 'commands', 'budget', 'overlap', 'evidence'],
  },
};

function loadConfig() {
  const path = resolve(root, opt('config', 'quality-gate.json'));
  if (!existsSync(path)) {
    if (['preflight', 'diff-guard', 'secrets', 'task-start'].includes(cmd)) return structuredClone(DEFAULTS);
    console.error(`No config at ${path}. Copy templates/project/quality-gate.json from the framework.`);
    process.exit(2);
  }
  const user = JSON.parse(readFileSync(path, 'utf8'));
  const cfg = structuredClone(DEFAULTS);
  for (const [k, v] of Object.entries(user)) {
    cfg[k] = v && typeof v === 'object' && !Array.isArray(v) && cfg[k] && typeof cfg[k] === 'object' && !Array.isArray(cfg[k]) ? { ...cfg[k], ...v } : v;
  }
  return cfg;
}

// ---------- checks (each returns true on pass) ----------
function preflight(cfg, { requiredOnly = false } = {}) {
  let pass = true;
  const p = cfg.preflight;
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= p.nodeMajor) ok(`node ${process.versions.node}`);
  else { bad(`node ${process.versions.node} < ${p.nodeMajor}`); pass = false; }

  if (git('rev-parse', '--is-inside-work-tree').out !== 'true') {
    bad('not a git repository (a downloaded zip has no history and cannot push: clone the repo instead)');
    return false;
  }
  ok('git repository');
  const remote = git('remote', 'get-url', 'origin');
  if (remote.code === 0) ok(`origin → ${remote.out}`);
  else if (p.requireRemote) { bad('no "origin" remote'); pass = false; }
  else warn('no "origin" remote');

  const email = git('config', 'user.email').out;
  if (email) ok(`git identity ${git('config', 'user.name').out} <${email}>`);
  else {
    const last = git('log', '-1', '--format=%an <%ae>').out;
    warn(`no git identity configured${last ? `; commit with: git -c user.name=… -c user.email=… (repo history uses ${last})` : ''}`);
  }
  if (requiredOnly) return pass;

  if (p.optional.includes('gh')) {
    const gh = run('gh', ['--version']);
    if (gh.code === 0) ok(gh.out.split('\n')[0]);
    else warn('gh CLI not found: CI status can still be read from the GitHub API with curl');
  }
  if (p.optional.includes('playwright') && existsSync(join(root, 'node_modules/@playwright/test'))) {
    const dirs = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'), join(homedir(), '.cache/ms-playwright'), join(homedir(), 'Library/Caches/ms-playwright')].filter(Boolean);
    const found = dirs.find((d) => existsSync(d) && readdirSync(d).some((n) => /chrom/i.test(n)));
    if (found) ok(`Playwright browsers in ${found}`);
    else warn('Playwright browsers not installed: run "npx playwright install chromium"');
  }
  if (!existsSync(join(root, 'node_modules')) && existsSync(join(root, 'package.json'))) warn('node_modules missing: run "npm ci"');
  return pass;
}

function docs(cfg) {
  const d = cfg.docs;
  let pass = true;
  for (const f of d.required) {
    if (existsSync(join(root, f))) ok(`${f} exists`);
    else { bad(`${f} is missing`); pass = false; }
  }
  const cu = join(root, d.catchUp);
  if (existsSync(cu)) {
    const m = readFileSync(cu, 'utf8').match(/Last updated:\s*\**\s*(\d{4}-\d{2}-\d{2})/i);
    const lastCommit = git('log', '-1', '--format=%cs').out;
    if (!m) { bad(`${d.catchUp} has no "Last updated: YYYY-MM-DD" line`); pass = false; }
    else if (lastCommit) {
      const days = (Date.parse(lastCommit) - Date.parse(m[1])) / 86400000;
      if (days > d.maxStaleDays) { bad(`${d.catchUp} last updated ${m[1]}, ${Math.round(days)} days before the latest commit (${lastCommit})`); pass = false; }
      else ok(`${d.catchUp} last updated ${m[1]} (latest commit ${lastCommit})`);
    } else ok(`${d.catchUp} last updated ${m[1]}`);
  }
  const log = d.decisionLog && join(root, d.decisionLog.file);
  if (log && existsSync(log)) {
    const text = readFileSync(log, 'utf8');
    const start = text.split('\n').findIndex((l) => /^#+ /.test(l) && l.includes(d.decisionLog.heading));
    const rows = start < 0 ? 0 : text.split('\n').slice(start + 1).filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l)).length;
    if (rows > 0) ok(`decision log has ${rows} dated rows`);
    else { bad(`no dated rows under a "${d.decisionLog.heading}" heading in ${d.decisionLog.file}`); pass = false; }
  }
  return pass;
}

/**
 * Story IDs that appear in the title of an active test or describe block:
 * it('US-…'), test('US-…'), describe('US-…'), test.describe('US-…'), it.each(...)('US-…').
 * Skipped/todo blocks (it.skip, test.todo, xit, xdescribe, test.fixme) and comments do not count.
 */
export function testedIds(source, pattern) {
  const ids = new Set();
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const call = /\b(x?(?:it|test|describe))((?:\.[A-Za-z]+(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?)*)\s*\(\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3/g;
  const re = new RegExp(pattern, 'g');
  for (const m of code.matchAll(call)) {
    if (m[1].startsWith('x') || /\.(skip|todo|fixme)\b/.test(m[2])) continue;
    for (const id of m[4].match(re) ?? []) ids.add(id);
  }
  return ids;
}

function trace(cfg) {
  const t = cfg.trace;
  const storiesPath = join(root, t.stories);
  if (!existsSync(storiesPath)) { bad(`stories file ${t.stories} not found`); return false; }
  const re = new RegExp(`\\b${t.pattern}\\b`, 'g');
  const stories = [...new Set(readFileSync(storiesPath, 'utf8').match(re) ?? [])];
  if (!stories.length) { bad(`no story IDs matching /${t.pattern}/ in ${t.stories}: nothing to trace`); return false; }
  const files = listFiles(t.tests);
  if (!files.length) { bad(`no test files match ${t.tests.join(', ')}`); return false; }
  const tested = new Set();
  for (const f of files) for (const id of testedIds(readFileSync(join(root, f), 'utf8'), t.pattern)) tested.add(id);
  const missing = stories.filter((s) => !tested.has(s) && !t.allowUntested.includes(s));
  const deferred = stories.filter((s) => !tested.has(s) && t.allowUntested.includes(s));
  info(`${stories.length} stories, ${files.length} test files; IDs counted only in active test/describe titles`);
  if (deferred.length) warn(`${deferred.length} stories deferred without tests: ${deferred.join(', ')}`);
  if (missing.length) { bad(`${missing.length}/${stories.length} stories have no active test: ${missing.join(', ')}`); return false; }
  ok(`all ${stories.length - deferred.length} stories are named by an active test`);
  return true;
}

function commands(cfg) {
  // Executing the tests is mandatory evidence: a gate with nothing to run proves nothing.
  if (!cfg.commands.length) { bad('no commands configured in quality-gate.json (tests, build and data validation must run)'); return false; }
  for (const c of cfg.commands) {
    console.log(paint('dim', `---- ${c.name}: ${c.run}`));
    const t = Date.now();
    const r = spawnSync(c.run, { cwd: root, shell: true, stdio: 'inherit' });
    const secs = ((Date.now() - t) / 1000).toFixed(1);
    if (r.status !== 0) { bad(`${c.name} (exit ${r.status}, ${secs}s)`); return false; }
    ok(`${c.name} (${secs}s)`);
  }
  return true;
}

function budget(cfg) {
  if (!cfg.budgets.length) { warn('no budgets configured'); return true; }
  let pass = true;
  for (const b of cfg.budgets) {
    const files = listFiles([b.glob]);
    if (!files.length) {
      // Missing build output is missing evidence, not a pass.
      if (b.optional) warn(`${b.name}: no files match ${b.glob} (optional budget)`);
      else { bad(`${b.name}: no files match ${b.glob}: build output is missing, so the budget cannot be checked`); pass = false; }
      continue;
    }
    const kb = files.reduce((s, f) => s + gzipSync(readFileSync(join(root, f))).length, 0) / 1024;
    const msg = `${b.name}: ${kb.toFixed(1)} KB gzipped (budget ${b.maxGzipKb} KB, ${files.length} files)`;
    if (kb > b.maxGzipKb) { bad(msg); pass = false; } else ok(msg);
  }
  return pass;
}

// Shared with the milestone-evidence skill, which scans evidence packages with the same patterns.
export const SECRET_PATTERNS = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Stripe live key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI/Anthropic-style key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['assigned secret', /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];

function secrets(cfg) {
  const files = repoFiles().filter((f) => !matchesAny(f, cfg.secrets.exclude));
  const hits = [];
  const envFiles = files.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f));
  for (const f of envFiles) hits.push(`${f}: .env file is tracked or not git-ignored`);
  for (const f of files) {
    let text;
    try { const buf = readFileSync(join(root, f)); if (buf.includes(0) || buf.length > 5e6) continue; text = buf.toString('utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => {
      for (const [label, re] of SECRET_PATTERNS) if (re.test(line)) hits.push(`${f}:${i + 1}: possible ${label}`);
    });
  }
  if (hits.length) { bad(`${hits.length} possible secrets`); hits.slice(0, 30).forEach(info); return false; }
  ok(`no secrets found in ${files.length} files`);
  return true;
}

// ---------- overlap: copied wording vs cached sources ----------
const words = (s) => (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").match(/[a-z0-9']+/g) ?? []);
const htmlToText = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ');
const cacheName = (url) => createHash('sha1').update(url).digest('hex').slice(0, 16) + '.txt';
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const EXCEPTION_FIELDS = ['id', 'field', 'run', 'reason', 'reviewer', 'date'];

function overlapRecords(o) {
  const out = [];
  for (const f of listFiles(o.records)) {
    const data = JSON.parse(readFileSync(join(root, f), 'utf8'));
    const list = Array.isArray(data) ? data : get(data, o.listPath ?? 'items') ?? Object.values(data).find(Array.isArray) ?? [];
    for (const r of list) out.push({ file: f, r });
  }
  return out;
}
const urlsOf = (r, o) => (get(r, o.sourcesField) ?? []).map((s) => (typeof s === 'string' ? s : get(s, o.urlField))).filter((u) => /^https?:\/\//.test(u ?? ''));

async function overlapFetch(o) {
  const dir = join(root, o.cacheDir);
  mkdirSync(dir, { recursive: true });
  const urls = [...new Set(overlapRecords(o).flatMap(({ r }) => urlsOf(r, o)))].filter((u) => !existsSync(join(dir, cacheName(u))));
  console.log(`fetching ${urls.length} uncached sources, ${o.delayMs ?? 3000} ms apart`);
  for (const [i, url] of urls.entries()) {
    let body = '', status = 0;
    for (let a = 0; a < 4; a++) {
      try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); status = r.status; body = await r.text(); } catch { status = -1; }
      if (status === 200 && body.length > 500) break;
      await new Promise((r) => setTimeout(r, 15000));
    }
    if (status === 200 && body.length > 500) writeFileSync(join(dir, cacheName(url)), url + '\n' + htmlToText(body));
    else warn(`${status} ${url}`);
    if ((i + 1) % 25 === 0) info(`${i + 1}/${urls.length}`);
    await new Promise((r) => setTimeout(r, o.delayMs ?? 3000));
  }
}

function loadExceptions(o) {
  const path = o.acceptFile && join(root, o.acceptFile);
  if (!path || !existsSync(path)) return { list: [], invalid: [] };
  const list = JSON.parse(readFileSync(path, 'utf8'));
  const invalid = list.filter((e) => EXCEPTION_FIELDS.some((k) => typeof e[k] !== 'string' || !e[k].trim()) || e.reason.trim().length < 15);
  return { list, invalid };
}

/** Per-record status: PASS, FAIL (copied run ≥ failAt without a documented exception) or UNVERIFIED (no cached source text). */
function overlapScan(o) {
  const dir = join(root, o.cacheDir);
  const minRun = o.minRun ?? 7, failAt = o.failAt ?? 12;
  const { list: exceptions } = loadExceptions(o);
  const excused = new Set(exceptions.map((e) => `${e.id}|${e.field}|${e.run}`));
  const gramCache = new Map();
  const grams = (url) => {
    if (gramCache.has(url)) return gramCache.get(url);
    const p = join(dir, cacheName(url));
    let g = null;
    if (existsSync(p)) { const w = words(readFileSync(p, 'utf8')); g = new Set(); for (let k = 0; k + minRun <= w.length; k++) g.add(w.slice(k, k + minRun).join(' ')); }
    gramCache.set(url, g);
    return g;
  };
  const results = [];
  for (const { file, r } of overlapRecords(o)) {
    const id = get(r, o.idField ?? 'id');
    const urls = urlsOf(r, o);
    const gs = urls.map(grams);
    const missing = urls.filter((_, i) => !gs[i]);
    const res = { file, id, hits: [], status: 'PASS', missing };
    if (!urls.length || missing.length === urls.length) { res.status = 'UNVERIFIED'; results.push(res); continue; }
    const have = gs.filter(Boolean);
    const has = (w, k) => have.some((g) => g.has(w.slice(k, k + minRun).join(' ')));
    for (const field of o.fields) {
      const text = get(r, field);
      if (typeof text !== 'string') continue;
      for (const sentence of text.split(/(?<=[.!?])\s+|\n\n/)) {
        const w = words(sentence);
        let best = 0, bestRun = '';
        for (let k = 0; k + minRun <= w.length; k++) {
          if (!has(w, k)) continue;
          let e = k + minRun;
          while (e < w.length && has(w, e - minRun + 1)) e++;
          if (e - k > best) { best = e - k; bestRun = w.slice(k, e).join(' '); }
          k = e - 1;
        }
        if (best) res.hits.push({ field, len: best, run: bestRun, sentence, excused: excused.has(`${id}|${field}|${bestRun}`) });
      }
    }
    if (res.hits.some((h) => h.len >= failAt && !h.excused)) res.status = 'FAIL';
    // Some (but not all) sources missing: the record can still fail, but it can't fully pass.
    else if (missing.length) res.status = 'UNVERIFIED';
    results.push(res);
  }
  return { results, failAt, minRun, exceptions };
}

/** Record ONE reviewed exception. The run must currently be flagged for that record and field. */
function overlapAccept(o) {
  const e = { id: opt('id'), field: opt('field'), run: opt('run'), reason: opt('reason'), reviewer: opt('reviewer'), date: new Date().toISOString().slice(0, 10) };
  const missing = EXCEPTION_FIELDS.filter((k) => !e[k]);
  if (missing.length) { console.error(`overlap --accept needs --id --field --run --reason --reviewer (missing: ${missing.join(', ')})`); return 2; }
  if (e.reason.trim().length < 15) { console.error('--reason must explain why this run is not copying (≥ 15 characters), e.g. "book title and author credit"'); return 2; }
  const { results } = overlapScan(o);
  const hit = results.find((r) => r.id === e.id)?.hits.find((h) => h.field === e.field && h.run === e.run);
  if (!hit) { console.error(`"${e.run}" is not currently flagged in ${e.id}.${e.field}; copy the run exactly from the overlap report`); return 2; }
  const path = join(root, o.acceptFile);
  const list = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  if (list.some((x) => x.id === e.id && x.field === e.field && x.run === e.run)) { warn('already accepted'); return 0; }
  list.push(e);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(list, null, 1) + '\n');
  ok(`exception recorded for ${e.id}.${e.field} by ${e.reviewer}`);
  return 0;
}

async function overlap(cfg) {
  const o = cfg.overlap;
  if (!o) { warn('overlap not configured'); return true; }
  if (flag('fetch')) await overlapFetch(o);
  const { invalid } = loadExceptions(o);
  const { results, failAt, minRun, exceptions } = overlapScan(o);
  if (opt('report')) writeFileSync(resolve(root, opt('report')), JSON.stringify(results.filter((r) => r.hits.length || r.status !== 'PASS'), null, 1));
  const by = (s) => results.filter((r) => r.status === s);
  const stale = exceptions.filter((e) => !results.some((r) => r.id === e.id && r.hits.some((h) => h.field === e.field && h.run === e.run)));
  info(`${results.length} records: ${by('PASS').length} PASS, ${by('FAIL').length} FAIL, ${by('UNVERIFIED').length} UNVERIFIED · runs ≥ ${minRun} words reported, ≥ ${failAt} fail · ${exceptions.length} documented exceptions`);
  if (stale.length) warn(`${stale.length} exceptions no longer match any flagged text; remove them from ${o.acceptFile}`);
  let pass = true;
  if (invalid.length) { bad(`${invalid.length} exceptions in ${o.acceptFile} lack id/field/run/reason/reviewer/date or a real reason`); pass = false; }
  for (const r of by('FAIL').slice(0, 30)) for (const h of r.hits.filter((x) => x.len >= failAt && !x.excused)) info(`FAIL ${r.id}.${h.field} (${h.len}): "${h.run}"`);
  for (const r of by('UNVERIFIED').slice(0, 30)) info(`UNVERIFIED ${r.id}: ${r.missing.length ? `no cached text for ${r.missing.join(', ')}` : 'no source URLs'}`);
  if (by('FAIL').length) { bad(`${by('FAIL').length} records copy ≥ ${failAt} consecutive words from a source. Rewrite them, or record a reviewed exception per run with --accept`); pass = false; }
  if (by('UNVERIFIED').length) { unverified(`${by('UNVERIFIED').length} records could not be checked against their sources (run "overlap --fetch"; fix dead URLs)`); pass = false; }
  if (pass) ok(`all ${results.length} records checked against cached sources`);
  return pass;
}

// ---------- task baselines + diff-guard ----------
const taskId = (name) => name.replace(/[^\w.-]/g, '_');
const taskPath = (name) => join(root, STATE_DIR, 'tasks', `${taskId(name)}.json`);
const eventsFile = (cfg) => cfg.evidence?.events ?? 'docs/evidence/events.jsonl';
const usageFile = (cfg) => (cfg.evidence?.usageLog === null ? null : cfg.evidence?.usageLog ?? 'docs/evidence/usage.jsonl');
/** Agent tasks feed the milestone evidence (tasks completed without correction). Only when the project keeps an event log. */
function logEvent(cfg, e) {
  const p = join(root, eventsFile(cfg));
  if (existsSync(p)) appendFileSync(p, JSON.stringify({ v: 1, at: new Date().toISOString(), by: 'orchestrator', ...e }) + '\n');
}

function taskStart(cfg) {
  const name = opt('task') ?? args[1];
  const allow = optAll('allow');
  if (!name || name.startsWith('--') || !allow.length) { console.error('usage: task-start <name> --allow "<glob>" [--allow …]'); return 2; }
  const base = git('rev-parse', 'HEAD');
  if (base.code !== 0) { console.error('task-start needs a git repository with at least one commit'); return 2; }
  // git() trims its output, so the first line may have lost the leading space of its status column.
  const dirty = git('status', '--porcelain', '--untracked-files=all').out.split('\n').filter(Boolean).map((l) => l.replace(/^.{1,2}?\s/, '')).filter((f) => !f.startsWith(STATE_DIR));
  mkdirSync(join(root, STATE_DIR, 'tasks'), { recursive: true });
  writeFileSync(taskPath(name), JSON.stringify({ task: name, base: base.out, allow, preexisting: dirty, started: new Date().toISOString() }, null, 2) + '\n');
  ok(`task "${name}" baseline ${base.out.slice(0, 7)}; allowed: ${allow.join(', ')}`);
  logEvent(cfg, { type: 'task-start', task: taskId(name), summary: `Task ${taskId(name)} dispatched (${allow.length} allowed globs)` });
  if (dirty.length) warn(`${dirty.length} files were already changed before the task and will be ignored by diff-guard: ${dirty.slice(0, 10).join(', ')}`);
  return 0;
}

function diffGuard(cfg) {
  const task = opt('task');
  let base = opt('base'), allow = optAll('allow'), preexisting = [];
  if (task) {
    if (!existsSync(taskPath(task))) { console.error(`no baseline for task "${task}": run task-start before dispatching`); return 2; }
    const t = JSON.parse(readFileSync(taskPath(task), 'utf8'));
    base = t.base; allow = allow.length ? allow : t.allow; preexisting = t.preexisting ?? [];
  }
  if (!base || !allow.length) { console.error('usage: diff-guard --task <name>   or   diff-guard --base <sha> --allow "<glob>"…\n(a baseline is required: comparing with HEAD misses changes the agent already committed)'); return 2; }
  if (git('cat-file', '-e', `${base}^{commit}`).code !== 0) { console.error(`baseline ${base} is not a commit in this repository`); return 2; }
  // Working tree vs baseline covers both committed and uncommitted changes; plus untracked files.
  const changed = [...new Set([...git('diff', '--name-only', base).out.split('\n'), ...git('ls-files', '--others', '--exclude-standard').out.split('\n')].filter(Boolean))]
    .filter((f) => !f.startsWith(`${STATE_DIR}/`) && f !== eventsFile(cfg) && f !== usageFile(cfg) && !preexisting.includes(f));
  const commits = git('rev-list', '--count', `${base}..HEAD`).out;
  const outside = changed.filter((f) => !matchesAny(f, allow));
  info(`baseline ${base.slice(0, 7)}${task ? ` (task "${task}")` : ''}, ${commits || 0} commits since`);
  if (task) logEvent(cfg, { type: 'task-end', task: taskId(task), outcome: outside.length ? 'failure' : 'success', summary: outside.length ? `diff-guard: ${outside.length} files outside the allow-list` : `diff-guard: ${changed.length} changed files, all allowed` });
  if (outside.length) { bad(`${outside.length} changed files outside the allow-list`); outside.forEach(info); return false; }
  ok(`${changed.length} changed files, all inside ${allow.join(', ')}`);
  return true;
}

// ---------- evidence packages (milestone-evidence skill) ----------
const evidenceDir = (cfg) => cfg.evidence?.dir ?? 'engineering-evidence';
function evidence(cfg) {
  if (!existsSync(join(root, evidenceDir(cfg)))) { info(`no ${evidenceDir(cfg)}/: no evidence packages to check`); return true; }
  const script = join(root, '.claude/skills/milestone-evidence/scripts/evidence.mjs');
  if (!existsSync(script)) { bad(`${evidenceDir(cfg)}/ exists but the milestone-evidence skill is not installed (upgrade the framework)`); return false; }
  const r = spawnSync(process.execPath, [script, 'validate', ...(opt('config') ? ['--config', opt('config')] : [])], { cwd: root, stdio: 'inherit' });
  return r.status === 0;
}

// ---------- main ----------
const USAGE = `app-boilerplate quality gate v${VERSION}
usage: node validate.mjs <command> [--config quality-gate.json]
  preflight                 environment: git clone, remote, identity, node, gh, browsers
  docs                      required docs, CATCH-UP freshness, decision log
  trace                     every story ID is named by an active test in a test file
  commands                  run quality-gate.json commands in order (none configured = FAIL)
  budget                    gzip size budgets (missing build output = FAIL)
  secrets                   scan tracked files for credentials
  overlap [--fetch] [--report out.json]
                            copied wording vs cached sources: PASS / FAIL / UNVERIFIED
  overlap --accept --id <id> --field <f> --run "<exact run>" --reason "<why>" --reviewer <name>
                            record ONE reviewed exception
  task-start <name> --allow <glob>…
                            record the baseline commit and allowed files before dispatching an agent
  diff-guard --task <name> | --base <sha> --allow <glob>…
                            only allowed files changed since the baseline (committed or not)
  evidence                  validate engineering-evidence/ packages (schema, arithmetic, privacy, frozen hashes)
  gate [--stage dev|release]
                            dev: preflight, secrets, commands, budget (Dev → QA, H3)
                            release (default): + docs, trace, overlap, evidence (H4, H5, CI on main);
                            evidence also runs in release whenever engineering-evidence/ exists`;

const main = async () => {
  if (!cmd || cmd === '--help' || cmd === '-h') { console.log(USAGE); return 0; }
  if (cmd === '--version') { console.log(VERSION); return 0; }
  const cfg = loadConfig();
  const steps = {
    preflight: () => preflight(cfg), docs: () => docs(cfg), trace: () => trace(cfg), commands: () => commands(cfg),
    budget: () => budget(cfg), secrets: () => secrets(cfg), overlap: () => overlap(cfg), 'diff-guard': () => diffGuard(cfg),
    evidence: () => evidence(cfg),
  };
  if (cmd === 'task-start') return taskStart(cfg);
  if (cmd === 'overlap' && flag('accept')) return cfg.overlap ? overlapAccept(cfg.overlap) : (console.error('overlap not configured'), 2);
  if (cmd === 'gate') {
    const stage = opt('stage', 'release');
    const listed = cfg.stages?.[stage];
    // Evidence packages are checked before anything reaches main, even in projects whose stages
    // predate the check: it can only fail on a broken or tampered package.
    const names = listed && stage === 'release' && !listed.includes('evidence') && existsSync(join(root, evidenceDir(cfg))) ? [...listed, 'evidence'] : listed;
    if (!names) { console.error(`unknown stage "${stage}"; configured: ${Object.keys(cfg.stages ?? {}).join(', ')}`); return 2; }
    const failed = [];
    for (const name of names) {
      if (name === 'overlap' && !cfg.overlap) continue;
      if (!steps[name]) { console.error(`stage "${stage}" lists unknown check "${name}"`); return 2; }
      console.log(paint('dim', `== ${name}`));
      const fn = name === 'preflight' ? () => preflight(cfg, { requiredOnly: true }) : steps[name];
      if (!(await fn())) { failed.push(name); if (name === 'commands') break; }
    }
    console.log(failed.length ? paint('red', `\nGATE (${stage}) FAILED: ${failed.join(', ')}`) : paint('green', `\nGATE (${stage}) PASSED`));
    return failed.length ? 1 : 0;
  }
  if (!steps[cmd]) { console.error(USAGE); return 2; }
  const r = await steps[cmd]();
  return typeof r === 'number' ? r : r ? 0 : 1;
};

// Importable (the milestone-evidence skill reuses SECRET_PATTERNS and globToRegExp); runs only as a script.
const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
