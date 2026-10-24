#!/usr/bin/env node
// SessionStart hook: prints a short status block that Claude Code adds to the session context,
// so every session starts from CATCH-UP.md and a known environment state.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// No shell: git is a real executable, and a shell would mangle args like "%h %cs %s".
const sh = (c, a) => spawnSync(c, a, { cwd: root, encoding: 'utf8' });
const lines = ['[app-boilerplate] Session start'];

const catchUp = join(root, 'CATCH-UP.md');
if (existsSync(catchUp)) {
  const m = readFileSync(catchUp, 'utf8').match(/Last updated:\s*\**\s*(\d{4}-\d{2}-\d{2})/i);
  lines.push(`- CATCH-UP.md last updated ${m ? m[1] : 'unknown'}: read it before doing anything.`);
} else {
  lines.push('- No CATCH-UP.md: this looks like a new project. Run the Kick-off in CLAUDE.md §2.');
}
const inGit = sh('git', ['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';
if (!inGit) lines.push('- WARNING: not a git repository. If this is a downloaded zip, clone the repo instead.');
else {
  lines.push(`- Last commit: ${sh('git', ['log', '-1', '--format=%h %cs %s']).stdout?.trim() || 'none'}`);
  const dirty = sh('git', ['status', '--porcelain']).stdout?.trim().split('\n').filter(Boolean).length ?? 0;
  if (dirty) lines.push(`- ${dirty} uncommitted changes in the working tree.`);
  if (!sh('git', ['config', 'user.email']).stdout?.trim()) lines.push('- No git identity configured (see the release skill).');
}
// Token usage: snapshot Claude Code's session logs into the project's usage log before they are
// cleaned up. Only for projects that opted in to milestone evidence; never blocks the session.
const evidenceScript = join(root, '.claude/skills/milestone-evidence/scripts/evidence.mjs');
try {
  if (existsSync(evidenceScript) && JSON.parse(readFileSync(join(root, 'quality-gate.json'), 'utf8')).evidence) {
    const r = spawnSync(process.execPath, [evidenceScript, 'usage', '--quiet'], { cwd: root, encoding: 'utf8', timeout: 20000 });
    const out = r.stdout?.trim();
    if (out) lines.push(`- ${out}`);
  }
} catch { /* no or unreadable quality-gate.json: nothing to snapshot */ }
lines.push('- Full environment check: node .claude/skills/quality-gate/scripts/validate.mjs preflight');
console.log(lines.join('\n'));
