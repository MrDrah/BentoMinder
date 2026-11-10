// QA helpers for the UI refresh pass (independent of tests/e2e/helpers.ts and of the developer's tile-states.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DaySpec } from '../../oracle/ui-refresh-tile.ts';

const ROOT = process.cwd();
export const M2 = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8')) as Json;
export const TOKENS = JSON.parse(readFileSync(join(ROOT, 'design', 'tokens.json'), 'utf8')) as { color: Record<'light' | 'dark', Record<string, { value: string }>> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export type Theme = 'light' | 'dark';
export const tok = (theme: Theme, name: string): string => TOKENS.color[theme][name]!.value;
export function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}
export const css = (theme: Theme, name: string): string => rgbOf(tok(theme, name));

/** JST 10:00 on the date, as a Date (UTC 01:00 of the same day). */
export const jst10 = (date: string): Date => new Date(`${date}T01:00:00Z`);

export interface QaSpec extends DaySpec {
  /** MARK_RESERVATION flavour of a stored school-lunch record. */
  reserved?: boolean;
  /** CHANGE_RECIPE flavour of a stored home plan (two history entries). */
  recipeChanged?: boolean;
}

/** The November 2026 matrix. Weekdays: 1 Sun, 2 Mon, 3 Tue (holiday), 7 Sat, 14 Sat, 21 Sat, 23 Mon (holiday), 30 Mon. */
export const SPEC: Record<string, QaSpec> = {
  '2026-11-02': { kind: 'school' },
  '2026-11-03': { kind: 'outside', stored: 'unsure', holiday: { ja: '文化の日', en: 'Culture Day' } }, // dormant record
  '2026-11-04': { kind: 'school', stored: 'home' },
  '2026-11-05': { kind: 'school', override: true, alert: true },
  '2026-11-06': { kind: 'bento-day' },
  '2026-11-09': { kind: 'school', stored: 'unsure' },
  '2026-11-10': { kind: 'school', stored: 'school' }, // SET_SCHOOL_LUNCH
  '2026-11-11': { kind: 'school', stored: 'school', reserved: true, alert: true }, // MARK_RESERVATION
  '2026-11-12': { kind: 'school', alert: true },
  '2026-11-13': { kind: 'bento-day', stored: 'home' },
  '2026-11-14': { kind: 'school', override: true, alert: true }, // Saturday with lunch: icon in the narrow column
  '2026-11-16': { kind: 'no-lunch', noLunchText: '休園' },
  '2026-11-17': { kind: 'school', stored: 'unsure' },
  '2026-11-18': { kind: 'school', stored: 'home', alert: true }, // the menu has the alert but the day is bento: no mark
  '2026-11-19': { kind: 'school' }, // declares only milk: not the child's allergen
  '2026-11-20': { kind: 'bento-day' },
  '2026-11-21': { kind: 'outside', stored: 'school' }, // dormant record
  '2026-11-23': { kind: 'outside', holiday: { ja: '勤労感謝の日', en: 'Labor Thanksgiving Day' } },
  '2026-11-24': { kind: 'school', stored: 'home', recipeChanged: true },
  '2026-11-25': { kind: 'school' },
  '2026-11-26': { kind: 'school', stored: 'school' },
  '2026-11-27': { kind: 'no-lunch', override: true, noLunchText: '午前保育（給食なし）' }, // dormant override
  '2026-11-30': { kind: 'school' },
};
// US-E8-04 (public holidays, a Could) is deferred by PLAN 2026-10-31: holidays are not drawn, so no tile is expected to be red for a holiday.
export const isHoliday = (): boolean => false;

export function specOf(date: string): QaSpec {
  return SPEC[date] ?? { kind: 'outside' };
}

export const NOV_DATES = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

