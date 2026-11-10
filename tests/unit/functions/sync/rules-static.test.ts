// US-E15-09/AC9 and AC10 (ADR 016 section 2.2): the Firestore rules stay deny-all. All access goes through the Function
// (Admin SDK), so a static check of the file is the second layer: every `allow` is `if false`, whatever else is added.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Strips comments, then returns every `allow ...;` statement with its condition. */
export function parseAllows(rules: string): { methods: string[]; condition: string | null; text: string }[] {
  const code = rules.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const out: { methods: string[]; condition: string | null; text: string }[] = [];
  for (const m of code.matchAll(/\ballow\b([^;]*);/g)) {
    const text = (m[1] ?? '').trim();
    const parts = /^([a-z,\s]+?)\s*(?::\s*if\s+([\s\S]+))?$/.exec(text);
    out.push({ methods: (parts?.[1] ?? text).split(',').map((s) => s.trim()), condition: parts?.[2]?.trim() ?? null, text });
  }
  return out;
}

export const everyAllowIsFalse = (rules: string): boolean => {
  const allows = parseAllows(rules);
  return allows.length > 0 && allows.every((a) => a.condition === 'false');
};

const RULES = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

describe('firestore.rules is deny-all for clients', () => {
  it('US-E15-09/AC9 every allow statement in firestore.rules is `if false`, and there is at least one', () => {
    const allows = parseAllows(RULES);
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a.condition, a.text).toBe('false');
    expect(everyAllowIsFalse(RULES)).toBe(true);
  });

  it('US-E15-09/AC9 the only match block is the catch-all document path, so the proxy counters and every new collection are closed', () => {
    const code = RULES.replace(/\/\/[^\n]*/g, '');
    const matches = [...code.matchAll(/\bmatch\s+(\S+)\s*\{/g)].map((m) => m[1]);
    expect(matches).toEqual(['/databases/{database}/documents', '/{document=**}']);
    expect(code).not.toMatch(/\bfunction\b|\bexists\s*\(|\bget\s*\(|request\.auth/); // nothing conditional can sneak in
    expect(code).toMatch(/allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/);
  });

  it('US-E15-09/AC10 the checker itself catches a rule that opens something (so a regression would block the release gate)', () => {
    const open = (extra: string): string => `${RULES.replace(/\}\s*\}\s*$/, '')}${extra}}}`;
    expect(everyAllowIsFalse(open('match /families/{f} { allow read: if request.auth != null; }'))).toBe(false);
    expect(everyAllowIsFalse(open('match /x/{y} { allow write; }'))).toBe(false);
    expect(everyAllowIsFalse(open('match /x/{y} { allow read: if true; }'))).toBe(false);
    expect(everyAllowIsFalse('rules_version = "2"; service cloud.firestore { match /databases/{d}/documents { } }')).toBe(false); // no allow at all is not "proven"
    expect(everyAllowIsFalse(`${RULES}\n// allow read: if true;`)).toBe(true); // a comment opens nothing
  });

  it('US-E15-09/AC10 the web source imports no Firestore SDK (all family access is HTTP to the function)', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(n)) out.push(p);
      }
      return out;
    };
    const offenders = walk(join(process.cwd(), 'src')).filter((f) => /firebase\/firestore|@firebase\/firestore|firebase-admin/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
