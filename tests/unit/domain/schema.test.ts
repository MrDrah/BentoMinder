// Contract v1 schemas (docs/ba/data-contract.md): every rule id is produced at least once,
// on fixtures, and every issue message is the rule id.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  assessmentOverrideSchema,
  bentoMinderStoreSchema,
  childProfileSchema,
  confirmedMenuSchema,
  dayDecisionSchema,
  extractedDaySchema,
  extractedMenuJsonSchema,
  extractedMenuSchema,
  isHttpsUrl,
  isTimestamp,
  menuMonthSchema,
  menuSourceSchema,
  reminderLogEntrySchema,
  settingsSchema,
  toRuleIssues,
  verificationSchema,
  allergenDeclarationSchema,
} from '../../../src/domain/schema/index.ts';
import { clone, storeV1 } from '../helpers/fixtures.ts';

function rules(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  return r.success ? [] : toRuleIssues(r.error).map((i) => i.rule);
}

const base = storeV1();
const menuMonth = () => clone(base.menus['2026-11']!);
const extraction = () => clone(menuMonth().extractions[0]!);
const confirmed = () => clone(menuMonth().confirmed!);
const day = () => clone(extraction().days[0]!);
const profile = () => clone(base.profile!);
const settings = () => clone(base.settings);
const bento = () => clone(base.decisions['2026-11-04']!);
const school = () => clone(base.decisions['2026-11-05']!);
const override = () => clone(base.overrides['2026-11-05']!);
const logEntry = () => clone(base.reminderLog[0]!);

describe('US-E10-02/AC1 the store carries schemaVersion 1 and validates against contract v1', () => {
  it('US-E10-02/AC1 the frozen v1 fixture validates', () => {
    expect(rules(bentoMinderStoreSchema, base)).toEqual([]);
    expect(base.schemaVersion).toBe(1);
  });

  it('US-E10-02/AC1 any other schemaVersion is not a v1 store', () => {
    expect(bentoMinderStoreSchema.safeParse({ ...clone(base), schemaVersion: 2 }).success).toBe(false);
  });
});

describe('US-E10-05 stored data matches the data contract: conventions (§2)', () => {
  it('US-E10-05 rejects impossible dates, months, timestamps and clock times', () => {
    expect(rules(dayDecisionSchema, { ...bento(), date: '2027-02-29' })).toContain('date-invalid');
    expect(rules(menuMonthSchema, { ...menuMonth(), month: '2026-13' })).toContain('month-invalid');
    expect(rules(dayDecisionSchema, { ...bento(), decidedAt: '2026-11-01 10:12' })).toContain('timestamp-invalid');
    const s = settings();
    s.reminders.dayBefore.time = '17:20';
    expect(rules(settingsSchema, s)).toContain('time-invalid');
    expect(isTimestamp('2026-11-03T17:30:00Z')).toBe(true);
    expect(isTimestamp('2026-11-03T24:30:00+09:00')).toBe(false);
    expect(isTimestamp('2027-02-29T10:00:00+09:00')).toBe(false);
  });

  it('US-E10-05 rejects unknown fields (BR-20: no birthdate on a profile)', () => {
    expect(rules(childProfileSchema, { ...profile(), birthdate: '2021-04-01' })).toContain('unknown-field');
    expect(rules(bentoMinderStoreSchema, { ...clone(base), extra: 1 })).toContain('unknown-field');
  });

  it('US-E10-05 rejects bad ids, untrimmed strings, empty ja text and missing owners', () => {
    expect(rules(childProfileSchema, { ...profile(), likedIds: ['Chicken'] })).toContain('id-format');
    expect(rules(childProfileSchema, { ...profile(), nickname: ' はな ' })).toContain('string-untrimmed');
    expect(rules(dayDecisionSchema, { ...bento(), recipeNameSnapshot: { ja: ' ' } })).toContain('l10n-ja-missing');
    expect(rules(childProfileSchema, { ...profile(), ownerId: '' })).toContain('meta-owner');
  });

  it('US-E10-05 rejects updatedAt before createdAt on every record kind', () => {
    const early = '2026-01-01T00:00:00+09:00';
    expect(rules(childProfileSchema, { ...profile(), updatedAt: early })).toContain('meta-timestamps');
    expect(rules(settingsSchema, { ...settings(), updatedAt: early })).toContain('meta-timestamps');
    expect(rules(menuMonthSchema, { ...menuMonth(), updatedAt: early })).toContain('meta-timestamps');
    expect(rules(assessmentOverrideSchema, { ...override(), updatedAt: early })).toContain('meta-timestamps');
    expect(rules(dayDecisionSchema, { ...bento(), updatedAt: early })).toContain('meta-timestamps');
    expect(rules(bentoMinderStoreSchema, { ...clone(base), updatedAt: early })).toContain('meta-timestamps');
  });

  it('US-E10-05 enforces list, text and number bounds', () => {
    expect(rules(childProfileSchema, { ...profile(), likedIds: ['ing-egg', 'ing-egg'] })).toContain('list-unique');
    const many = Array.from({ length: 31 }, (_, i) => `ing-x${i}`);
    expect(rules(childProfileSchema, { ...profile(), likedIds: many })).toContain('list-length');
    expect(rules(childProfileSchema, { ...profile(), nickname: 'あ'.repeat(21) })).toContain('text-length');
    expect(rules(settingsSchema, { ...settings(), nextMonthPromptFromDay: 29 })).toContain('number-range');
  });
});

