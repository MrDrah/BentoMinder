// US-E16-01 (design/motion.md): the motion CSS is written to the spec: moving rules sit inside
// prefers-reduced-motion: no-preference, only cheap properties are animated, durations are tokens <= 250 ms.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const tokens = read('design/tokens.css');
const css = ['global', 'forms', 'calendar', 'family', 'recommend'].map((n) => read(`src/ui/styles/${n}.css`)).join('\n');

/** The text of `@keyframes name { ... }` (brace-balanced). */
function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name} `);
  expect(start, `@keyframes ${name}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('unbalanced');
}

describe('motion tokens', () => {
  it('US-E16-01/AC7 the three motion tokens exist and none of the durations exceeds 250 ms', () => {
    expect(tokens).toMatch(/--duration-sheet:\s*240ms/);
    expect(tokens).toMatch(/--rise-offset:\s*12px/);
    expect(tokens).toMatch(/--press-scale:\s*0\.97/);
    for (const name of ['fast', 'base', 'sheet']) {
      const ms = Number(new RegExp(`--duration-${name}:\\s*(\\d+)ms`).exec(tokens)?.[1]);
      expect(ms).toBeLessThanOrEqual(250);
    }
  });
  it('US-E16-01/AC6 the reduced-motion block zeroes the durations, the rise and the press scale', () => {
    const reduce = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const t of ['--duration-fast: 0ms', '--duration-base: 0ms', '--duration-sheet: 0ms', '--rise-offset: 0px', '--press-scale: 1']) expect(reduce).toContain(t);
  });
});

describe('keyframes', () => {
  it('US-E16-01/AC7 keyframes animate only opacity and transform', () => {
    for (const k of ['fade-in', 'sheet-up', 'dialog-in', 'sheet-in-centred']) {
      const body = keyframes(k).replace(/^[^{]*\{/, '');
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['opacity', 'transform'], `${k} animates ${p}`).toContain(p);
    }
  });
  it('US-E16-01/AC2 the phone sheet starts fully below the viewport', () => {
    expect(keyframes('sheet-up')).toContain('translateY(100%)');
  });
  it('US-E16-01/AC3 the centred keyframes carry the centring translate in both frames and rise by the token', () => {
    const k = keyframes('sheet-in-centred');
    expect(k).toContain('translate(-50%, calc(-50% + var(--rise-offset)))');
    expect(k).toContain('translate(-50%, -50%)');
    expect(keyframes('dialog-in')).toContain('translateY(var(--rise-offset))');
  });
});

describe('where motion lives', () => {
  it('US-E16-01/AC6 every new animation or scale is inside a no-preference media block', () => {
    // Strip the no-preference blocks (brace-balanced); nothing that moves may remain outside them.
    let rest = css;
    for (;;) {
      const i = rest.search(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{/);
      if (i < 0) break;
      let depth = 0;
      let j = rest.indexOf('{', i);
      for (; j < rest.length; j++) {
        if (rest[j] === '{') depth++;
        if (rest[j] === '}' && --depth === 0) break;
      }
      rest = rest.slice(0, i) + rest.slice(j + 1);
    }
    const outside = rest.split('\n').filter((l) => /\b(animation|transition)(-name)?\s*:|scale\(/.test(l));
    // the spinners, the import progress bar and the reminder banner keep their own reduced-motion rules (not part of this story)
    const allowed = outside.filter((l) => !/auth-spin|progress|reminder-in|animation:\s*none/.test(l));
    expect(allowed).toEqual([]);
  });
  it('US-E16-01/AC1 the text variants are not scaled, and disabled and busy buttons reset the scale', () => {
    const forms = read('src/ui/styles/forms.css');
    expect(forms).toContain('.btn:not(.btn--text, .btn--destructive-text):active');
    expect(forms).toContain(".btn[aria-busy='true']:active");
    expect(forms).toContain('.btn:disabled:active');
  });
});
