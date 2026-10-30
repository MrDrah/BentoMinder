// Assessment oracle (tests/oracle/assessment-oracle.md): a deliberately naive re-implementation of
// BR-04 / BR-05 / BR-25. Independence rules: imports nothing from src/ and no package; Node built-ins
// only; dates are plain strings, matching is an O(n^2) substring scan. Reads the shipped data file only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Dict {
  categories: { id: string; parentId: string | null }[];
  ingredients: { id: string; ja: string; forms: string[]; categoryIds: string[]; parentIngredientId: string | null; seasoning: boolean }[];
  dishes: { id: string; ja: string; categoryId: string | null; forms: string[]; nameIngredientIds: string[]; conditionalNameIds: string[]; definingIngredientId: string | null }[];
  ambiguity: { id: string; forms: string[]; candidateIds: string[] }[];
}
export const loadDict = (): Dict => JSON.parse(readFileSync(join(process.cwd(), 'data', 'dictionary.json'), 'utf8')) as Dict;

export interface OItem { text: string; kind: string; resolvedIds?: string[] }
export interface ODay { date: string; items: OItem[]; ingredientsStatus: 'listed' | 'not-listed'; ingredients?: { text: string }[] }
export interface OMenu { days: ODay[]; noLunchDays: { date: string; reason: string }[] }
export interface OProfile { likedIds: string[]; dislikedIds: string[] }
export interface OResult {
  calculatedState: string;
  state: string;
  key: string;
  dislikedCount: number;
  likedCount: number;
  likedIds: string[];
  dislikedIds: string[];
  unmatchedCount: number;
  assessedCount: number;
}

export function normalise(s: string): string {
  let t = s.normalize('NFKC');
  let out = '';
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    out += c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
  }
  t = out;
  let r = '';
  for (const ch of t) if (!/[\s・()（）「」『』【】[\]〔〕［］]/u.test(ch)) r += ch;
  return r;
}
const kanaOnly = (s: string) => [...s].every((ch) => (ch >= 'ぁ' && ch <= 'ゖ') || ch === 'ー');
const usable = (s: string) => s !== '' && !(kanaOnly(s) && [...s].length < 2);

interface Found { id: string; pos: number }
interface Match { found: Found[]; unresolved: string[] }

export class OracleAssessor {
  private ingById = new Map<string, Dict['ingredients'][number]>();
  private dishById = new Map<string, Dict['dishes'][number]>();
  private catById = new Map<string, Dict['categories'][number]>();
  private ambById = new Map<string, Dict['ambiguity'][number]>();
  private dishForms: { n: string; id: string }[] = [];
  private ingForms: { n: string; kind: 'ing' | 'amb'; id: string }[] = [];
  private seasoningForms: string[] = [];

  private dict: Dict;
  constructor(dict: Dict) {
    this.dict = dict;
    for (const i of dict.ingredients) this.ingById.set(i.id, i);
    for (const x of dict.dishes) this.dishById.set(x.id, x);
    for (const c of dict.categories) this.catById.set(c.id, c);
    for (const g of dict.ambiguity) this.ambById.set(g.id, g);
    for (const x of dict.dishes) for (const f of x.forms) if (usable(normalise(f))) this.dishForms.push({ n: normalise(f), id: x.id });
    for (const g of dict.ambiguity) for (const f of g.forms) if (usable(normalise(f))) this.ingForms.push({ n: normalise(f), kind: 'amb', id: g.id });
    for (const i of dict.ingredients) {
      for (const f of i.forms) if (usable(normalise(f))) this.ingForms.push({ n: normalise(f), kind: 'ing', id: i.id });
      if (i.seasoning) for (const f of i.forms) if (usable(normalise(f))) this.seasoningForms.push(normalise(f));
    }
  }

  // ---- matcher (text-level checks M01..M15) ----
  match(text: string, listed = false, neighbourSeasoning = false): Match {
    const t = [...normalise(text)];
    const covered: boolean[] = t.map(() => false);
    const found: Found[] = [];
    const unresolved: string[] = [];
    const add = (id: string, pos: number) => { if (!found.some((f) => f.id === id)) found.push({ id, pos }); };
    const at = (pos: number, form: string) => form.length > 0 && [...form].every((ch, k) => t[pos + k] === ch && !covered[pos + k]);

    if (!listed) {
      let pos = 0;
      while (pos < t.length) {
        let best: { n: string; id: string } | null = null;
        for (const f of this.dishForms) if (at(pos, f.n) && (best === null || [...f.n].length > [...best.n].length)) best = f;
        if (best === null) { pos++; continue; }
        const len = [...best.n].length;
        for (let k = 0; k < len; k++) covered[pos + k] = true;
        const dish = this.dishById.get(best.id)!;
        add(dish.id, pos);
        for (const n of dish.nameIngredientIds) if (n.startsWith('ing-')) add(n, pos);
        for (const n of dish.conditionalNameIds) {
          if (!n.startsWith('ing-')) continue;
          const ing = this.ingById.get(n);
          if (ing !== undefined && ing.forms.some((f) => usable(normalise(f)) && best!.n.includes(normalise(f)))) add(n, pos);
        }
        pos += len;
      }
    }
    let pos = 0;
    while (pos < t.length) {
      if (covered[pos]) { pos++; continue; }
      let best: { n: string; kind: 'ing' | 'amb'; id: string } | null = null;
      for (const f of this.ingForms) {
        if (!at(pos, f.n)) continue;
        const better = best === null || [...f.n].length > [...best.n].length || ([...f.n].length === [...best.n].length && f.kind === 'amb' && best.kind === 'ing');
        if (better) best = f;
      }
      if (best === null) { pos++; continue; }
      const len = [...best.n].length;
      for (let k = 0; k < len; k++) covered[pos + k] = true;
      if (best.kind === 'ing') add(best.id, pos);
      else this.resolveAmbiguity(best.id, t, pos, len, listed, neighbourSeasoning, add, unresolved);
      pos += len;
    }
    return { found, unresolved };
  }

