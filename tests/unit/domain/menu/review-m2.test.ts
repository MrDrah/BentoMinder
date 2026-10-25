// Review draft, M2 additions: the ambiguity choice (US-E4-01/AC6, AC21) and the date correction
// of a weekday-mismatch day (US-E2-05/AC5, AC7–AC10; contract rule review-date-correction).
import { describe, expect, it } from 'vitest';
import {
  acceptField,
  canFixDate,
  chooseAmbiguity,
  confirmBlock,
  dateFixCells,
  draftFromExtraction,
  editItemText,
  fieldIds,
  markNoLunch,
  moveDay,
  parseModelReply,
  removeItem,
  reviewRows,
  toConfirmedMenu,
  uncertainFields,
  type ExtractedMenu,
  type ReviewDraft,
} from '../../../../src/domain/index.ts';
import type { LocalDate, YearMonth } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';
import { d, day, dict, menu as confirmedOf } from '../../helpers/menus.ts';

const AT = '2026-10-28T10:05:00+09:00';

function extraction(fixture = 'fixture-menu-2026-11-wdmismatch', name = 'hand-1', month = '2026-11'): ExtractedMenu {
  const r = loadFixture<{ response: { modelOutput: unknown } }>(`menus/${fixture}/recorded/${name}.json`);
  const out = parseModelReply(JSON.stringify(r.response.modelOutput), { targetMonth: month as YearMonth, sha256: 'b'.repeat(64), byteSize: 2000, model: 'gemini-3.8-flash', promptVersion: 1, at: AT });
  if (out.kind !== 'ok') throw new Error(out.kind);
  return out.menu;
}

const row = (draft: ReviewDraft, date: string) => draft.days.find((x) => x.date === date);
const emptyOut = (draft: ReviewDraft, date: string): ReviewDraft => {
  let next = draft;
  for (let i = (row(draft, date)?.items.length ?? 0) - 1; i >= 0; i -= 1) next = removeItem(next, d(date), i);
  return next;
};
const unresolvedCount = (draft: ReviewDraft) => uncertainFields(draft).length;

describe('US-E2-05/AC5 US-E2-05/AC7 a weekday-mismatch day offers 「日付を直す」; other days do not', () => {
  const draft = draftFromExtraction(extraction());

  it('US-E2-05/AC7 only the flagged lunch day is correctable; unflagged days and no-lunch days are not', () => {
    expect(canFixDate(row(draft, '2026-11-04'))).toBe(true);
    expect(canFixDate(row(draft, '2026-11-05'))).toBe(false);
    expect(canFixDate(row(draft, '2026-11-20'))).toBe(false); // お弁当の日
    expect(canFixDate(null)).toBe(false);
    expect(dateFixCells(draft, d('2026-11-05'))).toEqual([]);
  });

  it('US-E2-05/AC7 every date of the month is shown with its weekday match; the current date is marked; nothing is preselected', () => {
    const cells = dateFixCells(emptyOut(draft, '2026-11-05'), d('2026-11-04'));
    expect(cells).toHaveLength(30);
    expect(cells.find((c) => c.current)?.date).toBe('2026-11-04');
    expect(cells.filter((c) => c.weekdayMatch).map((c) => c.date)).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']); // printed 木
    expect(cells.find((c) => c.date === '2026-11-05')?.free).toBe(true);
    expect(cells.find((c) => c.date === '2026-11-01')?.free).toBe(true); // an unlisted weekend date is free too
  });

  it('US-E2-05/AC8 a date that shows dishes or 給食なし is taken: listed, never chosen', () => {
    const cells = dateFixCells(draft, d('2026-11-04'));
    expect(cells.find((c) => c.date === '2026-11-12')).toMatchObject({ taken: true, free: false, weekdayMatch: true });
    expect(cells.find((c) => c.date === '2026-11-20')).toMatchObject({ taken: true, free: false }); // bento day
    expect(cells.find((c) => c.date === '2026-11-27')).toMatchObject({ taken: true });
  });
});

