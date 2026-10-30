// QA: oracle independence rules (tests/oracle/README.md): oracle code imports nothing from src/ and no package.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'tests', 'oracle', 'impl');

describe('QA oracle independence', () => {
  it('US-E4-01/AC1 US-E5-03/AC2 oracle implementations import only node: built-ins and sibling oracle files', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(dir, f), 'utf8');
      const specs = [...text.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      for (const s of specs) {
        expect(s.startsWith('node:') || s.startsWith('./'), `${f} imports ${s}`).toBe(true);
        expect(s, `${f} must not reach into src/`).not.toMatch(/src\//);
      }
    }
  });
});
