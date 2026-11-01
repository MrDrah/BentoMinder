// Store transitions of the import flow and the import-screen defaults (US-E1-01, US-E2, US-E3).
import { describe, expect, it } from 'vitest';
import {
  addAiUsage,
  bentoMinderStoreSchema,
  createEmptyStore,
  draftFromExtraction,
  findExtractionBySha,
  giveConsent,
  hasEverConfirmed,
  importMonthOptions,
  isValidMenuUrl,
  needsConsent,
  parseModelReply,
  pendingReview,
  recordExtraction,
  savedSourceUrl,
  startScreen,
  stampOrigin,
  storeConfirmedMenu,
  toConfirmedMenu,
  type BentoMinderStore,
  type ExtractedMenu,
} from '../../../../src/domain/index.ts';
import type { Instant, LocalDate, YearMonth } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';

const NOW = Date.parse('2026-10-28T01:00:00Z') as Instant; // 10:00 JST
const DEVICE = '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d';
const fresh = () => createEmptyStore({ deviceId: DEVICE, now: NOW });
const valid = (s: BentoMinderStore) => expect(bentoMinderStoreSchema.safeParse(s).success).toBe(true);

function extraction(sha: string, url = 'https://example-kinder.test/menu/2026-11.pdf'): ExtractedMenu {
  const r = loadFixture<{ response: { modelOutput: unknown } }>('menus/fixture-menu-2026-11/recorded/hand-1.json');
  const out = parseModelReply(JSON.stringify(r.response.modelOutput), {
    targetMonth: '2026-11' as YearMonth, sha256: sha, byteSize: 2000, model: 'gemini-3.8-flash', promptVersion: 1, at: '2026-10-28T10:00:00+09:00',
  });
  if (out.kind !== 'ok') throw new Error(out.kind);
  return stampOrigin(out.menu, { kind: 'url', url })!;
}

describe('US-E2-01 import from the school URL (BR-14)', () => {
  it('US-E2-01/AC2 only https URLs on port 443 are accepted', () => {
    for (const bad of ['http://example-kinder.test/menu/2026-11.pdf', 'https://example-kinder.test:8443/menu.pdf', 'ftp://example.test/menu.pdf', 'javascript:alert(1)', 'menu.pdf', 'https://u:p@a.test/m.pdf', 'https://a.test/m enu.pdf']) {
      expect(isValidMenuUrl(bad), bad).toBe(false);
    }
    expect(isValidMenuUrl('https://example-kinder.test/menu/2026-11.pdf')).toBe(true);
    expect(isValidMenuUrl('https://example-kinder.test:443/menu.pdf')).toBe(true);
  });

  it('US-E2-01/AC3 2,048 characters are accepted, 2,049 are not', () => {
    const prefix = 'https://example-kinder.test/';
    const url = prefix + 'a'.repeat(2048 - prefix.length);
    expect(isValidMenuUrl(url)).toBe(true);
    expect(isValidMenuUrl(`${url}a`)).toBe(false);
  });

  it('US-E2-01/AC5 the import offers this month and next; next is selected from the prompt day (OQ-21)', () => {
    expect(importMonthOptions('2026-11-19' as LocalDate, 20)).toEqual({ options: ['2026-11', '2026-12'], selected: '2026-11' });
    expect(importMonthOptions('2026-11-20' as LocalDate, 20).selected).toBe('2026-12');
    expect(importMonthOptions('2026-12-25' as LocalDate, 25)).toEqual({ options: ['2026-12', '2027-01'], selected: '2027-01' });
  });

  it('US-E2-01/AC1, AC4 the extraction is stored for review and its URL is offered next time', () => {
    const store = recordExtraction(fresh(), extraction('c'.repeat(64)), NOW, 'https://example-kinder.test/menu/2026-11.pdf');
    valid(store);
    expect(store.menus['2026-11']!.pendingReviewExtractionId).toBe('ext-2026-11-cccccccc');
    expect(savedSourceUrl(store)).toBe('https://example-kinder.test/menu/2026-11.pdf');
    expect(savedSourceUrl(fresh())).toBeNull();
    expect(pendingReview(store)?.month).toBe('2026-11');
    expect(pendingReview(fresh())).toBeNull();
  });
});

