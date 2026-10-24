// Generators: the dictionary is rebuilt from the BA's markdown and matches the committed file;
// the display-font subset keeps only slices that cover the given text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDictionary, parseTables } from '../../../scripts/build-dictionary.mjs';
import { buildDisplayFontCss, parseUnicodeRange } from '../../../scripts/display-font.mjs';
import { mergeBatches } from '../../../scripts/merge-research.mjs';

const root = process.cwd();

describe('build-dictionary', () => {
  it('data/dictionary.json is exactly what the generator builds from docs/ba/domain-dictionary.md', () => {
    const built = buildDictionary(readFileSync(join(root, 'docs', 'ba', 'domain-dictionary.md'), 'utf8'));
    expect(JSON.parse(readFileSync(join(root, 'data', 'dictionary.json'), 'utf8'))).toEqual(built);
  });

  it('parses a table row into a record with categories, parents, origin tags and forms', () => {
    const md = [
      '### 4.5 Meat',
      '| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |',
      '|----|------|------|---------|----------|----------|--------------------|------|--------------|',
      '| ing-a | 鶏もも肉 | とりももにく | Thigh (child of ing-b) | cat-x, cat-y | 鶏もも, とりもも | alg-chicken | known | chicken, ? |',
    ].join('\n');
    expect(parseTables(md)).toHaveLength(1);
    const ing = buildDictionary(md).ingredients[0];
    expect(ing).toMatchObject({
      id: 'ing-a',
      en: 'Thigh',
      categoryIds: ['cat-x', 'cat-y'],
      parentIngredientId: 'ing-b',
      forms: ['鶏もも肉', '鶏もも', 'とりもも'],
      animalOrigin: ['chicken'],
      animalOriginKnown: false,
    });
  });
});

describe('merge-research', () => {
  it('merges no batches into an empty library', () => {
    expect(mergeBatches([])).toEqual([]);
  });
});

describe('display-font subset (ADR 001 Fonts)', () => {
  it('parses unicode ranges', () => {
    expect(parseUnicodeRange('U+0000-00FF,U+0131, U+4??')).toEqual([
      [0, 255],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
  });

  it('keeps fewer slices for less text, and always woff2 only', () => {
    const latin = buildDisplayFontCss({ texts: ['Abc 123'], fileUrl: (n: string) => `f/${n}` });
    const japanese = buildDisplayFontCss({ texts: ['Abc 123', '献立カレンダー'], fileUrl: (n: string) => `f/${n}` });
    expect(latin.kept).toBeGreaterThan(0);
    expect(japanese.kept).toBeGreaterThan(latin.kept);
    expect(japanese.total).toBeGreaterThan(japanese.kept);
    expect(japanese.css).not.toContain(".woff'");
    expect(japanese.css).not.toContain('format(\'woff\')');
  });
});
