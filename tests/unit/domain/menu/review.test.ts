// Review / manual-entry draft (US-E3-01…E3-04) on the recorded FX-01 stand-in.
import { describe, expect, it } from 'vitest';
import {
  acceptField,
  addItem,
  changedDates,
  confirmBlock,
  draftFromExtraction,
  editItemText,
  emptyDraft,
  fieldErrors,
  fieldIds,
  markNoLunch,
  parseModelReply,
  removeItem,
  restoreLunch,
  reviewRows,
  setNoLunchReason,
  setNoLunchText,
  toConfirmedMenu,
  uncertainFields,
  type ExtractedMenu,
} from '../../../../src/domain/index.ts';
import type { LocalDate, YearMonth } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';

const d = (s: string) => s as LocalDate;
const AT = '2026-10-28T10:05:00+09:00';

function menu(fixture = 'fixture-menu-2026-11', name = 'hand-1', month = '2026-11'): ExtractedMenu {
  const r = loadFixture<{ response: { modelOutput: unknown } }>(`menus/${fixture}/recorded/${name}.json`);
  const out = parseModelReply(JSON.stringify(r.response.modelOutput), {
    targetMonth: month as YearMonth,
    sha256: 'b'.repeat(64),
    byteSize: 2000,
    model: 'gemini-3.8-flash',
    promptVersion: 1,
    at: AT,
  });
  if (out.kind !== 'ok') throw new Error(out.kind);
  return out.menu;
}

describe('US-E3-01 review the extracted menu', () => {
  it('US-E3-01/AC1 lists every Mon–Fri of November 2026 in order, plus listed weekend dates only', () => {
    const rows = reviewRows(draftFromExtraction(menu()));
    const dates = rows.map((r) => r.date);
    expect(dates.filter((x) => x.startsWith('2026-11-0'))).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09']);
    expect(dates).toContain('2026-11-14'); // snack-only Saturday printed on the sheet
    expect(dates).not.toContain('2026-11-15');
    expect(rows.find((r) => r.date === '2026-11-03')?.day).toBeNull(); // 文化の日: 献立に記載なし
    expect(rows.find((r) => r.date === '2026-11-27')?.day?.noLunch).toMatchObject({ reason: 'no-lunch', text: '午前保育（給食なし）' });
    expect(rows).toHaveLength(22);
  });

  it('US-E3-01/AC2 the 3 uncertain fields are counted in row order', () => {
    const fields = uncertainFields(draftFromExtraction(menu()));
    expect(fields.map((f) => f.id)).toEqual(['2026-11-05-item-0', '2026-11-18-item-2', '2026-11-25-item-0']);
  });

  it('US-E2-05/AC5 a weekday mismatch is a day-level uncertain field that shows the printed weekday', () => {
    const fields = uncertainFields(draftFromExtraction(menu('fixture-menu-2026-11-wdmismatch', 'hand-unflagged')));
    expect(fields.find((f) => f.id === fieldIds.day('2026-11-04'))).toMatchObject({ reason: 'weekday-mismatch', printed: '木' });
  });

  it('US-E3-01/AC4 extraction warnings are carried into the draft', () => {
    expect(draftFromExtraction(menu('fixture-menu-2027-01-twocol', 'hand-partial', '2027-01')).warnings).toContain('partial-extraction');
  });

  it('US-E2-05/AC4 out-of-month entries are listed and never imported', () => {
    const draft = draftFromExtraction(menu('fixture-menu-2026-11', 'hand-out-of-month'));
    expect(draft.outOfMonth).toHaveLength(1);
    const result = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    if (!result.ok) throw new Error(result.issues.join());
    expect(result.menu.days.some((x) => x.date === '2026-12-01')).toBe(false);
  });
});