describe('US-E10-05 settings and reminder log (§3.9)', () => {
  it('US-E10-05 refuses an enabled v1 reservation reminder in the MVP', () => {
    const s = settings();
    expect(rules(settingsSchema, { ...s, reminders: { ...s.reminders, reservation: { enabled: false, time: '08:00' } } })).toEqual([]);
    expect(rules(settingsSchema, { ...s, reminders: { ...s.reminders, reservation: { enabled: true, time: '08:00' } } })).toContain(
      'settings-reservation-v1-only',
    );
  });

  it('US-E10-05 checks reminder keys and expiry', () => {
    expect(rules(reminderLogEntrySchema, logEntry())).toEqual([]);
    expect(rules(reminderLogEntrySchema, { ...logEntry(), key: 'day-before:2026-11-02' })).toContain('reminder-key-format');
    expect(rules(reminderLogEntrySchema, { ...logEntry(), key: 'weekly:2026-02-30' })).toContain('reminder-key-format');
    expect(rules(reminderLogEntrySchema, { ...logEntry(), expiresAt: logEntry().dueAt })).toContain('reminder-expiry-after-due');
  });
});

describe('US-E10-05 child profile (§3.2)', () => {
  it('US-E10-05 likes and dislikes are disjoint', () => {
    expect(rules(childProfileSchema, { ...profile(), likedIds: ['ing-egg'], dislikedIds: ['ing-egg'] })).toContain(
      'profile-like-dislike-overlap',
    );
  });

  it('US-E10-05 allergy status matches the listed allergens and exclusions', () => {
    expect(rules(childProfileSchema, { ...profile(), allergyStatus: 'none-known' })).toContain('profile-allergy-status');
    expect(rules(childProfileSchema, { ...profile(), allergyStatus: 'unknown' })).toContain('profile-allergy-status');
    expect(rules(childProfileSchema, { ...profile(), knownAllergenIds: [] })).toContain('profile-allergy-status');
    expect(rules(childProfileSchema, { ...profile(), knownAllergenIds: [], excludedIngredientIds: ['ing-tomato'] })).toEqual([]);
    expect(rules(childProfileSchema, { ...profile(), allergyStatus: 'unknown', knownAllergenIds: [] })).toEqual([]);
  });
});

