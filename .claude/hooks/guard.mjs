#!/usr/bin/env node
// PreToolUse guard for Claude Code. Reads the hook payload on stdin; exit 2 blocks the call and
// shows stderr to Claude.
//
// This is a GUARDRAIL against mistakes, not a security boundary: a determined command can always be
// written in a form these patterns don't recognise (a script file, an alias, a compiled program).
// The real boundaries are listed in .claude/SECURITY-MODEL.md (sandboxed execution, protected
// branches, required CI, environment approvals, secrets that never reach the agent's machine).
//
// Rules:
//   Edit/Write/MultiEdit/NotebookEdit  - paths listed under "generated" in quality-gate.json
//                                      - frozen evidence packages and engineering-evidence/index.json
//                                      - .env files (except .env.example)
//   Bash                               - git push --force/-f/--force-with-lease, any --no-verify,
//                                        git config --global
//                                      - shell writes (>, >>, tee, cp/mv destination, sed -i,
//                                        truncate, Set-Content, Out-File…) into a generated path
//                                      - reading, copying, sourcing or printing a .env file
import { readFileSync, existsSync } from 'node:fs';
import { join, relative, isAbsolute, sep } from 'node:path';

export function globToRegExp(glob) {
  let re = '';
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') { re += '(?:'; depth++; }
    else if (c === '}' && depth) { re += ')'; depth--; }
    else if (c === ',' && depth) re += '|';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const block = (msg) => { process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${msg}\n`); process.exit(2); };

let payload;
try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const root = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
const tool = payload.tool_name;
const input = payload.tool_input ?? {};

const ENV_FILE = /(^|\/)\.env(\.[^/\s]*)?$/;
const isEnv = (rel) => ENV_FILE.test(rel) && !rel.endsWith('.env.example');
const rel = (p) => {
  const clean = p.replace(/^['"]|['"]$/g, '').replace(/\\/g, '/');
  const r = isAbsolute(clean) || /^[A-Za-z]:\//.test(clean) ? relative(root, clean).split(sep).join('/') : clean.replace(/^\.\//, '');
  return r;
};
let generated = [];
let evidenceDir = 'engineering-evidence';
const cfgPath = join(root, 'quality-gate.json');
if (existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    generated = (cfg.generated ?? []).map((g) => (typeof g === 'string' ? { path: g } : g));
    evidenceDir = cfg.evidence?.dir ?? evidenceDir;
  } catch { /* the gate reports a bad config */ }
}
// Frozen evidence packages and their index are written only by evidence.mjs, never edited.
const frozenMsg = 'is part of a frozen evidence package. Frozen packages are never edited; publish a correction with "evidence.mjs collect --milestone <id> --revise --reason …".';
const indexPath = join(root, evidenceDir, 'index.json');
if (existsSync(indexPath)) {
  try {
    generated.push({ path: `${evidenceDir}/index.json`, msg: 'is written by "evidence.mjs freeze" only.' });
    for (const p of JSON.parse(readFileSync(indexPath, 'utf8')).packages ?? []) generated.push({ path: `${evidenceDir}/${p.path}/**`, msg: frozenMsg });
  } catch { /* evidence.mjs validate reports a bad index */ }
}
const generatedHit = (r) => generated.find((g) => globToRegExp(g.path).test(r));
const generatedMsg = (r, g) => (g.msg ? `${r} ${g.msg}` : `${r} is generated${g.from ? ` from ${g.from}` : ''}. Edit the source and run ${g.by ?? 'its generator'} instead.`);

if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const abs = input.file_path ?? input.notebook_path;
  if (!abs) process.exit(0);
  const r = rel(abs);
  if (isEnv(r)) block(`${r} holds secrets. Document variables in .env.example; the product owner sets real values.`);
  const g = generatedHit(r);
  if (g) block(generatedMsg(r, g));
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const c = String(input.command ?? '');
  if (/\bgit\s+push\b[^\n;&|]*\s(--force(?:-with-lease)?|-f)\b/.test(c)) block('force-push is not allowed. Fetch and merge/rebase instead.');
  if (/\s--no-verify\b/.test(c)) block('--no-verify skips the hooks that protect the repo. Fix the failing check instead.');
  if (/\bgit\s+config\s+--global\b/.test(c)) block('do not change global git config. Use git -c user.name=… -c user.email=… for one commit.');

  // Split into simple commands and look at each one's tokens.
  for (const part of c.split(/&&|\|\||;|\n|\|/)) {
    const tokens = part.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const words = tokens.map((t) => t.replace(/^['"]|['"]$/g, ''));
    const verb = (words[0] ?? '').toLowerCase();
    // 1) Secrets: any token naming a real .env file.
    const env = words.find((w) => isEnv(rel(w)));
    if (env) block(`${env} holds secrets and must not be read, copied or printed by the agent. Use .env.example to see which variables exist.`);
    // 2) Generated files: redirections into them, or write-type commands that name them.
    const redirect = part.match(/(?:^|[^<>])>>?\s*("[^"]*"|'[^']*'|[^\s;&|]+)/g) ?? [];
    for (const m of redirect) {
      const r = rel(m.replace(/^[^>]*>>?\s*/, ''));
      const g = generatedHit(r);
      if (g) block(generatedMsg(r, g));
    }
    // Copy/move: only the destination (last operand) is written. Reading a generated file, or
    // deleting one (it can be regenerated), is fine.
    const operands = words.slice(1).filter((w) => !w.startsWith('-'));
    const copyLike = /^(cp|mv|install|rsync|copy-item|move-item)$/.test(verb);
    const allArgs = /^(tee|truncate|dd|set-content|add-content|out-file|new-item)$/.test(verb) || (verb === 'sed' && words.some((w) => /^-i/.test(w) || w === '--in-place'));
    const targets = copyLike ? operands.slice(-1) : allArgs ? operands : [];
    for (const w of targets) {
      const r = rel(w.replace(/^(of=|-(?:path|filepath)\s*)/i, ''));
      const g = generatedHit(r);
      if (g) block(generatedMsg(r, g));
    }
  }
}
process.exit(0);