describe('US-E3-02 edit extracted items', () => {
  it('US-E3-02/AC1 editing a dish makes it parent-edited and clears the flag', () => {
    const draft = editItemText(draftFromExtraction(menu()), d('2026-11-05'), 0, 'さばのみそ煮');
    const item = draft.days.find((x) => x.date === '2026-11-05')!.items[0]!;
    expect(item).toMatchObject({ text: 'さばのみそ煮', verification: { status: 'parent-edited' } });
    expect(uncertainFields(draft)).toHaveLength(2);
  });

  it('US-E3-02/AC2 adding and removing dishes is reflected in the confirmed menu', () => {
    let draft = draftFromExtraction(menu());
    draft = addItem(draft, d('2026-11-12'));
    const i = draft.days.find((x) => x.date === '2026-11-12')!.items.length - 1;
    draft = editItemText(draft, d('2026-11-12'), i, 'ポテトサラダ');
    const before = draft.days.find((x) => x.date === '2026-11-13')!.items.length;
    draft = removeItem(draft, d('2026-11-13'), before - 1);
    const result = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    if (!result.ok) throw new Error(result.issues.join());
    const nov12 = result.menu.days.find((x) => x.date === '2026-11-12')!;
    expect(nov12.items.at(-1)).toMatchObject({ text: 'ポテトサラダ', kind: 'unknown', verification: { status: 'parent-entered' } });
    expect(result.menu.days.find((x) => x.date === '2026-11-13')!.items).toHaveLength(before - 1);
  });

  it('US-E3-02/AC3 marking a no-lunch day hides dishes, restoring brings them back', () => {
    let draft = markNoLunch(draftFromExtraction(menu()), d('2026-11-26'), '給食なし');
    draft = setNoLunchText(draft, d('2026-11-26'), '行事');
    const r1 = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    if (!r1.ok) throw new Error(r1.issues.join());
    expect(r1.menu.noLunchDays.find((x) => x.date === '2026-11-26')).toEqual({
      date: '2026-11-26', reason: 'no-lunch', originalText: '行事', verification: { status: 'parent-entered' },
    });
    expect(r1.menu.days.some((x) => x.date === '2026-11-26')).toBe(false);
    const restored = restoreLunch(draft, d('2026-11-26'));
    expect(restored.days.find((x) => x.date === '2026-11-26')!.items.length).toBeGreaterThan(0);
    expect(restored.days.find((x) => x.date === '2026-11-26')!.noLunch).toBeNull();
  });

  it('US-E3-02/AC4 dish names must be 1–40 characters after trimming', () => {
    const base = draftFromExtraction(menu());
    expect(fieldErrors(editItemText(base, d('2026-11-05'), 0, 'あ'.repeat(40))).size).toBe(0);
    expect(fieldErrors(editItemText(base, d('2026-11-05'), 0, 'あ'.repeat(41))).get('2026-11-05-item-0')).toBe('dish-length');
    const blank = editItemText(base, d('2026-11-05'), 0, '   ');
    expect(fieldErrors(blank).get('2026-11-05-item-0')).toBe('dish-length');
    expect(confirmBlock(blank)).toBe('errors');
  });

  it('US-E3-02/AC5 a day with 12 dishes cannot get a 13th', () => {
    let draft = emptyDraft('2026-11' as YearMonth);
    for (let i = 0; i < 13; i += 1) draft = addItem(draft, d('2026-11-02'));
    expect(draft.days[0]!.items).toHaveLength(12);
  });

  it('US-E3-02/AC6 the wording follows the reason until typed, 60 characters max', () => {
    let draft = markNoLunch(emptyDraft('2026-11' as YearMonth), d('2026-11-02'), '給食なし');
    expect(draft.days[0]!.noLunch).toMatchObject({ reason: 'no-lunch', text: '給食なし' });
    draft = setNoLunchReason(draft, d('2026-11-02'), 'bento-day', 'お弁当の日');
    expect(draft.days[0]!.noLunch?.text).toBe('お弁当の日');
    draft = setNoLunchText(draft, d('2026-11-02'), 'あ'.repeat(60));
    draft = setNoLunchReason(draft, d('2026-11-02'), 'closed', 'お休み');
    expect(draft.days[0]!.noLunch?.text).toBe('あ'.repeat(60));
    expect(fieldErrors(draft).size).toBe(0);
    expect(fieldErrors(setNoLunchText(draft, d('2026-11-02'), 'あ'.repeat(61))).get('2026-11-02-nolunch')).toBe('no-lunch-text');
    expect(fieldErrors(setNoLunchText(draft, d('2026-11-02'), '  ')).get('2026-11-02-nolunch')).toBe('no-lunch-text');
    // Reason/text changes on days that aren't no-lunch days do nothing.
    const plain = emptyDraft('2026-11' as YearMonth);
    expect(setNoLunchReason(plain, d('2026-11-03'), 'closed', 'x').days[0]!.noLunch).toBeNull();
    expect(setNoLunchText(plain, d('2026-11-03'), 'x').days[0]!.noLunch).toBeNull();
  });
});

