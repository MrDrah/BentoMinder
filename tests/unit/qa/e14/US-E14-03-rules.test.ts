// QA E14: US-E14-03/AC7 and ADR 015 §3: the Firestore security rules deny every client. Static check of the rules text
// (the rules emulator is not run here, so semantics beyond "only deny rules exist" are not claimed).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8').replace(/\/\/.*$/gm, '');

describe('US-E14-03/AC7 firestore.rules deny all client access', () => {
  it('US-E14-03/AC7 every allow statement is "if false"; no auth-, resource- or true-conditioned allow', () => {
    const allows = [...rules.matchAll(/allow\s+([^;]+);/g)].map((m) => (m[1] as string).trim());
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a).toMatch(/:\s*if\s+false$/);
    expect(rules).not.toMatch(/request\.auth|if\s+true|resource\.data|isSignedIn/);
  });
  it('US-E14-03/AC7 one catch-all match over every document, and no other match block that could widen access', () => {
    const matches = [...rules.matchAll(/match\s+(\S+)\s*\{/g)].map((m) => (m[1] as string).trim());
    expect(matches).toEqual(['/databases/{database}/documents', '/{document=**}']);
  });
});