describe('US-E10-05 extracted menu (§3.3)', () => {
  it('US-E10-05 an uncertain verification needs a reason', () => {
    expect(rules(verificationSchema, { status: 'uncertain' })).toContain('verification-reason-required');
    expect(rules(verificationSchema, { status: 'uncertain', reason: 'low-legibility' })).toEqual([]);
  });

  it('US-E10-05 allergen declarations never infer absence (BR-08)', () => {
    const decl = day().allergenDeclaration;
    expect(rules(allergenDeclarationSchema, { ...decl, allergenIds: ['alg-egg'] })).toContain('allergen-ids-declared-only');
    expect(rules(allergenDeclarationSchema, { ...decl, status: 'declared-none' })).toContain('allergen-absence-not-inferred');
    expect(rules(allergenDeclarationSchema, { ...decl, status: 'declared-none', rawText: 'なし' })).toEqual([]);
  });

  it('US-E10-05 ingredients exist only when the PDF lists them (BR-11)', () => {
    expect(rules(extractedDaySchema, { ...day(), ingredientsStatus: 'listed' })).toContain('ingredients-listed-only');
    const listed = clone(extraction().days[1]!);
    expect(rules(extractedDaySchema, listed)).toEqual([]);
    expect(rules(extractedDaySchema, { ...listed, ingredientsStatus: 'not-listed' })).toContain('ingredients-listed-only');
  });

  it('US-E10-05 a printed weekday that disagrees with the date must be flagged', () => {
    expect(rules(extractedDaySchema, { ...day(), printedWeekday: '木' })).toContain('weekday-mismatch');
    const flagged = { ...day(), printedWeekday: '木', verification: { status: 'uncertain', reason: 'weekday-mismatch' } };
    expect(rules(extractedDaySchema, flagged)).toEqual([]);
    expect(rules(extractedDaySchema, { ...flagged, verification: { status: 'parent-edited' } })).toEqual([]);
    expect(rules(extractedDaySchema, { ...day(), printedWeekday: null })).toEqual([]);
  });

  it('US-E10-05 menu sources: https URLs only, required fields per kind (BR-14)', () => {
    const src = extraction().source;
    expect(rules(menuSourceSchema, { ...src, kind: 'url' })).toContain('menu-source-field-required');
    expect(rules(menuSourceSchema, { ...src, kind: 'url', url: 'http://example-kinder.test/m.pdf' })).toContain('menu-source-url-https');
    expect(rules(menuSourceSchema, { ...src, kind: 'url', url: 'https://example-kinder.test/m.pdf' })).toEqual([]);
    expect(rules(menuSourceSchema, { ...src, kind: 'upload' })).toContain('menu-source-field-required');
    expect(rules(menuSourceSchema, { ...src, kind: 'upload', filename: 'm.pdf', url: 'http://a.test/m.pdf' })).toContain('menu-source-url-https');
    expect(rules(menuSourceSchema, { ...src, kind: 'upload', filename: 'm.pdf', url: 'https://a.test/m.pdf' })).toEqual([]);
    expect(rules(menuSourceSchema, { kind: 'fixture', fetchedAt: src.fetchedAt })).toContain('menu-source-field-required');
    expect(rules(menuSourceSchema, { ...src, sha256: 'ABC' })).toContain('menu-source-field-required');
    expect(rules(menuSourceSchema, { kind: 'manual', fetchedAt: src.fetchedAt })).toEqual([]);
    expect(isHttpsUrl('https://a.test:8443/m.pdf')).toBe(false);
    expect(isHttpsUrl('https://a.test:443/m.pdf')).toBe(true);
    expect(isHttpsUrl('not a url')).toBe(false);
  });

  it('US-E2-01/AC3 a menu source URL longer than 2,048 characters fails text-length (BR-14)', () => {
    const src = extraction().source;
    const prefix = 'https://example-kinder.test/';
    const url2048 = prefix + 'a'.repeat(2048 - prefix.length);
    expect(rules(menuSourceSchema, { ...src, kind: 'url', url: url2048 })).toEqual([]);
    expect(rules(menuSourceSchema, { ...src, kind: 'url', url: `${url2048}a` })).toEqual(['text-length']);
  });

  it('US-E3-06/AC6 the root store requires nextMonthCardHiddenOn: a Tokyo date or null', () => {
    expect(rules(bentoMinderStoreSchema, { ...clone(base), nextMonthCardHiddenOn: '2026-11-20' })).toEqual([]);
    expect(rules(bentoMinderStoreSchema, { ...clone(base), nextMonthCardHiddenOn: '2026-11-31' })).toContain('date-invalid');
    const { nextMonthCardHiddenOn: _omit, ...withoutField } = clone(base);
    void _omit;
    expect(bentoMinderStoreSchema.safeParse(withoutField).success).toBe(false);
  });

  it('US-E10-05 days are unique, sorted, disjoint from no-lunch days and inside the target month', () => {
    const e = extraction();
    expect(rules(extractedMenuSchema, e)).toEqual([]);
    expect(rules(extractedMenuSchema, { ...e, days: [e.days[1], e.days[0]] })).toContain('days-unique-sorted');
    const dupNoLunch = [e.noLunchDays[0], e.noLunchDays[0]];
    expect(rules(extractedMenuSchema, { ...e, noLunchDays: dupNoLunch })).toContain('days-unique-sorted');
    const clash = { ...e.noLunchDays[0]!, date: '2026-11-04' };
    expect(rules(extractedMenuSchema, { ...e, noLunchDays: [clash] })).toContain('days-disjoint');
    const outside = { ...e.noLunchDays[0]!, date: '2026-12-01' };
    expect(rules(extractedMenuSchema, { ...e, noLunchDays: [outside] })).toContain('extracted-day-outside-month');
  });

  it('US-E10-05 out-of-month entries lie outside the month, unique and sorted', () => {
    const e = extraction();
    const dec = { ...e.noLunchDays[0]!, date: '2026-12-01' };
    const ok = { ...e, outOfMonthDays: [{ kind: 'no-lunch-day', noLunchDay: dec }, { kind: 'lunch-day', day: { ...e.days[0]!, date: '2026-12-02', printedWeekday: null } }] };
    expect(rules(extractedMenuSchema, ok)).toEqual([]);
    const inside = { ...e, outOfMonthDays: [{ kind: 'lunch-day', day: e.days[0] }] };
    expect(rules(extractedMenuSchema, inside)).toContain('out-of-month-entry');
    const dup = { ...e, outOfMonthDays: [{ kind: 'no-lunch-day', noLunchDay: dec }, { kind: 'no-lunch-day', noLunchDay: dec }] };
    expect(rules(extractedMenuSchema, dup)).toContain('out-of-month-entry');
  });

  it('US-E10-05 the model may only emit ok or uncertain', () => {
    const e = extraction();
    e.days[0]!.items[0]!.verification = { status: 'parent-edited' };
    expect(rules(extractedMenuSchema, e)).toContain('verification-status-source');
    expect(rules(extractedMenuSchema, { ...e, source: { kind: 'manual', fetchedAt: e.source.fetchedAt } })).toEqual([]);
  });

  it('exports a JSON Schema for structured output (ADR 002)', () => {
    const schema = extractedMenuJsonSchema();
    expect(schema['type']).toBe('object');
    expect(schema['additionalProperties']).toBe(false);
  });
});

