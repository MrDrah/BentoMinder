// QA oracle for the calendar day tile (BA US-E5-01/AC3-AC4, AC9-AC16, AC14; design/components.md §18; design/a11y-responsive.md §6).
// Deliberately naive, written from the acceptance criteria only; it shares no code with src/. It takes a plain description of
// a date (what kind of day it is, what the parent stored, whether the menu carries the allergen alert) and "today" (a Tokyo
// date) and says what the tile must show and what its accessible name must be.

export type DayKind = 'school' | 'bento-day' | 'no-lunch' | 'outside';
/** What the parent stored for the date. "school" = a stored school-lunch-planned record (SET_SCHOOL_LUNCH or MARK_RESERVATION). */
export type Stored = 'home' | 'unsure' | 'school' | undefined;

export interface DaySpec {
  kind: DayKind;
  stored?: Stored;
  /** An AssessmentOverride that is applied (only a school day applies one; on any other day it is dormant). */
  override?: boolean;
  /** The menu carries the allergen alert for the child's registered allergens. */
  alert?: boolean;
  /** Reason text printed by the school for a no-lunch day (used only in the name of such a day). */
  noLunchText?: string;
  holiday?: { ja: string; en: string };
}

export interface ExpectedTile {
  inMenu: boolean;
  icon: 'school' | 'home' | 'unsure' | 'none';
  state: 'school' | 'home' | 'homeDay' | 'unsure' | null;
  changed: boolean;
  dash: boolean;
  today: boolean;
  tomorrow: boolean;
  past: boolean;
  allergen: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function addDay(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function expectedTile(date: string, today: string, s: DaySpec): ExpectedTile {
  const todayFlag = date === today;
  const past = date < today;
  const tomorrow = date === addDay(today, 1);
  let icon: ExpectedTile['icon'] = 'none';
  let state: ExpectedTile['state'] = null;
  if (s.kind === 'school') {
    if (s.stored === 'home') [icon, state] = ['home', 'home'];
    else if (s.stored === 'unsure') [icon, state] = ['unsure', 'unsure'];
    else [icon, state] = ['school', 'school'];
  } else if (s.kind === 'bento-day') {
    // A bento day shows the crossed spoon and spatula, planned or not; any record other than a plan is dormant.
    if (s.stored === 'home') [icon, state] = ['home', 'home'];
    else [icon, state] = ['home', 'homeDay'];
  }
  const planned = s.kind === 'bento-day' && s.stored === 'home';
  const hasUsableRecord = s.kind === 'school' ? s.stored !== undefined : planned;
  const changed = icon !== 'none' && ((s.kind === 'school' && s.override === true) || hasUsableRecord);
  const dash = s.kind === 'bento-day' && !planned && !past;
  const allergen = icon === 'school' && s.alert === true;
  return { inMenu: s.kind === 'school' || s.kind === 'bento-day', icon, state, changed, dash, today: todayFlag, tomorrow, past, allergen };
}

const JA_WD = ['日', '月', '火', '水', '木', '金', '土'];
const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateText(date: string, lang: 'ja' | 'en'): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = weekday(date);
  return lang === 'ja' ? `${m}月${d}日（${JA_WD[wd]}）` : `${EN_WD[wd]}, ${EN_MON[m - 1]} ${d}`;
}

const STATE_WORD = {
  ja: { school: '給食', home: '手作りお弁当', homeDay: '手作りお弁当の日', unsure: '未定' },
  en: { school: 'school lunch', home: 'homemade bento', homeDay: 'bento day', unsure: 'undecided' },
} as const;
const SUFFIX = {
  ja: { allergen: 'アレルギーに注意', changed: '手動で変更', today: '今日', tomorrow: '明日', past: '過去の日', dash: 'お弁当の準備が未定' },
  en: { allergen: 'allergen alert', changed: 'changed by you', today: 'today', tomorrow: 'tomorrow', past: 'past day', dash: 'bento still to plan' },
} as const;

/** The accessible name of a tile of a day in the menu, in the order of US-E5-01/AC14 (allergen right after the state, AC16). */
export function expectedName(date: string, today: string, s: DaySpec, lang: 'ja' | 'en'): string | null {
  const t = expectedTile(date, today, s);
  if (!t.inMenu || t.state === null) return null;
  const sep = lang === 'ja' ? '、' : ', ';
  const parts: string[] = [dateText(date, lang), STATE_WORD[lang][t.state]];
  if (t.allergen) parts.push(SUFFIX[lang].allergen);
  if (t.changed) parts.push(SUFFIX[lang].changed);
  if (t.today) parts.push(SUFFIX[lang].today);
  else if (t.tomorrow) parts.push(SUFFIX[lang].tomorrow);
  else if (t.past) parts.push(SUFFIX[lang].past);
  if (t.dash) parts.push(SUFFIX[lang].dash);
  return parts.join(sep);
}

/** The suffix words a day outside the menu or a no-lunch day may carry (A11y §6 notes: today / tomorrow / past apply to these too). */
export function expectedTimeWord(date: string, today: string, lang: 'ja' | 'en'): string | null {
  if (date === today) return SUFFIX[lang].today;
  if (date === addDay(today, 1)) return SUFFIX[lang].tomorrow;
  if (date < today) return SUFFIX[lang].past;
  return null;
}

export const ALL_STATE_WORDS = (lang: 'ja' | 'en') => Object.values(STATE_WORD[lang]);
export const ALL_SUFFIX_WORDS = (lang: 'ja' | 'en') => [SUFFIX[lang].allergen, SUFFIX[lang].changed, SUFFIX[lang].dash];

// ---- WCAG 2.1 contrast, from hex values (independent of design/_scratch/contrast.mjs) ----
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
export function contrast(a: string | [number, number, number], b: string | [number, number, number]): number {
  const la = luminance(typeof a === 'string' ? hexToRgb(a) : a);
  const lb = luminance(typeof b === 'string' ? hexToRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
