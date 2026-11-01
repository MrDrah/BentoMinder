// Ranking oracle (tests/oracle/ranking-oracle.md): a deliberately naive re-implementation of BR-06 / BR-07 / BR-09 and the
// processed-food rule of 2026-11-01 (F1'', warning; F4 and the complete-first tier are retired).
// Independence rules: imports nothing from src/ and no package; Node built-ins only. Everything is derived from the raw
// recipe ingredients (animal origin, diet completeness) and the raw dictionary; dates are plain ISO strings.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RDict {
  categories: { id: string; parentId: string | null }[];
  ingredients: {
    id: string;
    categoryIds: string[];
    parentIngredientId: string | null;
    seasoning: boolean;
    info: string;
    inherentAllergenIds: string[];
    allergenGroupIds: string[];
  }[];
  allergenGroups: { id: string; memberAllergenIds: string[] }[];
}
export interface RIng {
  ingredientId: string;
  allergenInfo: string;
  animalOrigin: string[];
  animalOriginKnown: boolean;
}
export interface RRecipe {
  id: string;
  minutes: number;
  themeId: string | null;
  ingredients: RIng[];
  allergenIds: string[];
  mayContainAllergenIds: string[];
  allergenDataComplete: boolean;
}
export interface RProfile {
  likedIds: string[];
  dislikedIds: string[];
  knownAllergenIds: string[];
  excludedIngredientIds: string[];
  diet: string[];
  themeIds: string[];
}
export interface RDecision { date: string; state: string; recipeId?: string | undefined }

export const loadRDict = (): RDict => JSON.parse(readFileSync(join(process.cwd(), 'data', 'dictionary.json'), 'utf8')) as RDict;

const FORBIDDEN: Record<string, string[]> = {
  vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'],
  pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
  'no-pork': ['pork', 'meat', 'gelatin'],
  'no-beef': ['beef', 'meat'],
  'no-seafood': ['fish-seafood'],
};

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86400000;
};

export interface OScored { id: string; score: number; warning: { allergenIds: string[]; processedIngredientIds: string[] } | null }
export interface OOut {
  /** full ordered list (survivors) */
  order: OScored[];
  /** excluded: id -> sorted unique reason strings */
  excluded: Map<string, string[]>;
}

export class RankOracle {
  private ing = new Map<string, RDict['ingredients'][number]>();
  private cat = new Map<string, RDict['categories'][number]>();
  private dict: RDict;
  private lib: RRecipe[];
  constructor(dict: RDict, lib: RRecipe[]) {
    this.dict = dict;
    this.lib = lib;
    for (const i of dict.ingredients) this.ing.set(i.id, i);
    for (const c of dict.categories) this.cat.set(c.id, c);
  }

  /** ingredient parents, nearest first */
  private parents(id: string): string[] {
    const out: string[] = [];
    let cur = this.ing.get(id)?.parentIngredientId ?? null;
    while (cur !== null && !out.includes(cur)) {
      out.push(cur);
      cur = this.ing.get(cur)?.parentIngredientId ?? null;
    }
    return out;
  }
  /** categories of an ingredient by level: level 0 = own categories, level 1 = their parents ... */
  private catLevels(id: string): string[][] {
    const levels: string[][] = [];
    let cur = [...(this.ing.get(id)?.categoryIds ?? [])];
    while (cur.length > 0) {
      levels.push(cur);
      const next: string[] = [];
      for (const c of cur) {
        const p = this.cat.get(c)?.parentId ?? null;
        if (p !== null) next.push(p);
      }
      cur = next;
    }
    return levels;
  }