describe('US-E10-05 confirmed menu and menu month (§3.1, §3.4)', () => {
  it('US-E10-05 a confirmed menu has no uncertain field left and is not empty', () => {
    const c = confirmed();
    expect(rules(confirmedMenuSchema, c)).toEqual([]);
    c.days[0]!.items[1]!.verification = { status: 'uncertain', reason: 'low-legibility' };
    expect(rules(confirmedMenuSchema, c)).toContain('confirmed-no-uncertain');
    const c2 = confirmed();
    c2.noLunchDays[0]!.verification = { status: 'uncertain', reason: 'other' };
    expect(rules(confirmedMenuSchema, c2)).toContain('confirmed-no-uncertain');
    expect(rules(confirmedMenuSchema, { ...confirmed(), days: [], noLunchDays: [] })).toContain('confirmed-not-empty');
  });

  it('US-E10-05 confirmed days are in the month, sorted and disjoint', () => {
    const c = confirmed();
    expect(rules(confirmedMenuSchema, { ...c, month: '2026-12' })).toContain('confirmed-days-in-month');
    expect(rules(confirmedMenuSchema, { ...c, days: [c.days[1], c.days[0]] })).toContain('days-unique-sorted');
    expect(rules(confirmedMenuSchema, { ...c, noLunchDays: [{ ...c.noLunchDays[0]!, date: '2026-11-05' }] })).toContain(
      'confirmed-days-disjoint',
    );
    expect(rules(confirmedMenuSchema, { ...c, changedDatesSincePrevious: ['2026-11-04'] })).toContain('changed-dates-first-version');
    expect(rules(confirmedMenuSchema, { ...c, version: 2, changedDatesSincePrevious: ['2026-11-04'] })).toEqual([]);
  });

  it('US-E10-05 extraction ids resolve and months agree', () => {
    const mm = menuMonth();
    expect(rules(menuMonthSchema, { ...mm, confirmed: { ...mm.confirmed!, extractionId: 'ext-2026-11-00000000' } })).toContain(
      'extraction-resolves',
    );
    expect(rules(menuMonthSchema, { ...mm, confirmed: { ...mm.confirmed!, extractionId: null } })).toEqual([]);
    expect(rules(menuMonthSchema, { ...mm, pendingReviewExtractionId: 'ext-2026-11-00000000' })).toContain('extraction-resolves');
    expect(rules(menuMonthSchema, { ...mm, pendingReviewExtractionId: 'ext-2026-11-3fa9c2d1' })).toEqual([]);
    expect(rules(menuMonthSchema, { ...mm, month: '2026-12' })).toContain('menu-month-mismatch');
  });
});

