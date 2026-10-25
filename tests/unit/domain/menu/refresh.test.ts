// Menu refresh (US-E3-05; BR-05, BR-13): the needs-review list, flags and "open" dates, and that a
// refresh changes 0 decisions and 0 overrides.
import { describe, expect, it } from 'vitest';
import { createDayViewer, openReviewMonths, refreshReviewRows, upcomingSummary } from '../../../../src/domain/calendar/day-view.ts';
import { changedDates, draftFromExtraction, toConfirmedMenu } from '../../../../src/domain/menu/review.ts';
import { refreshReview } from '../../../../src/domain/menu/refresh.ts';
import { storeConfirmedMenu } from '../../../../src/domain/menu/store-ops.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/index.ts';
import { d, day, decisionRecord, dict, menu, noLunch, override, PS, storeWith } from '../../helpers/menus.ts';
import type { Instant, YearMonth } from '../../../../src/domain/time/jst.ts';

const view = createDayViewer(dict);
const TODAY = d('2026-11-02');

/** November 2026, version 2 after a refresh that changed the listed dates. */
function afterRefresh(options: { lunch: string[]; noLunchDays?: ReturnType<typeof noLunch>[]; changed: string[]; version?: number }, store: Partial<BentoMinderStore> = {}): BentoMinderStore {
  const base = storeWith({
    profile: PS,
    menus: [menu(options.lunch.map((x) => day(x, ['ごはん'])), options.noLunchDays ?? [], { version: options.version ?? 2, changedDatesSincePrevious: options.changed })],
    decisions: [
      decisionRecord('2026-11-04', 'homemade-bento-planned'),
      decisionRecord('2026-11-11', 'not-confirmed'),
      decisionRecord('2026-11-25', 'school-lunch-planned'),
    ],
    overrides: [override('2026-11-18', 'low-preference')],
  });
  return { ...base, ...store };
}

describe('US-E3-05/AC9 the review lists changed dates that carry an override, a bento plan or a not-confirmed decision', () => {
  it('US-E3-05/AC9 changedDatesSincePrevious [11-04, 11-18, 11-19] lists exactly 11-04 and 11-18; 11-11, 11-19 and 11-25 are not listed', () => {
    const s = afterRefresh({ lunch: ['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-19', '2026-11-25'], changed: ['2026-11-04', '2026-11-18', '2026-11-19'] });
    const rows = refreshReview(s.menus['2026-11']!.confirmed!, s.decisions, s.overrides);
    expect(rows.map((r) => [r.date, r.reasons])).toEqual([
      ['2026-11-04', ['planned']],
      ['2026-11-18', ['override']],
    ]);
  });

  it('US-E3-05/AC12 a not-confirmed record on a removed date is listed; a school-lunch-planned record on a no-lunch date is not (S10)', () => {
    const s = afterRefresh({ lunch: ['2026-11-04'], noLunchDays: [noLunch('2026-11-25', 'closed', '休園')], changed: ['2026-11-11', '2026-11-25'] });
    const rows = refreshReview(s.menus['2026-11']!.confirmed!, s.decisions, s.overrides);
    expect(rows).toEqual([{ date: '2026-11-11', reasons: ['not-confirmed'], detail: 'removed' }]);
  });

  it('US-E3-05/AC8 US-E3-05/AC11 an override on a date that became a no-lunch day or was removed is listed with why', () => {
    const noLunchNow = afterRefresh({ lunch: ['2026-11-04'], noLunchDays: [noLunch('2026-11-18')], changed: ['2026-11-18'] });
    expect(refreshReview(noLunchNow.menus['2026-11']!.confirmed!, noLunchNow.decisions, noLunchNow.overrides)).toEqual([{ date: '2026-11-18', reasons: ['override'], detail: 'now-no-lunch' }]);
    const removed = afterRefresh({ lunch: ['2026-11-04'], changed: ['2026-11-18'] });
    expect(refreshReview(removed.menus['2026-11']!.confirmed!, removed.decisions, removed.overrides)).toEqual([{ date: '2026-11-18', reasons: ['override'], detail: 'removed' }]);
  });

  it('US-E3-05/AC13 a refresh with nothing to review lists nothing', () => {
    const s = afterRefresh({ lunch: ['2026-11-04', '2026-11-05'], changed: ['2026-11-05'] });
    expect(refreshReview(s.menus['2026-11']!.confirmed!, s.decisions, s.overrides)).toEqual([]);
  });
});