describe('US-E2-05/AC7 moving the whole day to a free date', () => {
  const freed = emptyOut(draftFromExtraction(extraction()), '2026-11-05');

  it('US-E2-05/AC7 the day moves with dishes, ingredients, allergen line and notes; the old date shows 献立に記載なし; the day is parent-edited; the count drops by 1', () => {
    const before = row(freed, '2026-11-04')!;
    const moved = moveDay(freed, d('2026-11-04'), d('2026-11-05'));
    const after = row(moved, '2026-11-05')!;
    expect(after.items).toEqual(before.items);
    expect(after.ingredients).toEqual(before.ingredients);
    expect(after.allergenDeclaration).toEqual(before.allergenDeclaration);
    expect(after.notes).toEqual(before.notes);
    expect(after.verification).toEqual({ status: 'parent-edited' });
    expect(row(moved, '2026-11-04')).toBeUndefined();
    expect(reviewRows(moved).find((r) => r.date === '2026-11-04')?.day).toBeNull(); // 献立に記載なし
    expect(unresolvedCount(moved)).toBe(unresolvedCount(freed) - 1);
    const dates = moved.days.map((x) => x.date);
    expect(dates).toEqual([...dates].sort()); // rows stay in date order
  });

  it('US-E2-05/AC9 the printed date and weekday stay, and the confirmed menu holds the corrected date as parent-edited with no entry for the old one', () => {
    const moved = moveDay(freed, d('2026-11-04'), d('2026-11-05'));
    expect(row(moved, '2026-11-05')).toMatchObject({ printedDateText: '4日（木）', printedWeekday: '木' });
    const r = toConfirmedMenu(moved, { confirmedAt: AT, previous: null });
    if (!r.ok) throw new Error(r.issues.join());
    expect(r.menu.days.find((x) => x.date === '2026-11-05')).toMatchObject({ printedDateText: '4日（木）', printedWeekday: '木', verification: { status: 'parent-edited' } });
    expect(r.menu.days.some((x) => x.date === '2026-11-04')).toBe(false);
  });

  it('US-E2-05/AC10 a corrected day can be moved again, also back to its original date; the flag does not come back', () => {
    const moved = moveDay(freed, d('2026-11-04'), d('2026-11-05'));
    expect(canFixDate(row(moved, '2026-11-05'))).toBe(true);
    const back = moveDay(moved, d('2026-11-05'), d('2026-11-04'));
    expect(row(back, '2026-11-04')?.verification).toEqual({ status: 'parent-edited' });
    expect(uncertainFields(back).some((f) => f.id === fieldIds.day('2026-11-04'))).toBe(false);
    expect(row(back, '2026-11-04')?.dateFix?.original).toBe('2026-11-04');
  });

  it('US-E2-05/AC10 「このままにする」 on a flagged day keeps the date and stores it uncertain-accepted', () => {
    const accepted = acceptField(freed, fieldIds.day('2026-11-04'));
    expect(row(accepted, '2026-11-04')?.verification).toEqual({ status: 'uncertain-accepted', reason: 'weekday-mismatch' });
    const r = toConfirmedMenu(accepted, { confirmedAt: AT, previous: null });
    expect(r.ok).toBe(true);
  });

  it('US-E2-05/AC8 a forced move onto a taken date, the current date, another month or from an uncorrectable day returns the same draft', () => {
    const draft = draftFromExtraction(extraction());
    expect(moveDay(draft, d('2026-11-04'), d('2026-11-12'))).toBe(draft); // dishes
    expect(moveDay(draft, d('2026-11-04'), d('2026-11-20'))).toBe(draft); // 給食なし
    expect(moveDay(draft, d('2026-11-04'), d('2026-11-04'))).toBe(draft); // itself
    expect(moveDay(draft, d('2026-11-04'), d('2026-12-05'))).toBe(draft); // another month
    expect(moveDay(draft, d('2026-11-05'), d('2026-11-07'))).toBe(draft); // not flagged
  });

  it('US-E2-05/AC8 after the dishes of a taken date are removed it can be chosen; with no free date nothing can be chosen', () => {
    const draft = draftFromExtraction(extraction());
    const freeNow = emptyOut(draft, '2026-11-12');
    expect(dateFixCells(freeNow, d('2026-11-04')).find((c) => c.date === '2026-11-12')?.free).toBe(true);
    expect(row(moveDay(freeNow, d('2026-11-04'), d('2026-11-12')), '2026-11-12')?.items.length).toBeGreaterThan(0);
    let full = draft;
    for (const cell of dateFixCells(draft, d('2026-11-04')).filter((c) => c.free)) full = markNoLunch(full, cell.date as LocalDate, '給食なし');
    expect(dateFixCells(full, d('2026-11-04')).some((c) => c.free)).toBe(false);
  });

  it('US-E2-05/AC10 the correction is draft-only: the pending extraction still shows the day flagged', () => {
    const extracted = extraction();
    const fresh = draftFromExtraction(extracted);
    void moveDay(emptyOut(fresh, '2026-11-05'), d('2026-11-04'), d('2026-11-05'));
    expect(uncertainFields(draftFromExtraction(extracted)).some((f) => f.id === fieldIds.day('2026-11-04'))).toBe(true);
  });
});

