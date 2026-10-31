// Display text for the calendar and the day sheet: state and decision labels, the assessment
// explanation sentence, recipe names, the short-name split. Every string comes from the catalog.
import type { Assessment, AssessmentState, ExplanationKey } from '../../domain/assessment/assess.ts';
import { dictIndex } from '../../domain/assessment/dictionary-index.ts';
import type { DecisionState } from '../../domain/decision/decision.ts';
import type { DayDecision } from '../../domain/schema/index.ts';
import type { Dictionary } from '../../domain/schema/dictionary.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';

export const STATE_KEYS: Record<AssessmentState, MessageKey> = {
  'likely-enjoyable': 'state.likely',
  'mixed-uncertain': 'state.mixed',
  'low-preference': 'state.low',
  'not-assessed': 'state.notAssessed',
  'no-school-lunch': 'state.noLunch',
};

export const DECISION_KEYS: Record<DecisionState, MessageKey> = {
  'school-lunch-planned': 'decision.school',
  'homemade-bento-planned': 'decision.bento',
  'not-confirmed': 'decision.notConfirmed',
  'no-school-lunch': 'decision.noLunch',
};

/** Full recipe name from the decision's snapshot, in the active language (ja when there is no en). */
export function recipeName(record: Pick<DayDecision, 'recipeNameSnapshot'>, lang: Language): string {
  const n = record.recipeNameSnapshot;
  if (n === undefined) return '';
  return lang === 'en' ? (n.en ?? n.ja) : n.ja;
}

/** The curated short name (≤ 8 characters) from the snapshot, in the active language. */
export function recipeShortName(record: Pick<DayDecision, 'recipeShortNameSnapshot'>, lang: Language): string {
  const n = record.recipeShortNameSnapshot;
  return n === undefined ? '' : n[lang];
}

const joiner = (lang: Language) => (lang === 'ja' ? '、' : ', ');

/** English dictionary labels start with a capital; inside a sentence they are lower case. */
export const inSentence = (label: string, lang: Language) => (lang === 'en' ? label.charAt(0).toLowerCase() + label.slice(1) : label);

/** `{list}` of an explanation: up to 3 names, then 「ほか{n}つ」 / "and {n} more" when the count is larger. */
function nameList(t: Translate, lang: Language, names: string[], count: number): string {
  const list = names.join(joiner(lang));
  return count > names.length ? t('assess.labels.more', { list, n: count - names.length }) : list;
}

/**
 * The explanation sentence of one assessment (US-E4-02/AC1–AC4): the key plus its parameters,
 * rendered in the active language. Names of foods come from the dictionary (never inserted by the
 * nickname); menu dish names stay as imported.
 */
export function explanationText(t: Translate, lang: Language, dict: Dictionary, a: Assessment, key: ExplanationKey = a.explanationKey): string {
  const idx = dictIndex(dict);
  const p = a.explanationParams;
  const foods = (ids: string[], count: number) =>
    nameList(
      t,
      lang,
      ids.map((id) => inSentence(idx.label(id, lang), lang)),
      count,
    );
  const wdLong = t(`wd.long.${p.weekday}` as MessageKey);
  switch (key) {
    case 'assess.low':
      return t('assess.low', { wdLong, n: p.dislikedCount, labels: foods(p.dislikedLabelIds, p.dislikedCount) });
    case 'assess.likely':
      return t('assess.likely', { wdLong, n: p.likedCount, labels: foods(p.likedLabelIds, p.likedCount) });
    case 'assess.mixedOne':
      return t('assess.mixedOne', { wdLong, liked: foods(p.likedLabelIds, p.likedCount), disliked: foods(p.dislikedLabelIds, p.dislikedCount) });
    case 'assess.mixedUnknown':
      return t('assess.mixedUnknown', { unmatched: nameList(t, lang, p.unmatched, p.unmatchedTotal) });
    case 'assess.mixedNeutral':
      return t('assess.mixedNeutral');
    case 'assess.notAssessed':
      return t('assess.notAssessed');
    case 'assess.noLunch':
      return t('assess.noLunch');
    case 'assess.override':
      return t('assess.override');
  }
}

/**
 * Splits a short name into at most 2 lines of at most 4 characters at a phrase boundary (a11y §9):
 * the word boundary closest to the middle that keeps both lines ≤ 4; otherwise after character 4.
 */
export function splitShortName(text: string, segment: (s: string) => string[] = japaneseWords): string[] {
  const chars = [...text];
  if (chars.length <= 4) return [text];
  const words = segment(text);
  let best: number | null = null;
  let at = 0;
  for (const w of words.slice(0, -1)) {
    at += [...w].length;
    if (at <= 4 && chars.length - at <= 4 && (best === null || Math.abs(at - chars.length / 2) < Math.abs(best - chars.length / 2))) best = at;
  }
  const cut = best ?? 4;
  return [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
}

function japaneseWords(text: string): string[] {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return [text];
  return [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)].map((s) => s.segment);
}
