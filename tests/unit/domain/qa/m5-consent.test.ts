// QA M5, US-E2-08/AC3: consent is stored with its notice version; a later version asks again. Derived from the AC.
import { describe, expect, it } from 'vitest';
import { giveConsent, needsConsent } from '../../../../src/domain/menu/store-ops.ts';
import type { Instant } from '../../../../src/domain/time/jst.ts';
import { clone, storeV1 } from '../../helpers/fixtures.ts';

const NOW = Date.parse('2026-10-28T01:00:00Z') as Instant;

describe('US-E2-08/AC1 AC3 consent and the notice version', () => {
  it('no consent stored: asks (AC1)', () => {
    const s = { ...clone(storeV1()), consent: null };
    expect(needsConsent(s)).toBe(true);
    expect(needsConsent(s, 1)).toBe(true);
    expect(needsConsent(s, 2)).toBe(true);
  });

  it('consent to version 1 is stored with its version and the later imports do not ask; version 2 asks again (AC3)', () => {
    const s = giveConsent({ ...clone(storeV1()), consent: null }, NOW, 1);
    expect(s.consent?.aiNoticeVersion).toBe(1);
    expect(needsConsent(s, 1)).toBe(false);
    expect(needsConsent(s, 2)).toBe(true);
    const s2 = giveConsent(s, NOW, 2);
    expect(s2.consent?.aiNoticeVersion).toBe(2);
    expect(needsConsent(s2, 2)).toBe(false);
    expect(needsConsent(s2, 3)).toBe(true);
  });

  it('the shipped notice is version 1 (data contract section 3.1: version 1 = the AC4 facts)', () => {
    const s = giveConsent({ ...clone(storeV1()), consent: null }, NOW);
    expect(s.consent?.aiNoticeVersion).toBe(1);
  });

  it('giving consent does not touch the child profile, the menus or the decisions (nothing else is changed)', () => {
    const before = { ...clone(storeV1()), consent: null };
    const after = giveConsent(before, NOW);
    expect(after.profile).toEqual(before.profile);
    expect(after.menus).toEqual(before.menus);
    expect(after.decisions).toEqual(before.decisions);
  });
});