describe('US-E2-07 one AI extraction per PDF (BR-10)', () => {
  it('US-E2-07/AC1 a stored extraction is found by its sha256 (confirmed or not)', () => {
    const store = recordExtraction(fresh(), extraction('d'.repeat(64)), NOW);
    expect(findExtractionBySha(store, 'd'.repeat(64))?.id).toBe('ext-2026-11-dddddddd');
    expect(findExtractionBySha(store, 'd'.repeat(64), '2026-12')?.id).toBe('ext-2026-11-dddddddd');
    expect(findExtractionBySha(store, 'e'.repeat(64))).toBeNull();
  });

  it('contract §3.1: at most 3 extractions per month, the confirmed one is kept', () => {
    let store = recordExtraction(fresh(), extraction('1'.repeat(64)), NOW);
    const confirmed = toConfirmedMenu(draftFromExtraction(store.menus['2026-11']!.extractions[0]!), { confirmedAt: '2026-10-28T10:00:00+09:00', previous: null });
    if (!confirmed.ok) throw new Error('x');
    store = storeConfirmedMenu(store, confirmed.menu, NOW);
    for (const c of ['2', '3', '4', '5']) store = recordExtraction(store, extraction(c.repeat(64)), NOW);
    valid(store);
    expect(store.menus['2026-11']!.extractions.map((e) => e.id)).toEqual(['ext-2026-11-11111111', 'ext-2026-11-44444444', 'ext-2026-11-55555555']);
    // Re-opening the same extraction doesn't duplicate it.
    expect(recordExtraction(store, store.menus['2026-11']!.extractions[2]!, NOW).menus['2026-11']!.extractions).toHaveLength(3);
  });

  it('US-E2-07/AC3 aiUsage counts provider calls per Tokyo month, failures included', () => {
    let store = addAiUsage(fresh(), NOW, 2);
    store = addAiUsage(store, Date.parse('2026-10-31T15:30:00Z') as Instant, 1); // 2026-11-01 00:30 JST
    expect(store.aiUsage).toEqual({ '2026-10': 2, '2026-11': 1 });
    expect(addAiUsage(store, NOW, 0)).toBe(store);
    valid(store);
  });
});

describe('US-E2-08 consent before the first extraction', () => {
  it('US-E2-08/AC1, AC3 consent is needed until version 1 is stored, and again for a newer notice', () => {
    expect(needsConsent(fresh())).toBe(true);
    const store = giveConsent(fresh(), NOW);
    expect(store.consent).toEqual({ aiNoticeVersion: 1, consentedAt: '2026-10-28T10:00:00+09:00' });
    expect(needsConsent(store)).toBe(false);
    valid(store);
  });
});

describe('US-E1-01 where the app opens', () => {
  it('US-E1-01/AC1 no profile → step 1; US-E1-01/AC3 profile without a menu → step 2; US-E1-01/AC2 → calendar', () => {
    const store = fresh();
    expect(startScreen(store)).toBe('onboarding-1');
    const withProfile = { ...store, profile: loadFixture<BentoMinderStore>('state/v1.json').profile };
    expect(startScreen(withProfile)).toBe('onboarding-2');
    const confirmed = toConfirmedMenu(draftFromExtraction(extraction('f'.repeat(64))), { confirmedAt: '2026-10-28T10:00:00+09:00', previous: null });
    if (!confirmed.ok) throw new Error('x');
    const done = storeConfirmedMenu(recordExtraction(withProfile, extraction('f'.repeat(64)), NOW), confirmed.menu, NOW);
    valid(done);
    expect(hasEverConfirmed(done)).toBe(true);
    expect(done.menus['2026-11']!.pendingReviewExtractionId).toBeUndefined();
    expect(startScreen(done)).toBe('calendar');
  });

  it('US-E1-06/AC3 after the profile is deleted the app asks for a profile again, without re-importing the menu', () => {
    const v1 = loadFixture<BentoMinderStore>('state/v1.json');
    expect(startScreen({ ...v1, profile: null })).toBe('onboarding-1');
    expect(startScreen(v1)).toBe('calendar');
  });

  it('US-E3-04/AC1 a manual confirm creates the month without an extraction', () => {
    const r = toConfirmedMenu(
      { month: '2026-12' as YearMonth, mode: 'manual', extractionId: null, outOfMonth: [], warnings: [], days: [{ date: '2026-12-01' as LocalDate, printedDateText: null, printedWeekday: null, items: [{ text: 'うどん', kind: 'unknown', verification: { status: 'parent-entered' } }], ingredientsStatus: 'not-listed', allergenDeclaration: { status: 'not-declared', allergenIds: [], rawText: null, verification: { status: 'parent-entered' } }, notes: [], verification: { status: 'parent-entered' }, noLunch: null }] },
      { confirmedAt: '2026-10-28T10:00:00+09:00', previous: null },
    );
    if (!r.ok) throw new Error(r.issues.join());
    const store = storeConfirmedMenu(fresh(), r.menu, NOW);
    valid(store);
    expect(store.menus['2026-12']!.extractions).toEqual([]);
  });
});

describe('US-E2-08/AC3 notice versioning', () => {
  it('US-E2-08/AC3 consent for version 1 is not asked again for 1 but is asked again when the notice becomes version 2', () => {
    const v1 = giveConsent(fresh(), NOW, 1);
    expect(v1.consent?.aiNoticeVersion).toBe(1);
    expect(needsConsent(v1, 1)).toBe(false);
    expect(needsConsent(v1, 2)).toBe(true);
    const v2 = giveConsent(v1, NOW, 2);
    expect(v2.consent?.aiNoticeVersion).toBe(2);
    expect(needsConsent(v2, 2)).toBe(false);
    valid(v2);
  });
});