  run(p: RProfile, decisions: RDecision[], target: string): OOut {
    const excluded = new Map<string, string[]>();
    const scored: { r: RRecipe; score: number }[] = [];
    for (const r of this.lib) {
      const reasons = new Set<string>();
      // F1'': recipe allergenIds (data contract 3.7a: valid data already holds each ingredient's inherent ids) + members of carried groups; label data never read
      const hit = new Set<string>(r.allergenIds);
      for (const ing of r.ingredients) {
        const d = this.ing.get(ing.ingredientId);
        for (const g of d?.allergenGroupIds ?? []) for (const m of this.dict.allergenGroups.find((q) => q.id === g)?.memberAllergenIds ?? []) hit.add(m);
      }
      for (const x of hit) if (p.knownAllergenIds.includes(x)) reasons.add('allergen:' + x);
      // F2
      for (const ing of r.ingredients) {
        const chain = [ing.ingredientId, ...this.parents(ing.ingredientId)];
        const related = new Set<string>(chain);
        for (const c of chain) for (const lvl of this.catLevels(c)) for (const x of lvl) related.add(x);
        for (const x of related) if (p.excludedIngredientIds.includes(x)) reasons.add('excluded:' + x);
      }
      // F3 (derived from the ingredients)
      if (p.diet.length > 0) {
        const origin = new Set<string>();
        for (const ing of r.ingredients) for (const t of ing.animalOrigin) origin.add(t);
        const forbidden = new Set<string>();
        for (const d of p.diet) for (const t of FORBIDDEN[d]!) forbidden.add(t);
        for (const t of origin) if (forbidden.has(t)) reasons.add('diet-tag:' + t);
        if (r.ingredients.some((i) => !i.animalOriginKnown)) reasons.add('diet-incomplete');
      }
      if (reasons.size > 0) {
        excluded.set(r.id, [...reasons].sort());
        continue;
      }
      scored.push({ r, score: this.score(r, p, decisions, target) });
    }
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.r.minutes !== b.r.minutes) return a.r.minutes - b.r.minutes;
      return a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0;
    });
    return { order: scored.map((s) => ({ id: s.r.id, score: s.score, warning: this.warning(s.r, p) })), excluded };
  }

  /** processed-food warning: only with registered allergens and at least one processed (dictionary info = varies) ingredient */
  private warning(r: RRecipe, p: RProfile): OScored['warning'] {
    if (p.knownAllergenIds.length === 0) return null;
    const ids = [...new Set(r.ingredients.map((i) => i.ingredientId))].filter((i) => this.ing.get(i)?.info === 'varies');
    return ids.length === 0 ? null : { allergenIds: [...p.knownAllergenIds], processedIngredientIds: ids };
  }

  /** foods = distinct ingredient ids; an ancestor present with a descendant folds into each present descendant */
  private foods(r: RRecipe): { rep: string; members: string[] }[] {
    const ids = [...new Set(r.ingredients.map((i) => i.ingredientId))];
    const foldedAway = new Set<string>();
    const extra = new Map<string, string[]>();
    for (const x of ids) {
      for (const a of this.parents(x)) {
        if (ids.includes(a)) {
          foldedAway.add(a);
          extra.set(x, [...(extra.get(x) ?? []), a]);
        }
      }
    }
    return ids.filter((i) => !foldedAway.has(i)).map((i) => ({ rep: i, members: [i, ...(extra.get(i) ?? [])] }));
  }

  private verdict(f: { rep: string; members: string[] }, p: RProfile): 'like' | 'dislike' | null {
    const levels: string[][] = [f.members];
    const named = f.members.length === 1 && this.ing.get(f.rep)?.seasoning === true;
    if (!named) {
      // parent ingredients, nearest first
      const par = f.members.map((m) => this.parents(m));
      const maxP = Math.max(0, ...par.map((x) => x.length));
      for (let d = 0; d < maxP; d++) levels.push(par.map((x) => x[d]).filter((x): x is string => x !== undefined));
      // categories, nearest first
      const cl = f.members.map((m) => this.catLevels(m));
      const maxC = Math.max(0, ...cl.map((x) => x.length));
      for (let d = 0; d < maxC; d++) levels.push(cl.flatMap((x) => x[d] ?? []));
    }
    for (const lv of levels) {
      if (lv.some((x) => p.dislikedIds.includes(x))) return 'dislike';
      if (lv.some((x) => p.likedIds.includes(x))) return 'like';
    }
    return null;
  }

  private score(r: RRecipe, p: RProfile, decisions: RDecision[], target: string): number {
    let s = 0;
    for (const f of this.foods(r)) {
      const v = this.verdict(f, p);
      if (v === 'like') s += 2;
      if (v === 'dislike') s -= 3;
    }
    if (r.themeId !== null && p.themeIds.includes(r.themeId)) s += 1;
    const near = decisions.some(
      (d) => d.state === 'homemade-bento-planned' && d.recipeId === r.id && d.date !== target && Math.abs(dayNumber(d.date) - dayNumber(target)) <= 14,
    );
    if (near) s -= 2;
    if (r.minutes > 20) s -= 1;
    return s;
  }
}