/** The store (app state v1) holding the matrix. */
export function matrixStore(lang: 'ja' | 'en' = 'ja', extra?: (s: Json) => void): string {
  const s: Json = JSON.parse(JSON.stringify(M2));
  const at = '2026-11-01T10:05:00+09:00';
  const menu = s.menus['2026-11'].confirmed;
  const template = menu.days.find((d: Json) => d.date === '2026-11-02');
  const wdJa = ['日', '月', '火', '水', '木', '金', '土'];
  const days: Json[] = [];
  const noLunch: Json[] = [];
  s.profile = { ...s.profile, allergyStatus: 'has-known', knownAllergenIds: ['alg-egg'] };
  s.decisions = {};
  s.overrides = {};
  for (const [date, spec] of Object.entries(SPEC)) {
    const [, , dd] = date.split('-');
    if (spec.kind === 'school') {
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
      const day = JSON.parse(JSON.stringify(template));
      day.date = date;
      day.printedDateText = `${Number(dd)}日（${wdJa[wd]}）`;
      day.printedWeekday = wdJa[wd];
      if (spec.alert === true || date === '2026-11-19') {
        day.allergenDeclaration = { status: 'declared', allergenIds: [date === '2026-11-19' ? 'alg-milk' : 'alg-egg'], rawText: 'アレルゲン', verification: { status: 'ok' } };
      }
      days.push(day);
    } else if (spec.kind === 'bento-day' || spec.kind === 'no-lunch') {
      noLunch.push({ date, reason: spec.kind === 'bento-day' ? 'bento-day' : spec.noLunchText === '休園' ? 'closed' : 'no-lunch', originalText: spec.kind === 'bento-day' ? 'お弁当の日' : (spec.noLunchText ?? '給食なし'), verification: { status: 'ok' } });
    }
    const base = { date, ownerId: 'local', createdAt: at, updatedAt: at, decidedAt: at, reservationDoneExternally: spec.reserved === true };
    if (spec.stored === 'home') {
      const hist = [{ state: 'homemade-bento-planned', recipeId: 'rcp-kuma-onigiri', at }];
      if (spec.recipeChanged === true) hist.push({ state: 'homemade-bento-planned', recipeId: 'rcp-kuma-onigiri', at });
      s.decisions[date] = { ...base, state: 'homemade-bento-planned', recipeId: 'rcp-kuma-onigiri', recipeNameSnapshot: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' }, recipeShortNameSnapshot: { ja: 'くまおにぎり', en: 'Bear oni' }, plannedAt: at, history: hist };
    } else if (spec.stored === 'unsure') {
      s.decisions[date] = { ...base, state: 'not-confirmed', history: [{ state: 'not-confirmed', at }] };
    } else if (spec.stored === 'school') {
      s.decisions[date] = { ...base, state: 'school-lunch-planned', history: [{ state: 'school-lunch-planned', at }] };
    }
    if (spec.override === true) s.overrides[date] = { date, state: 'low-preference', setAt: at, menuVersionAtSet: menu.version, ownerId: 'local', createdAt: at, updatedAt: at };
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  noLunch.sort((a, b) => a.date.localeCompare(b.date));
  menu.days = days;
  menu.noLunchDays = noLunch;
  s.settings.language = lang;
  extra?.(s);
  return JSON.stringify(s);
}

export async function seed(page: Page, json: string): Promise<void> {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem('bentominder.state') === null) window.localStorage.setItem('bentominder.state', value);
  }, JSON.stringify(JSON.parse(json)));
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}

export async function setScheme(page: Page, scheme: Theme, reducedMotion: 'reduce' | 'no-preference' = 'reduce'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion });
  await settle(page);
}

export async function axeSerious(page: Page, label: string): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Horizontal overflow in CSS px (0 = none). */
export async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - document.body.clientWidth));
}

/** Names of the tiles by Chrome's own accessibility engine (CDP), keyed by date. */
export async function realNames(page: Page): Promise<Record<string, string>> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    const doc = (await cdp.send('DOM.getDocument', { depth: 0 })) as Json;
    const found = (await cdp.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '.cell__btn' })) as Json;
    const out: Record<string, string> = {};
    for (const nodeId of found.nodeIds as number[]) {
      const desc = (await cdp.send('DOM.describeNode', { nodeId })) as Json;
      const attrs: string[] = desc.node.attributes;
      const date = attrs[attrs.indexOf('data-date') + 1]!;
      const ax = (await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })) as Json;
      out[date] = String(ax.nodes[0]?.name?.value ?? '');
    }
    return out;
  } finally {
    await cdp.detach();
  }
}