describe('US-E3-03 confirm the menu (BR-12)', () => {
  it('US-E3-03/AC1 confirm builds a version-1 ConfirmedMenu linked to its extraction', () => {
    const m = menu();
    const r = toConfirmedMenu(draftFromExtraction(m), { confirmedAt: AT, previous: null });
    if (!r.ok) throw new Error(r.issues.join());
    expect(r.menu).toMatchObject({ month: '2026-11', version: 1, extractionId: m.id, confirmedAt: AT, changedDatesSincePrevious: [] });
    expect(r.menu.days).toHaveLength(18);
    expect(r.menu.noLunchDays.map((n) => [n.date, n.reason])).toEqual([['2026-11-20', 'bento-day'], ['2026-11-27', 'no-lunch']]);
  });

  it('US-E3-03/AC2 fields left uncertain are stored uncertain-accepted', () => {
    const r = toConfirmedMenu(draftFromExtraction(menu()), { confirmedAt: AT, previous: null });
    if (!r.ok) throw new Error(r.issues.join());
    expect(r.menu.days.find((x) => x.date === '2026-11-05')!.items[0]!.verification.status).toBe('uncertain-accepted');
    expect(JSON.stringify(r.menu)).not.toContain('"status":"uncertain"');
  });

  it('US-E3-03/AC4 「このままにする」 accepts one field; a later edit makes it parent-edited', () => {
    let draft = acceptField(draftFromExtraction(menu()), '2026-11-18-item-2');
    expect(uncertainFields(draft)).toHaveLength(2);
    const item = () => draft.days.find((x) => x.date === '2026-11-18')!.items[2]!;
    expect(item().verification.status).toBe('uncertain-accepted');
    draft = editItemText(draft, d('2026-11-18'), 2, 'りんご');
    expect(item().verification.status).toBe('parent-edited');
    expect(acceptField(draft, 'nope')).toBe(draft);
  });

  it('US-E3-03/AC4 accept works for day, allergen, ingredient and no-lunch fields', () => {
    const m = menu();
    const day = m.days.find((x) => x.date === '2026-11-04')!;
    day.verification = { status: 'uncertain', reason: 'other' };
    day.allergenDeclaration.verification = { status: 'uncertain', reason: 'low-legibility' };
    day.ingredients![0]!.verification = { status: 'uncertain', reason: 'low-legibility' };
    m.noLunchDays[0]!.verification = { status: 'uncertain', reason: 'other' };
    let draft = draftFromExtraction(m);
    const ids = uncertainFields(draft).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['2026-11-04-day', '2026-11-04-alg', '2026-11-04-ing-0', '2026-11-20-nolunch']));
    for (const id of ids) draft = acceptField(draft, id);
    expect(uncertainFields(draft)).toEqual([]);
    const r = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    expect(r.ok).toBe(true);
  });

  it('US-E3-05/AC1 a re-confirmed month gets version + 1 and the changed dates (removed, added, moved)', () => {
    const first = toConfirmedMenu(draftFromExtraction(menu()), { confirmedAt: AT, previous: null });
    if (!first.ok) throw new Error('first');
    let draft = draftFromExtraction(menu());
    draft = editItemText(draft, d('2026-11-18'), 0, 'ちがう料理');
    draft = markNoLunch(draft, d('2026-11-19'), '給食なし');
    draft = restoreLunch(draft, d('2026-11-27'));
    const second = toConfirmedMenu(draft, { confirmedAt: AT, previous: first.menu });
    if (!second.ok) throw new Error(second.issues.join());
    expect(second.menu.version).toBe(2);
    expect(second.menu.changedDatesSincePrevious).toEqual(['2026-11-18', '2026-11-19', '2026-11-27']);
    expect(changedDates(first.menu, first.menu)).toEqual([]);
  });
});

describe('US-E3-04 enter a menu manually', () => {
  it('US-E3-04/AC1 manual entry starts empty on every Mon–Fri and stores parent-entered items with no extraction', () => {
    let draft = emptyDraft('2026-11' as YearMonth);
    expect(reviewRows(draft)).toHaveLength(21);
    expect(reviewRows(draft).every((r) => r.day === null)).toBe(true);
    draft = addItem(draft, d('2026-11-02'));
    draft = editItemText(draft, d('2026-11-02'), 0, 'カレーライス');
    const r = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    if (!r.ok) throw new Error(r.issues.join());
    expect(r.menu.extractionId).toBeNull();
    expect(r.menu.days[0]).toMatchObject({ date: '2026-11-02', verification: { status: 'parent-entered' }, items: [{ text: 'カレーライス', verification: { status: 'parent-entered' } }] });
  });

  it('US-E3-04/AC2 an empty manual menu cannot be confirmed', () => {
    const draft = emptyDraft('2026-11' as YearMonth);
    expect(confirmBlock(draft)).toBe('empty');
    expect(toConfirmedMenu(draft, { confirmedAt: AT, previous: null }).ok).toBe(false);
    const withNoLunch = markNoLunch(draft, d('2026-11-02'), 'お休み', 'closed');
    expect(confirmBlock(withNoLunch)).toBeNull();
    // A lunch day whose dishes were all removed is left out.
    const removed = removeItem(addItem(draft, d('2026-11-03')), d('2026-11-03'), 0);
    expect(confirmBlock(removed)).toBe('empty');
  });

  it('US-E3-02/AC3 an extracted no-lunch day edited by the parent is parent-edited', () => {
    const draft = setNoLunchReason(draftFromExtraction(menu()), d('2026-11-27'), 'closed', 'お休み');
    const r = toConfirmedMenu(draft, { confirmedAt: AT, previous: null });
    if (!r.ok) throw new Error('x');
    expect(r.menu.noLunchDays.find((n) => n.date === '2026-11-27')).toEqual({
      date: '2026-11-27', reason: 'closed', originalText: '午前保育（給食なし）', verification: { status: 'parent-edited' },
    });
  });
});
