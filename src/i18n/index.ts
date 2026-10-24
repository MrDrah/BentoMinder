// Typed i18n (ADR 001): two bundled catalogs, `t(key, params)`, instant switch, works offline.
import { en } from './en.ts';
import { ja, type Catalog, type MessageKey } from './ja.ts';

export type Language = 'ja' | 'en';
export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: Params) => string;

export const catalogs: Readonly<Record<Language, Partial<Catalog>>> = { ja, en };

export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
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
    if (value !== undefined) return interpolate(value, params);
    options.warn?.(`[i18n] missing "${key}" in ${lang}; showing ja`);
    return interpolate(source.ja[key] ?? key, params);
  };
}

export type { MessageKey } from './ja.ts';
