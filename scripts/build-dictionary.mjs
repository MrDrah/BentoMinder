#!/usr/bin/env node
// Builds data/dictionary.json (GENERATED, never hand-edited) from the BA's tables in
// docs/ba/domain-dictionary.md. One record per table row, same ids. Applies dictionary §1
// rule 2: a surface form listed in an ambiguity group belongs to the group, so it is removed
// from that group's candidate entries. Usage: node scripts/build-dictionary.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeForMatch, stripDisambiguator } from '../src/domain/text/normalize.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'docs/ba/domain-dictionary.md';
const OUT = 'data/dictionary.json';

const NONE = new Set(['–', '-', '—', '']);
const ID_RE = /\b(?:ing|cat|dish|alg|theme|amb)-[a-z0-9]+(?:-[a-z0-9]+)*\b/g;

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const list = (cell) => (NONE.has(cell) ? [] : cell.split(/[,、]/).map((s) => s.trim()).filter((s) => !NONE.has(s)));
const idsIn = (text) => text.match(ID_RE) ?? [];
const dedupe = (xs) => [...new Set(xs)];

/** Splits the markdown into tables: { heading, context, header: string[], rows: string[][] }. */
export function parseTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  let heading = '';
  let context = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) {
      heading = line.replace(/^#+\s*/, '');
      context = '';
      continue;
    }
    if (line.startsWith('|') && (lines[i + 1] ?? '').match(/^\|\s*-/)) {
      const header = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      i -= 1;
      tables.push({ heading, context, header, rows });
      continue;
    }
    if (line.trim() !== '') context = line;
  }
  return tables;
}

const record = (header, row) => Object.fromEntries(header.map((h, n) => [h, row[n] ?? '']));

function surfaceForms(display, synonyms) {
  const forms = [stripDisambiguator(display), ...list(synonyms).map(stripDisambiguator)];
  const seen = new Set();
  return forms.filter((f) => {
    const key = normalizeForMatch(f);
    if (f === '' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAnimalOrigin(cell) {
  const parts = list(cell);
  return { animalOrigin: parts.filter((p) => p !== '?'), animalOriginKnown: !parts.includes('?') };
}

export function buildDictionary(markdown) {
  const tables = parseTables(markdown);
  const versionMatch = /Version \*\*v(\d+)/.exec(markdown);
  const dict = {
    version: versionMatch ? versionMatch[1] : '1',
    source: SOURCE,
    allergenScheme: 'caa-2026-04',
    categories: [],
    allergens: [],
    ingredients: [],
    dishes: [],
    themes: [],
    ambiguity: [],
  };

  for (const t of tables) {
    const h = t.header.join('|');
    for (const row of t.rows) {
      const r = record(t.header, row);
      if (h === 'id|表記|よみ|English|parent') {
        dict.categories.push({ id: r.id, ja: r['表記'], kana: r['よみ'], en: r.English, parentId: NONE.has(r.parent) ? null : r.parent });
      } else if (h.startsWith('id|表記|よみ|English') && r.id.startsWith('alg-')) {
        dict.allergens.push({
          id: r.id,
          ja: r['表記'],
          kana: r['よみ'],
          en: r.English,
          tier: t.context.includes('準ずる') || t.context.includes('recommended') ? 'recommended' : 'mandatory',
          synonyms: list(r.synonyms ?? ''),
          retired: false,
        });
      } else if (h.includes('inherent allergens')) {
        const childOf = /\(child of (ing-[a-z0-9-]+)\)/.exec(r.English);
        const categoryIds = list(r.category);
        dict.ingredients.push({
          id: r.id,
          ja: r['表記'],
          kana: r['よみ'],
          en: r.English.replace(/\s*\(child of [^)]*\)/, ''),
          categoryIds,
          parentIngredientId: childOf ? childOf[1] : null,
          forms: surfaceForms(r['表記'], r.synonyms),
          inherentAllergenIds: idsIn(r['inherent allergens']),
          info: r.info === 'varies' ? 'varies' : 'known',
          ...parseAnimalOrigin(r.animalOrigin),
          seasoning: categoryIds.includes('cat-seasoning'),
          note: /\(([^)]*)\)/.exec(r['inherent allergens'])?.[1] ?? null,
        });
      } else if (h.includes('definingIngredientId')) {
        const cat = r.category;
        const role = /\((main|side)\)/.exec(cat)?.[1] ?? null;
        const named = r['name ingredients'];
        const outside = named.replace(/\([^)]*\)/g, '');
        const inside = (named.match(/\([^)]*\)/g) ?? []).join(' ');
        dict.dishes.push({
          id: r.id,
          ja: r['表記'],
          kana: r['よみ'],
          en: r.English,
          categoryId: cat.startsWith('cat-') ? cat : null,
          role,
          forms: surfaceForms(r['表記'], r.synonyms),
          nameIngredientIds: dedupe(idsIn(outside)),
          conditionalNameIds: dedupe(idsIn(inside)),
          nameIngredientsNote: /[()]/.test(named) ? named : null,
          definingIngredientId: r.definingIngredientId === 'null' ? null : r.definingIngredientId,
        });
      } else if (h === 'id|表記|English' && r.id.startsWith('theme-')) {
        dict.themes.push({ id: r.id, ja: r['表記'], en: r.English });
      } else if (h.startsWith('group id')) {
        dict.ambiguity.push({
          id: r['group id'],
          forms: r['Surface form'].split('/').map((s) => s.trim()).filter(Boolean),
          candidateIds: dedupe(idsIn(r.Candidates)),
          candidatesNote: r.Candidates,
          resolution: r['Automatic resolution (only these)'] ?? '',
        });
      }
    }
  }

  // Retired allergens: "**Retired:** `alg-matsutake` まつたけ (removed 2024-03)…"
  for (const m of markdown.matchAll(/\*\*Retired:\*\*\s*`(alg-[a-z0-9-]+)`\s*(\S+)/g)) {
    dict.allergens.push({ id: m[1], ja: m[2], kana: m[2], en: m[1].replace(/^alg-/, ''), tier: 'recommended', synonyms: [], retired: true });
  }

  // Rule 2: an ambiguity form belongs to the group, not to its candidate entries.
  for (const group of dict.ambiguity) {
    const groupForms = new Set(group.forms.map(normalizeForMatch));
    for (const entry of [...dict.ingredients, ...dict.dishes]) {
      if (group.candidateIds.includes(entry.id)) {
        entry.forms = entry.forms.filter((f) => !groupForms.has(normalizeForMatch(f)));
      }
    }
  }
  return dict;
}

function main() {
  const markdown = readFileSync(join(root, SOURCE), 'utf8');
  const dict = buildDictionary(markdown);
  const json = `${JSON.stringify(dict, null, 2)}\n`;
  const counts = ['categories', 'allergens', 'ingredients', 'dishes', 'themes', 'ambiguity']
    .map((k) => `${dict[k].length} ${k}`)
    .join(', ');
  if (process.argv.includes('--check')) {
    let existing = '';
    try {
      existing = readFileSync(join(root, OUT), 'utf8');
    } catch {
      // missing file is reported below
    }
    if (existing !== json) {
      console.error(`${OUT} is out of date with ${SOURCE}: run npm run build:dictionary`);
      process.exit(1);
    }
    console.log(`${OUT} is up to date (${counts})`);
    return;
  }
  writeFileSync(join(root, OUT), json);
  console.log(`wrote ${OUT}: ${counts}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
