// Button variants (design/components.md 1.3): the text/fill pair of every state in both themes reads at
// >= 4.5:1 (US-NF-02/AC1), and the cascade keeps variant rules above the base .btn rule.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('design/tokens.css', 'utf8');
const forms = readFileSync('src/ui/styles/forms.css', 'utf8');
const global = readFileSync('src/ui/styles/global.css', 'utf8');

function block(start: string): Record<string, string> {
  const i = tokens.indexOf(start);
  const body = tokens.slice(tokens.indexOf('{', i) + 1, tokens.indexOf('\n}', i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1] as string] = m[2] as string;
  return out;
}
const light = block(':root {');
const dark = { ...light, ...block('[data-theme="dark"] {') };

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

// [name, text token, fill token] for every state in the spec table.
const pairs: Array<[string, string, string]> = [
  ['primary rest', 'ink-inverse', 'accent-strong'],
  ['primary hover/active', 'ink-inverse', 'accent-strong-hover'],
  ['secondary rest', 'ink-1', 'surface-2'],
  ['secondary hover/active', 'ink-1', 'surface-3'],
  ['text rest', 'ink-1', 'surface-1'],
  ['text active pill', 'ink-1', 'surface-3'],
  ['destructive rest', 'ink-inverse', 'danger-strong'],
  ['destructive hover/active', 'ink-inverse', 'danger-strong-hover'],
  ['destructive-text rest', 'danger', 'surface-1'],
  ['destructive-text active pill', 'danger', 'surface-3'],
  ['disabled', 'ink-3', 'surface-3'],
  ['disabled text variant', 'ink-3', 'surface-1'],
];

describe('button state pairs (components 1.3)', () => {
  for (const [theme, set] of [['light', light], ['dark', dark]] as const) {
    for (const [name, fg, bg] of pairs) {
      it(`US-NF-02/AC1: ${theme} ${name} (${fg} on ${bg}) >= 4.5:1`, () => {
        expect(set[fg], fg).toBeDefined();
        expect(set[bg], bg).toBeDefined();
        expect(ratio(set[fg] as string, set[bg] as string)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('US-NF-02/AC3: the base .btn rule has zero specificity so variants win', () => {
    expect(global).toMatch(/^:where\(\.btn\)\s*\{/m);
    expect(global).not.toMatch(/^\.btn\s*\{/m);
    expect(forms).toMatch(/^\.btn--primary\s*\{[^}]*background:\s*var\(--accent-strong\)/m);
  });
});
