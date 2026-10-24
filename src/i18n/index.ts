// Typed i18n (ADR 001): two bundled catalogs, `t(key, params)`, instant switch, works offline.
import { en } from './en.ts';
import { ja, type Catalog, type MessageKey } from './ja.ts';

export type Language = 'ja' | 'en';
export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: Params) => string;

export const catalogs: Readonly<Record<Language, Partial<Catalog>>> = { ja, en };

/** Index of the `}` closing the `{` at `open` (nesting aware), or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `one {…} other {…}` → { one: '…', other: '…' }. */
function options(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const m = /^\s*(=?\w+)\s*\{/.exec(body.slice(i));
    if (m === null) break;
    const open = i + m[0].length - 1;
    const end = closing(body, open);
    if (end < 0) break;
    out.set(m[1] as string, body.slice(open + 1, end));
    i = end + 1;
  }
  return out;
}

/**
 * Message formatting for the copy sheet's ICU subset (design/copy.md §0): `{name}`,
 * `{n, plural, one {# x} other {# xs}}`, `{n, selectordinal, …}` and `{k, select, a {…} other {…}}`.
 * `#` inside a plural branch is the number. Unknown parameters stay visible.
 */
export function interpolate(template: string, params: Params = {}, lang: Language = 'ja'): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const end = closing(template, open);
    if (end < 0) {
      out += template.slice(open);
      break;
    }
    const inner = template.slice(open + 1, end);
    const simple = /^(\w+)$/.exec(inner);
    const complex = /^(\w+),\s*(plural|selectordinal|select),(.*)$/s.exec(inner);
    if (simple !== null) {
      const value = params[simple[1] as string];
      out += value === undefined ? `{${inner}}` : String(value);
    } else if (complex !== null) {
      const [, name = '', kind, body = ''] = complex;
      const value = params[name];
      const opts = options(body);
      let branch: string | undefined;
      if (kind === 'select') branch = opts.get(String(value)) ?? opts.get('other');
      else {
        const n = Number(value);
        const rule = new Intl.PluralRules(lang, { type: kind === 'selectordinal' ? 'ordinal' : 'cardinal' }).select(n);
        branch = opts.get(`=${n}`) ?? opts.get(rule) ?? opts.get('other');
        branch = branch?.replace(/#/g, String(n));
      }
      out += branch === undefined ? `{${inner}}` : interpolate(branch, params, lang);
    } else out += `{${inner}}`;
    i = end + 1;
  }
  return out;
}

/**
 * US-E8-02/AC3: a key missing from the active catalog at runtime falls back to Japanese and,
 * in development, warns with the key name.
 */
export function createTranslator(
  lang: Language,
  options: { catalogs?: Readonly<Record<Language, Partial<Catalog>>>; warn?: (message: string) => void } = {},
): Translate {
  const source = options.catalogs ?? catalogs;
  return (key, params) => {
    const value = source[lang][key];
    if (value !== undefined) return interpolate(value, params, lang);
    options.warn?.(`[i18n] missing "${key}" in ${lang}; showing ja`);
    return interpolate(source.ja[key] ?? key, params, 'ja');
  };
}

export type { MessageKey } from './ja.ts';
