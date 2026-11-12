// US-E17-01: the dishType field (AC2 fallback, AC9 every recipe has a type from the 18) and the source-level
// guarantees of the illustration files (AC8: no filter, size cap). The 92-recipe mapping is a property check
// against the batch files (every record has a valid type and agrees with the reviewed table), not an output pin.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DISH_TYPE_MAP, MAPPED_BATCHES } from '../../../scripts/dish-type-map.mjs';
import { DISH_TYPES, normalizeDishType, recipeSchema } from '../../../src/domain/schema/index.ts';

const read = (p: string) => readFileSync(p, 'utf8');
const batch = (b: string) => JSON.parse(read(`data/_research/batch-${b}.json`)) as { id: string; dishType?: string }[];
const library = () => JSON.parse(read('data/library.json')) as Record<string, unknown>[];

describe('dishType enum', () => {
  it('US-E17-01/AC1 the enum is exactly the 18 types of the design', () => {
    expect([...DISH_TYPES].sort()).toEqual(
      ['onigiri', 'rice-bowl', 'sandwich', 'noodles', 'egg', 'fried-chicken', 'meat-patty', 'meat-roll', 'grilled-fish', 'simmered', 'tofu', 'salad', 'soup', 'vegetable-side', 'fritter', 'dumpling', 'sweet', 'other'].sort(),
    );
    expect(DISH_TYPES).toHaveLength(18);
  });

  it('US-E17-01/AC1 every listed type is kept as it is', () => {
    for (const t of DISH_TYPES) expect(normalizeDishType(t)).toBe(t);
  });

  it('US-E17-01/AC2 a missing, null, empty or unknown value becomes other', () => {
    for (const v of [undefined, null, '', 'pizza', 'Onigiri', 7, {}, ['egg']]) expect(normalizeDishType(v)).toBe('other');
  });
});

describe('US-E17-01/AC9 the schema and the library', () => {
  const base = () => library()[0] as Record<string, unknown>;

  it('US-E17-01/AC9 a library record with a valid type passes the recipe schema', () => {
    expect(recipeSchema.safeParse(base()).success).toBe(true);
  });

  it('US-E17-01/AC9 a recipe without a dishType or with an unknown one is rejected with rule recipe-dish-type', () => {
    const without = { ...base() };
    delete without['dishType'];
    for (const candidate of [without, { ...base(), dishType: 'pizza' }, { ...base(), dishType: '' }, { ...base(), dishType: null }]) {
      const r = recipeSchema.safeParse(candidate);
      expect(r.success).toBe(false);
      expect(r.error?.issues.map((i) => i.message)).toContain('recipe-dish-type');
    }
  });

  it('US-E17-01/AC9 every recipe in data/library.json has a dishType from the 18', () => {
    const lib = library();
    expect(lib.length).toBeGreaterThan(0);
    for (const r of lib) expect(DISH_TYPES as readonly unknown[], String(r['id'])).toContain(r['dishType']);
  });
});

describe('US-E17-01/AC9 the one-time mapping for batch-a..h', () => {
  const records = MAPPED_BATCHES.flatMap(batch);

  it('US-E17-01/AC9 the table maps exactly the recipes of batch-a..h and only to listed types', () => {
    expect(new Set(records.map((r) => r.id))).toEqual(new Set(Object.keys(DISH_TYPE_MAP)));
    expect(records.length).toBe(Object.keys(DISH_TYPE_MAP).length);
    for (const t of Object.values(DISH_TYPE_MAP)) expect(DISH_TYPES as readonly string[]).toContain(t);
  });

  it('US-E17-01/AC9 every batch-a..h record carries the type the table gives it', () => {
    for (const r of records) expect(r.dishType, r.id).toBe(DISH_TYPE_MAP[r.id as keyof typeof DISH_TYPE_MAP]);
  });
});

describe('illustration sources', () => {
  const files = ['src/ui/dish-art/art-data.ts', 'src/ui/dish-art/DishArt.tsx', 'src/ui/dish-art/DishArtSlot.tsx', 'src/ui/dish-art/dish-art.css'];

  it('US-E17-01/AC8 no SVG filter element and no CSS filter or drop-shadow anywhere in the illustration files', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/<filter|<fe[A-Z]|filter\s*:|drop-shadow|url\(#/);
  });

  it('US-E17-01/AC8 no image, no external file and no text element in the drawings', () => {
    const art = read('src/ui/dish-art/art-data.ts');
    expect(art).not.toMatch(/<image|<text|<title|<use|href=|<img|https?:/);
  });

  it('US-E17-01/AC8 the drawings and the stylesheet together stay within 16 KB gzip', () => {
    const bytes = gzipSync(files.map(read).join('\n')).length;
    expect(bytes).toBeLessThanOrEqual(16 * 1024);
  });

  it('US-E17-01/AC4 AC7 every keyframe sits in no-preference, animates only transform and opacity, and no loop is faster than 2.4 s', () => {
    const css = read('src/ui/dish-art/dish-art.css');
    const reduceBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'), css.indexOf('@keyframes dish-in'));
    const uses = [...css.matchAll(/animation:\s*([\w-]+)\s+([\d.]+m?s)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [whole, , durText] of uses) {
      const dur = durText as string;
      expect(reduceBlock, whole).toContain(whole);
      const ms = dur.endsWith('ms') ? parseFloat(dur) : parseFloat(dur) * 1000;
      if (!whole.includes('dish-in')) expect(ms).toBeGreaterThanOrEqual(2400);
    }
    for (const m of css.matchAll(/@keyframes (dish-[\w-]+) \{([\s\S]*?)\n\}|@keyframes (dish-[\w-]+) \{(.*)\}$/gm)) {
      const body = m[2] ?? m[4] ?? '';
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]);
      for (const p of props) expect(['opacity', 'transform'], `${m[1] ?? m[3]} ${p}`).toContain(p);
    }
  });
});