describe('US-E10-05 day decisions (§3.6)', () => {
  it('US-E10-05 the fixture decisions validate', () => {
    expect(rules(dayDecisionSchema, bento())).toEqual([]);
    expect(rules(dayDecisionSchema, school())).toEqual([]);
  });

  it('US-E10-05 no-school-lunch is display-only and never stored', () => {
    expect(rules(dayDecisionSchema, { ...school(), state: 'no-school-lunch', reservationDoneExternally: false })).toContain(
      'decision-no-lunch-not-stored',
    );
  });

  it('US-E10-05/AC1 a homemade bento without a recipe is refused with decision-bento-requires-recipe (BR-03)', () => {
    const b = bento();
    delete b.recipeId;
    expect(rules(dayDecisionSchema, b)).toContain('decision-bento-requires-recipe');
    expect(rules(dayDecisionSchema, { ...school(), recipeId: 'rcp-kuma-onigiri' })).toContain('decision-bento-requires-recipe');
  });

  it('US-E10-05 bento snapshots and plannedAt exist exactly for bento plans (B10)', () => {
    const b = bento();
    delete b.recipeShortNameSnapshot;
    expect(rules(dayDecisionSchema, b)).toContain('decision-bento-snapshot');
    const b2 = bento();
    delete b2.recipeNameSnapshot;
    expect(rules(dayDecisionSchema, b2)).toContain('decision-bento-snapshot');
    const b3 = bento();
    delete b3.plannedAt;
    expect(rules(dayDecisionSchema, b3)).toContain('decision-planned-at');
    expect(rules(dayDecisionSchema, { ...bento(), recipeShortNameSnapshot: { ja: 'くまさんおにぎり弁当', en: 'Bear' } })).toContain(
      'recipe-short-name',
    );
  });

  it('US-E10-05 the reservation flag is only for school-lunch-planned (BR-19)', () => {
    expect(rules(dayDecisionSchema, { ...bento(), reservationDoneExternally: true })).toContain('decision-reservation-flag');
  });
});

describe('US-E10-05 root store (§3.1)', () => {
  it('US-E10-05 map keys equal the record keys', () => {
    const s = clone(base);
    s.decisions['2026-11-06'] = s.decisions['2026-11-04']!;
    expect(rules(bentoMinderStoreSchema, s)).toContain('store-key-mismatch');
    const s2 = clone(base);
    s2.overrides['2026-11-06'] = s2.overrides['2026-11-05']!;
    expect(rules(bentoMinderStoreSchema, s2)).toContain('store-key-mismatch');
    const s3 = clone(base);
    s3.menus['2026-12'] = s3.menus['2026-11']!;
    expect(rules(bentoMinderStoreSchema, s3)).toContain('store-key-mismatch');
  });

  it('US-E10-05 reminder keys are unique and the device id is a UUID v4', () => {
    const s = clone(base);
    s.reminderLog.push(clone(s.reminderLog[0]!));
    expect(rules(bentoMinderStoreSchema, s)).toContain('reminder-key-unique');
    expect(rules(bentoMinderStoreSchema, { ...clone(base), deviceId: 'device-1' })).toContain('device-id-invalid');
  });
});