describe('US-E4-01/AC21 the ambiguity choice on review', () => {
  const base = (items: string[]) => {
    const c = confirmedOf([day('2026-11-16', items), day('2026-11-17', ['ごはん'])]);
    return draftFromExtraction({
      id: 'ext-2026-11-aaaaaaaa',
      contract: 'extracted-menu/1',
      targetMonth: '2026-11',
      detectedMonth: '2026-11',
      source: { kind: 'manual', fetchedAt: AT },
      days: c.days,
      noLunchDays: [],
      outOfMonthDays: [],
      warnings: [],
      extractedAt: AT,
    });
  };

  it('US-E4-01/AC21 a chosen candidate is stored as resolvedIds; text and verification are unchanged; the chooser is not an uncertain field and does not block confirming', () => {
    const draft = base(['もも', 'あじ']);
    const chosen = chooseAmbiguity(dict, draft, d('2026-11-16'), 0, ['ing-peach']);
    expect(row(chosen, '2026-11-16')?.items[0]).toMatchObject({ text: 'もも', resolvedIds: ['ing-peach'], verification: { status: 'ok' } });
    expect(uncertainFields(chosen)).toHaveLength(0);
    expect(confirmBlock(chosen)).toBeNull();
    const r = toConfirmedMenu(chosen, { confirmedAt: AT, previous: null, dictionary: dict });
    if (!r.ok) throw new Error(r.issues.join());
    expect(r.menu.days[0]?.items[0]).toMatchObject({ text: 'もも', resolvedIds: ['ing-peach'] });
    expect(r.menu.days[0]?.items[1]).not.toHaveProperty('resolvedIds'); // あじ unanswered
  });

  it('US-E4-01/AC21 the non-food reading is stored as []; 「わからない」 (null) leaves the field absent', () => {
    const draft = base(['もも', 'あじ']);
    const nonFood = chooseAmbiguity(dict, draft, d('2026-11-16'), 1, []);
    expect(row(nonFood, '2026-11-16')?.items[1]?.resolvedIds).toEqual([]);
    const unsure = chooseAmbiguity(dict, nonFood, d('2026-11-16'), 1, null);
    expect(row(unsure, '2026-11-16')?.items[1]).not.toHaveProperty('resolvedIds');
  });

  it('US-E4-01/AC21 a choice that is not a candidate, [] for a group without a non-food reading, or a choice on a text with nothing unresolved changes nothing', () => {
    const draft = base(['もも', 'ごはん']);
    expect(chooseAmbiguity(dict, draft, d('2026-11-16'), 0, ['ing-apple'])).toBe(draft);
    expect(chooseAmbiguity(dict, draft, d('2026-11-16'), 0, [])).toBe(draft);
    expect(chooseAmbiguity(dict, draft, d('2026-11-16'), 1, ['ing-rice'])).toBe(draft);
    expect(chooseAmbiguity(dict, draft, d('2026-11-16'), 9, null)).toBe(draft);
  });

  it('US-E4-01/AC21 editing the text drops the choice (it belonged to the old text); a stored choice that breaks the rule blocks the confirm', () => {
    const chosen = chooseAmbiguity(dict, base(['もも']), d('2026-11-16'), 0, ['ing-peach']);
    expect(row(editItemText(chosen, d('2026-11-16'), 0, 'もも缶'), '2026-11-16')?.items[0]).not.toHaveProperty('resolvedIds');
    const forged = editItemText(chosen, d('2026-11-16'), 0, 'ごはん');
    forged.days[0]!.items[0] = { ...forged.days[0]!.items[0]!, resolvedIds: ['ing-peach'] };
    const r = toConfirmedMenu(forged, { confirmedAt: AT, previous: null, dictionary: dict });
    expect(r).toEqual({ ok: false, issues: ['resolved-ids-candidates 2026-11-16'] });
  });
});