  private resolveAmbiguity(gid: string, t: string[], pos: number, len: number, listed: boolean, neighbourSeasoning: boolean, add: (id: string, pos: number) => void, unresolved: string[]) {
    const before = t.slice(0, pos).join('');
    const after = t.slice(pos + len).join('');
    switch (gid) {
      case 'amb-pan': // longest match only; フライパン is not a food
        if (before.endsWith('ふらい')) return;
        add('ing-bread', pos);
        return;
      case 'amb-tako':
        add('ing-octopus', pos);
        return;
      case 'amb-soba':
        add('ing-soba', pos);
        return;
      case 'amb-curry':
        if (/^(あじ|ふうみ|いため|に)/.test(after)) add('ing-curry-powder', pos);
        else unresolved.push(gid);
        return;
      case 'amb-aji':
        if (this.seasoningForms.some((f) => before.endsWith(f)) || before.endsWith('かれー')) return; // taste suffix
        unresolved.push(gid);
        return;
      case 'amb-momo':
        if (before.endsWith('とり')) add('ing-chicken-thigh', pos);
        else if (before.endsWith('ぶた')) add('ing-pork', pos);
        else unresolved.push(gid);
        return;
      case 'amb-nashi':
        if (pos > 0) return; // directly after a noun: "none"
        unresolved.push(gid);
        return;
      case 'amb-sake':
        // a menu item is a dish name (salmon); only a listed ingredient next to a seasoning is asked about
        if (listed && neighbourSeasoning) unresolved.push(gid);
        else add('ing-salmon', pos);
        return;
      default:
        unresolved.push(gid);
    }
  }

  // ---- dictionary walks ----
  private ingAncestors(id: string): string[] {
    const out: string[] = [];
    let cur = this.ingById.get(id)?.parentIngredientId ?? null;
    while (cur !== null && !out.includes(cur)) { out.push(cur); cur = this.ingById.get(cur)?.parentIngredientId ?? null; }
    return out;
  }
  private catChain(id: string): string[][] {
    const direct = this.ingById.get(id)?.categoryIds ?? (this.dishById.get(id)?.categoryId ? [this.dishById.get(id)!.categoryId!] : []);
    const levels: string[][] = [];
    let cur = [...new Set(direct)];
    const seen = new Set<string>();
    while (cur.length) {
      levels.push(cur);
      cur.forEach((c) => seen.add(c));
      const next: string[] = [];
      for (const c of cur) { const p = this.catById.get(c)?.parentId ?? null; if (p && !seen.has(p) && !next.includes(p)) next.push(p); }
      cur = next;
    }
    return levels;
  }

  // ---- the rule ----
  assess(date: string, menu: OMenu | null, profile: OProfile | null, override: string | null): OResult | null {
    if (menu === null) return null;
    const nl = menu.noLunchDays.find((n) => n.date === date);
    const day = menu.days.find((x) => x.date === date);
    const base = { dislikedCount: 0, likedCount: 0, likedIds: [] as string[], dislikedIds: [] as string[], unmatchedCount: 0, assessedCount: 0 };
    if (nl !== undefined) return { calculatedState: 'no-school-lunch', state: 'no-school-lunch', key: 'assess.noLunch', ...base };
    if (day === undefined || !day.items.some((i) => i.kind !== 'snack')) return null;
    let calc: string;
    let key: string;
    let res = { ...base };
    if (profile === null || (profile.likedIds.length === 0 && profile.dislikedIds.length === 0)) {
      calc = 'not-assessed';
      key = 'assess.notAssessed';
    } else {
      const c = this.count(day, profile);
      res = { dislikedCount: c.D, likedCount: c.L, likedIds: c.likedIds, dislikedIds: c.dislikedIds, unmatchedCount: c.U, assessedCount: c.A };
      const unknown = 2 * c.U > c.A;
      if (c.D >= 2) [calc, key] = ['low-preference', 'assess.low'];
      else if (c.D === 1 && c.L === 0) [calc, key] = ['low-preference', 'assess.low'];
      else if (c.D === 1) [calc, key] = ['mixed-uncertain', 'assess.mixedOne'];
      else if (c.L >= 1 && !unknown) [calc, key] = ['likely-enjoyable', 'assess.likely'];
      else if (unknown) [calc, key] = ['mixed-uncertain', 'assess.mixedUnknown'];
      else [calc, key] = ['mixed-uncertain', 'assess.mixedNeutral'];
    }
    if (override !== null) return { calculatedState: calc, state: override, key: 'assess.override', ...res };
    return { calculatedState: calc, state: calc, key, ...res };
  }

