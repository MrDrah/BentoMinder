// Dictionary matching (domain dictionary §1 rules 1–7, §7 ambiguity groups): finds the
// dictionary ids in one lunch-item text or one listed-ingredient text. Deterministic, no AI, no
// typo correction. Counting, collapse and verdicts live in assess.ts; this module only finds.
import type { Dictionary } from '../schema/dictionary.ts';
import { normalizeForMatch } from '../text/normalize.ts';
import { dictIndex } from './dictionary-index.ts';

export interface FoundId {
  id: string;
  /** Position in the normalised text (for the order of first appearance). */
  pos: number;
}

export interface UnresolvedForm {
  groupId: string;
  surface: string;
  pos: number;
}

export interface TextMatch {
  /** Distinct found ids in order of first appearance. Seasonings are included (assess.ts leaves them out). */
  found: FoundId[];
  /** Ambiguity-group forms that no §7 rule resolved: the review asks, U counts them. */
  unresolved: UnresolvedForm[];
  /** Matches that are resolved automatically but still flagged on review (amb-soba: buckwheat). */
  flags: string[];
}

export type MatchContext =
  | { kind: 'item' }
  /** A listed ingredient; `neighbourSeasoning`: a neighbouring list entry is a seasoning (amb-sake). */
  | { kind: 'ingredient'; neighbourSeasoning: boolean };

/** Dictionary §7: groups that also have a reading that is not a food (stored as `resolvedIds: []`). */
export const NON_FOOD_READINGS: Readonly<Record<string, string>> = { 'amb-aji': '味', 'amb-nashi': '無し' };

export interface Matcher {
  match(text: string, context?: MatchContext): TextMatch;
}

type IngEntry = { type: 'ing'; id: string } | { type: 'amb'; id: string };
interface FormTables {
  dish: Map<string, string>;
  dishMax: number;
  ing: Map<string, IngEntry>;
  ingMax: number;
  /** Normalised surface forms per ingredient id, for the conditional name ingredients of a dish. */
  ingForms: Map<string, string[]>;
}

const KANA_ONLY = /^[ぁ-ゖー]+$/u;
const COVERED = '\u0001';
/** Dictionary §1 rule 3: kana forms need at least 2 characters. */
const usable = (form: string): boolean => form !== '' && !(KANA_ONLY.test(form) && [...form].length < 2);

const tableCache = new WeakMap<Dictionary, FormTables>();

function tables(dict: Dictionary): FormTables {
  const hit = tableCache.get(dict);
  if (hit !== undefined) return hit;
  const dish = new Map<string, string>();
  const ing = new Map<string, IngEntry>();
  const ingForms = new Map<string, string[]>();
  for (const d of dict.dishes) {
    for (const f of d.forms) {
      const n = normalizeForMatch(f);
      if (usable(n) && !dish.has(n)) dish.set(n, d.id);
    }
  }
  for (const g of dict.ambiguity) {
    for (const f of g.forms) {
      const n = normalizeForMatch(f);
      if (usable(n) && !ing.has(n)) ing.set(n, { type: 'amb', id: g.id });
    }
  }
  for (const i of dict.ingredients) {
    const normalised = i.forms.map(normalizeForMatch).filter(usable);
    ingForms.set(i.id, normalised);
    for (const n of normalised) if (!ing.has(n)) ing.set(n, { type: 'ing', id: i.id });
  }
  const max = (m: Map<string, unknown>) => Math.max(0, ...[...m.keys()].map((k) => k.length));
  const t: FormTables = { dish, dishMax: max(dish), ing, ingMax: max(ing), ingForms };
  tableCache.set(dict, t);
  return t;
}

/** Longest match at each position, left to right; the matched text is not rescanned. */
function scan<T>(text: string, forms: Map<string, T>, max: number, visit: (start: number, end: number, value: T) => void): void {
  let i = 0;
  while (i < text.length) {
    let hit = false;
    for (let len = Math.min(max, text.length - i); len >= 1; len -= 1) {
      const value = forms.get(text.slice(i, i + len));
      if (value !== undefined) {
        visit(i, i + len, value);
        i += len;
        hit = true;
        break;
      }
    }
    if (!hit) i += 1;
  }
}

type Resolution = { kind: 'ids'; ids: string[] } | { kind: 'ignored' } | { kind: 'ask' };

interface Token {
  start: number;
  end: number;
  entry: IngEntry;
}