describe('US-E3-05/AC1 US-E3-05/AC3 a refresh changes 0 decisions and 0 overrides (BR-05, BR-13)', () => {
  it('US-E3-05/AC1 replacing the month through the store operation leaves decisions and overrides byte-identical', () => {
    const before = afterRefresh({ lunch: ['2026-11-04', '2026-11-18'], changed: [], version: 1 });
    const next = menu(['2026-11-04', '2026-11-18', '2026-11-19'].map((x) => day(x, ['ごはん', 'ピーマンの炒めもの'])), [], { version: 2, changedDatesSincePrevious: ['2026-11-04', '2026-11-18', '2026-11-19'] });
    const after = storeConfirmedMenu(before, next, Date.parse('2026-11-02T01:00:00Z') as Instant);
    expect(JSON.stringify(after.decisions)).toBe(JSON.stringify(before.decisions));
    expect(JSON.stringify(after.overrides)).toBe(JSON.stringify(before.overrides));
  });

  it('US-E3-05/AC3 an override on a date whose dishes changed is kept and the day shows the changed line until the override is set again', () => {
    const s = afterRefresh({ lunch: ['2026-11-18'], changed: ['2026-11-18'] });
    const v = view(s, d('2026-11-18'), TODAY);
    expect(v.assessment?.override?.state).toBe('low-preference');
    expect(v.overrideChanged).toBe(true);
    expect(v.needsReviewBadge).toBe(true);
    const setAgain = { ...s, overrides: { '2026-11-18': override('2026-11-18', 'low-preference', 2) } };
    expect(view(setAgain, d('2026-11-18'), TODAY).overrideChanged).toBe(false);
    const laterVersion = { ...s, menus: { '2026-11': { ...s.menus['2026-11']!, confirmed: { ...s.menus['2026-11']!.confirmed!, version: 3, changedDatesSincePrevious: [] } } } };
    expect(view(laterVersion, d('2026-11-18'), TODAY).overrideChanged).toBe(false);
  });

  it('US-E3-05/AC8 a dormant override shows nothing (no-school-lunch, no label, no badge); it applies again with the changed line when the date is a school day', () => {
    const asNoLunch = afterRefresh({ lunch: ['2026-11-04'], noLunchDays: [noLunch('2026-11-18')], changed: ['2026-11-18'] });
    const v = view(asNoLunch, d('2026-11-18'), TODAY);
    expect(v.assessment).toMatchObject({ state: 'no-school-lunch', override: null });
    expect(v.needsReviewBadge).toBe(false);
    expect(v.canOverride).toBe(false);
    expect(asNoLunch.overrides['2026-11-18']?.state).toBe('low-preference'); // still stored
    const back = afterRefresh({ lunch: ['2026-11-04', '2026-11-18'], changed: ['2026-11-18'], version: 3 });
    const again = view(back, d('2026-11-18'), TODAY);
    expect(again.assessment?.override?.state).toBe('low-preference');
    expect(again.overrideChanged).toBe(true);
  });
});

describe('US-E3-05 the review list stays reachable while a listed date is open (Orchestrator ruling, M2 prep)', () => {
  it('US-E3-05/AC9 rows are computed from the stored records each time; resolved rows are marked, open ones counted', () => {
    const s = afterRefresh({ lunch: ['2026-11-18'], noLunchDays: [noLunch('2026-11-04')], changed: ['2026-11-04', '2026-11-11', '2026-11-18'] });
    const rows = refreshReviewRows(s, '2026-11' as YearMonth, TODAY, view);
    expect(rows.map((r) => [r.date, r.open])).toEqual([
      ['2026-11-04', true], // plan on a now no-lunch day: conflict badge
      ['2026-11-11', false], // not-confirmed record on a removed date: listed, dormant, no badge
      ['2026-11-18', true], // overridden, dishes changed
    ]);
    expect(openReviewMonths(s, TODAY, view)).toEqual([{ month: '2026-11', open: 2 }]);
  });

  it('US-E3-05/AC7 after clearing the plan and setting the override again the list has no open date and the link goes away', () => {
    const s = afterRefresh({ lunch: ['2026-11-18'], noLunchDays: [noLunch('2026-11-04')], changed: ['2026-11-04', '2026-11-18'] });
    const decisions = { ...s.decisions };
    delete decisions['2026-11-04'];
    const resolved = { ...s, decisions, overrides: { '2026-11-18': override('2026-11-18', 'low-preference', 2) } };
    expect(openReviewMonths(resolved, TODAY, view)).toEqual([]);
  });

  it('US-E3-05/AC7 a kept conflict keeps its marker (the date stays open)', () => {
    const s = afterRefresh({ lunch: [], noLunchDays: [noLunch('2026-11-04')], changed: ['2026-11-04'] });
    const kept = { ...s, decisions: { ...s.decisions, '2026-11-04': { ...s.decisions['2026-11-04']!, acknowledgedMenuVersion: 2 } } };
    expect(view(kept, d('2026-11-04'), TODAY).needsReviewBadge).toBe(true);
  });
});

