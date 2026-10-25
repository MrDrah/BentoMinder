// The accessible name of a cell, as visually hidden content (so the visible short words never
// contradict an aria-label, WCAG 2.5.3). Text quoted from the menu is Japanese whatever the UI
// language, so it carries lang="ja" (WCAG 3.1.2, D-M1-05).
import type { ReactElement } from 'react';
import type { DayView } from '../../domain/calendar/day-view.ts';
import type { Language, Translate } from '../../i18n/index.ts';
import { cellLabel } from './cell-label.ts';

/** Japanese fragments that can appear inside an English sentence: the sheet's wording, a recipe with no English name. */
function japaneseFragments(lang: Language, v: DayView): string[] {
  if (lang === 'ja') return [];
  const out: string[] = [];
  if (v.type.type === 'no-lunch') out.push(v.type.noLunch.originalText);
  const name = v.record?.recipeNameSnapshot;
  if (name !== undefined && name.en === undefined) out.push(name.ja);
  return out.filter((f) => f !== '');
}

export function CellName({ t, lang, v }: { t: Translate; lang: Language; v: DayView }) {
  const label = cellLabel(t, lang, v);
  let parts: (string | ReactElement)[] = [label];
  for (const fragment of japaneseFragments(lang, v)) {
    parts = parts.flatMap((part, i) => {
      if (typeof part !== 'string') return [part];
      const at = part.indexOf(fragment);
      if (at < 0) return [part];
      return [part.slice(0, at), <span key={`${fragment}-${i}`} lang="ja">{fragment}</span>, part.slice(at + fragment.length)];
    });
  }
  return <span className="visually-hidden">{parts}</span>;
}