export function createMatcher(dict: Dictionary): Matcher {
  const t = tables(dict);
  const idx = dictIndex(dict);

  function resolve(group: string, rest: string, tok: Token, prev: Token | null, ctx: MatchContext): Resolution {
    const adjacent = prev !== null && prev.end === tok.start;
    const before = rest.slice(0, tok.start);
    const after = rest.slice(tok.end);
    switch (group) {
      case 'amb-curry':
        // 「カレー味」「カレー風味」「カレー炒め」「カレー煮」 → the flavour, curry powder
        return ['味', '風味', '炒め', '煮'].some((s) => after.startsWith(s)) ? { kind: 'ids', ids: ['ing-curry-powder'] } : { kind: 'ask' };
      case 'amb-aji':
        // preceded by a seasoning or flavour word (「しおあじ」「みそあじ」「カレーあじ」) → taste suffix
        if (adjacent && prev !== null) {
          const flavour = (prev.entry.type === 'ing' && idx.isSeasoning(prev.entry.id)) || (prev.entry.type === 'amb' && prev.entry.id === 'amb-curry');
          if (flavour) return { kind: 'ignored' };
        }
        return { kind: 'ask' };
      case 'amb-momo':
        // 「豚もも」 → pork, which the 豚 token already found
        return adjacent && prev !== null && prev.entry.type === 'ing' && prev.entry.id === 'ing-pork' ? { kind: 'ignored' } : { kind: 'ask' };
      case 'amb-nashi':
        // directly after a noun (「給食なし」) → "none"; a standalone item 「なし」 asks
        return tok.start > 0 && before !== '' ? { kind: 'ignored' } : { kind: 'ask' };
      case 'amb-soba':
        return ['焼き', 'やき', '中華', 'ちゅうか'].some((s) => before.endsWith(s)) ? { kind: 'ids', ids: ['ing-chinese-noodles'] } : { kind: 'ids', ids: ['ing-soba'] };
      case 'amb-tako':
        return { kind: 'ids', ids: ['ing-octopus'] };
      case 'amb-sake':
        // in a dish name → salmon; in an ingredient list next to seasonings → ask
        return ctx.kind === 'ingredient' && ctx.neighbourSeasoning ? { kind: 'ask' } : { kind: 'ids', ids: ['ing-salmon'] };
      case 'amb-pan':
        // 「フライパン」 is not a food; 「パン粉」 is the longer ingredient form
        return before.endsWith('ふらい') ? { kind: 'ignored' } : { kind: 'ids', ids: ['ing-bread'] };
      default:
        return { kind: 'ask' };
    }
  }

  function match(text: string, ctx: MatchContext = { kind: 'item' }): TextMatch {
    const found: FoundId[] = [];
    const seen = new Set<string>();
    const add = (id: string, pos: number) => {
      if (!seen.has(id)) {
        seen.add(id);
        found.push({ id, pos });
      }
    };
    const unresolved: UnresolvedForm[] = [];
    const flags: string[] = [];
    const normalised = normalizeForMatch(text);

    // Dish pass first (items only): longest match, a dish adds the ingredients named in its name.
    let rest = normalised;
    if (ctx.kind === 'item') {
      const chars = normalised.split('');
      scan(normalised, t.dish, t.dishMax, (start, end, dishId) => {
        add(dishId, start);
        const dish = idx.dishes.get(dishId);
        const matched = normalised.slice(start, end);
        for (const ingredientId of dish?.nameIngredientIds ?? []) if (ingredientId.startsWith('ing-')) add(ingredientId, start);
        for (const ingredientId of dish?.conditionalNameIds ?? []) {
          // only when the dish form literally names the ingredient (「鶏のから揚げ」, 「ポークカレー」)
          if (ingredientId.startsWith('ing-') && (t.ingForms.get(ingredientId) ?? []).some((f) => matched.includes(f))) add(ingredientId, start);
        }
        for (let i = start; i < end; i += 1) chars[i] = COVERED;
      });
      rest = chars.join('');
    }

    // Ingredient pass: the remaining text (items) or the whole listed ingredient.
    let prev: Token | null = null;
    scan(rest, t.ing, t.ingMax, (start, end, entry) => {
      const tok: Token = { start, end, entry };
      if (entry.type === 'ing') add(entry.id, start);
      else {
        const surface = rest.slice(start, end);
        const r = resolve(entry.id, rest, tok, prev, ctx);
        if (r.kind === 'ids') {
          r.ids.forEach((id) => add(id, start));
          if (entry.id === 'amb-soba') flags.push('amb-soba');
        } else if (r.kind === 'ask') unresolved.push({ groupId: entry.id, surface, pos: start });
      }
      prev = tok;
    });
    return { found, unresolved, flags };
  }

  return { match };
}

const matcherCache = new WeakMap<Dictionary, Matcher>();
export function matcherFor(dict: Dictionary): Matcher {
  let m = matcherCache.get(dict);
  if (m === undefined) {
    m = createMatcher(dict);
    matcherCache.set(dict, m);
  }
  return m;
}