  private count(day: ODay, profile: OProfile) {
    const likes = new Set(profile.likedIds);
    const dislikes = new Set(profile.dislikedIds);
    interface Item { ids: Set<string>; dishes: Set<string>; uncertain: boolean }
    const items: Item[] = [];
    for (const it of day.items) {
      if (it.kind === 'snack') continue;
      const m = this.match(it.text);
      const ids = new Set(m.found.map((f) => f.id));
      let unresolved = m.unresolved.length > 0;
      let parentResolved = false;
      if (it.resolvedIds !== undefined && unresolved) {
        const cands = new Set(m.unresolved.flatMap((g) => this.ambById.get(g)?.candidateIds ?? []));
        for (const r of it.resolvedIds) if (cands.has(r)) ids.add(r);
        unresolved = false;
        parentResolved = true; // a choice (even [] = non-food reading) ends the ambiguity and the item is not counted in U
      }
      items.push({ ids, dishes: new Set([...ids].filter((i) => i.startsWith('dish-'))), uncertain: !parentResolved && (unresolved || ids.size === 0) });
    }
    const listedIds = new Set<string>();
    if (day.ingredientsStatus === 'listed') {
      const list = day.ingredients ?? [];
      const hasSeasoning = (txt: string | undefined) => txt !== undefined && this.match(txt, true, false).found.some((f) => this.ingById.get(f.id)?.seasoning === true);
      list.forEach((ing, i) => {
        const m = this.match(ing.text, true, hasSeasoning(list[i - 1]?.text) || hasSeasoning(list[i + 1]?.text));
        m.found.forEach((f) => listedIds.add(f.id));
      });
    }
    // foods
    const dishFoods = new Map<string, string | null>(); // dish id -> defining ingredient joined in some item
    const absorbed = new Set<string>();
    const allDish = new Set<string>();
    for (const it of items) for (const d of it.dishes) {
      allDish.add(d);
      const g = this.dishById.get(d)!.definingIngredientId;
      if (g !== null && it.ids.has(g)) { dishFoods.set(d, g); absorbed.add(g); }
      else if (!dishFoods.has(d)) dishFoods.set(d, null);
    }
    const ingIds = new Set<string>(listedIds);
    for (const it of items) for (const i of it.ids) if (!i.startsWith('dish-')) ingIds.add(i);
    const remaining = [...ingIds].filter((i) => !i.startsWith('dish-') && !absorbed.has(i));
    const folded = new Set<string>();
    const foods: { rep: string; dish: string | null; members: string[] }[] = [];
    for (const x of remaining) for (const a of this.ingAncestors(x)) if (remaining.includes(a)) folded.add(a);
    for (const [d, g] of dishFoods) foods.push({ rep: d, dish: d, members: g === null ? [] : [g] });
    for (const x of remaining) {
      if (folded.has(x)) continue;
      foods.push({ rep: x, dish: null, members: [x, ...this.ingAncestors(x).filter((a) => remaining.includes(a))] });
    }
    const verdict = (f: (typeof foods)[number]): 'like' | 'dislike' | null => {
      const lone = f.dish === null && f.members.length === 1 && this.ingById.get(f.rep)?.seasoning === true;
      const levels: string[][] = [f.members];
      if (!lone) {
        const anc = f.members.map((m) => this.ingAncestors(m));
        const depth = Math.max(0, ...anc.map((a) => a.length));
        for (let k = 0; k < depth; k++) levels.push(anc.map((a) => a[k]).filter((x): x is string => x !== undefined));
        if (f.dish !== null) levels.push([f.dish]);
        const carriers = [...f.members, ...(f.dish === null ? [] : [f.dish])];
        const chains = carriers.map((c) => this.catChain(c));
        const cd = Math.max(0, ...chains.map((c) => c.length));
        for (let k = 0; k < cd; k++) levels.push(chains.flatMap((c) => c[k] ?? []));
      }
      for (const lv of levels) {
        if (lv.some((e) => dislikes.has(e))) return 'dislike';
        if (lv.some((e) => likes.has(e))) return 'like';
      }
      return null;
    };
    const verdicts = foods.map((f) => ({ f, v: verdict(f) }));
    const dis = verdicts.filter((x) => x.v === 'dislike');
    const lik = verdicts.filter((x) => x.v === 'like');
    return {
      D: dis.length,
      L: lik.length,
      U: items.filter((i) => i.uncertain).length,
      A: items.length,
      dislikedIds: dis.map((x) => x.f.rep),
      likedIds: lik.map((x) => x.f.rep),
    };
  }
}