describe('US-E5-01/AC7 upcoming summary', () => {
  it('lists the next 3 planned days from today, unacknowledged conflicts, not-confirmed days within 7 days and the low-preference count', () => {
    const lunch = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'].map((x) => day(x, x === '2026-11-03' ? ['ピーマンとなすのみそ炒め', 'ごはん'] : ['ごはん']));
    const s = storeWith({
      profile: PS,
      menus: [menu(lunch, [noLunch('2026-11-12')], { version: 2, changedDatesSincePrevious: ['2026-11-12'] })],
      decisions: [
        decisionRecord('2026-11-04', 'homemade-bento-planned'),
        decisionRecord('2026-11-05', 'homemade-bento-planned'),
        decisionRecord('2026-11-06', 'not-confirmed'),
        decisionRecord('2026-11-09', 'homemade-bento-planned'),
        decisionRecord('2026-11-10', 'homemade-bento-planned'),
        decisionRecord('2026-11-12', 'homemade-bento-planned'),
        decisionRecord('2026-10-30', 'homemade-bento-planned'),
      ],
    });
    const u = upcomingSummary(s, TODAY, view);
    expect(u.planned.map((p) => p.date)).toEqual(['2026-11-04', '2026-11-05', '2026-11-09']);
    expect(u.notConfirmed).toEqual(['2026-11-06']);
    expect(u.conflicts).toEqual(['2026-11-12']);
    expect(u.lowCount).toBe(1); // 11-03 is low-preference and still school lunch
    expect(u.firstLow).toBe('2026-11-03');
  });

  it('with nothing planned the summary is empty; a low-preference day that is planned as a bento is not counted', () => {
    const lunch = [day('2026-11-03', ['ピーマンとなすのみそ炒め', 'ごはん'])];
    const none = storeWith({ profile: PS, menus: [menu(lunch)] });
    expect(upcomingSummary(none, TODAY, view)).toMatchObject({ planned: [], conflicts: [], notConfirmed: [], lowCount: 1 });
    const planned = storeWith({ profile: PS, menus: [menu(lunch)], decisions: [decisionRecord('2026-11-03', 'homemade-bento-planned')] });
    expect(upcomingSummary(planned, TODAY, view).lowCount).toBe(0);
  });

  it('US-E5-05/AC2 not-confirmed days within the next 7 days appear (today to today + 6)', () => {
    const lunch = ['2026-11-02', '2026-11-08', '2026-11-09'].map((x) => day(x, ['ごはん']));
    const s = storeWith({ profile: PS, menus: [menu(lunch)], decisions: ['2026-11-02', '2026-11-08', '2026-11-09'].map((x) => decisionRecord(x, 'not-confirmed')) });
    expect(upcomingSummary(s, TODAY, view).notConfirmed).toEqual(['2026-11-02', '2026-11-08']);
  });
});

describe('contract §3.4 changedDatesSincePrevious is produced by the review', () => {
  it('a refresh version has +1 and its changed dates; ingredients-only edits do not make a date changed', () => {
    const first = menu([day('2026-11-04', ['ごはん']), day('2026-11-05', ['カレー'])], [noLunch('2026-11-27')]);
    const second = menu([day('2026-11-04', ['ごはん'], ['米']), day('2026-11-05', ['カレーうどん'])], [noLunch('2026-11-27', 'closed', '休園')]);
    expect(changedDates(first, second)).toEqual(['2026-11-05', '2026-11-27']);
    void draftFromExtraction;
    void toConfirmedMenu;
  });
});
