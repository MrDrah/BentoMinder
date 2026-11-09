// Pure store transitions for the import → review → confirm flow (US-E2, US-E3-01…04) and the
// rules that pick defaults on the import screen. Each function returns a new store; the UI
// saves it through the repository (which validates every write, US-E10-05).
import type { BentoMinderStore, ConfirmedMenu, ExtractedMenu, MenuMonth } from '../schema/index.ts';
import { MAX_URL_LENGTH, isHttpsUrl } from '../schema/extracted-menu.ts';
import { addMonths, monthOf, toJstTimestamp, todayJst, type Instant, type LocalDate, type YearMonth } from '../time/jst.ts';

/** US-E2-08/AC3, AC4: notice version 1 = the free-tier facts. Raising it asks again. */
export const AI_NOTICE_VERSION = 1;
/** Contract §3.1: at most 3 extractions per month, newest last. */
export const MAX_EXTRACTIONS_PER_MONTH = 3;

const touch = (store: BentoMinderStore, now: Instant): BentoMinderStore => ({ ...store, updatedAt: toJstTimestamp(now) });

/** US-E2-01/AC2–AC3 (BR-14): https on port 443, at most 2,048 characters, nothing else. */
export function isValidMenuUrl(url: string): boolean {
  return url.length <= MAX_URL_LENGTH && isHttpsUrl(url) && !/\s/.test(url) && !hasUserinfo(url);
}

function hasUserinfo(url: string): boolean {
  try {
    const u = new URL(url);
    return u.username !== '' || u.password !== '';
  } catch {
    return true;
  }
}

/** US-E2-01/AC5 (OQ-21): this month and next; next is preselected from the prompt day on. */
export function importMonthOptions(today: LocalDate, promptFromDay: number): { options: [YearMonth, YearMonth]; selected: YearMonth } {
  const current = monthOf(today);
  const next = addMonths(current, 1);
  return { options: [current, next], selected: Number(today.slice(8, 10)) >= promptFromDay ? next : current };
}

export function needsConsent(store: BentoMinderStore, noticeVersion: number = AI_NOTICE_VERSION): boolean {
  return store.consent === null || store.consent.aiNoticeVersion < noticeVersion;
}

export function giveConsent(store: BentoMinderStore, now: Instant, noticeVersion: number = AI_NOTICE_VERSION): BentoMinderStore {
  return { ...touch(store, now), consent: { aiNoticeVersion: noticeVersion, consentedAt: toJstTimestamp(now) } };
}

/** Contract §3.1 `aiUsage`: provider calls per Tokyo month, also for failed actions (BR-10). */
export function addAiUsage(store: BentoMinderStore, now: Instant, calls: number): BentoMinderStore {
  if (calls <= 0) return store;
  const month = monthOf(todayJst(now));
  return { ...touch(store, now), aiUsage: { ...store.aiUsage, [month]: (store.aiUsage[month] ?? 0) + calls } };
}

/** US-E2-07/AC1 (BR-10 layer 1): a stored extraction of the same PDF, confirmed or not. */
export function findExtractionBySha(store: BentoMinderStore, sha256: string, month?: string): ExtractedMenu | null {
  const months = Object.values(store.menus);
  const ordered = month === undefined ? months : [...months.filter((m) => m.month === month), ...months.filter((m) => m.month !== month)];
  for (const m of ordered) {
    const hit = [...m.extractions].reverse().find((e) => e.source.sha256 === sha256);
    if (hit !== undefined) return hit;
  }
  return null;
}

/** US-E2-01/AC4: the URL stored by the latest import is offered again. */
export function savedSourceUrl(store: BentoMinderStore): string | null {
  const withUrl = Object.values(store.menus)
    .filter((m) => m.sourceUrl !== undefined)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return withUrl.at(-1)?.sourceUrl ?? null;
}

/** The new month record belongs to the store's account (ADR 014, US-E13-04/AC5). */
function emptyMonth(month: string, now: Instant, ownerId: string): MenuMonth {
  const ts = toJstTimestamp(now);
  return { month, extractions: [], confirmed: null, ownerId, createdAt: ts, updatedAt: ts };
}

/**
 * Stores a validated extraction as the month's pending review (US-E2-04, US-E3-03/AC3). Keeps at
 * most 3, dropping the oldest one that the confirmed menu doesn't point at; a re-opened extraction
 * (same id) is not stored twice.
 */
export function recordExtraction(store: BentoMinderStore, menu: ExtractedMenu, now: Instant, sourceUrl?: string): BentoMinderStore {
  const ts = toJstTimestamp(now);
  const month = menu.targetMonth;
  const current = store.menus[month] ?? emptyMonth(month, now, store.settings.ownerId);
  let extractions = [...current.extractions.filter((e) => e.id !== menu.id), menu];
  while (extractions.length > MAX_EXTRACTIONS_PER_MONTH) {
    const keep = current.confirmed?.extractionId;
    const drop = extractions.findIndex((e) => e.id !== keep);
    extractions = extractions.filter((_, i) => i !== drop);
  }
  const next: MenuMonth = {
    ...current,
    extractions,
    pendingReviewExtractionId: menu.id,
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    updatedAt: ts,
  };
  return { ...touch(store, now), menus: { ...store.menus, [month]: next } };
}

/** US-E3-03/AC1 (BR-12): the confirmed menu becomes the month's menu; the pending review ends. */
export function storeConfirmedMenu(store: BentoMinderStore, confirmed: ConfirmedMenu, now: Instant): BentoMinderStore {
  const current = store.menus[confirmed.month] ?? emptyMonth(confirmed.month, now, store.settings.ownerId);
  const { pendingReviewExtractionId: _pending, ...rest } = current;
  void _pending;
  const next: MenuMonth = { ...rest, confirmed, updatedAt: toJstTimestamp(now) };
  return { ...touch(store, now), menus: { ...store.menus, [confirmed.month]: next } };
}

export function pendingReview(store: BentoMinderStore): { month: string; extraction: ExtractedMenu } | null {
  for (const m of Object.values(store.menus).sort((a, b) => a.month.localeCompare(b.month))) {
    const extraction = m.extractions.find((e) => e.id === m.pendingReviewExtractionId);
    if (extraction !== undefined) return { month: m.month, extraction };
  }
  return null;
}

export function hasEverConfirmed(store: BentoMinderStore): boolean {
  return Object.values(store.menus).some((m) => m.confirmed !== null);
}

/**
 * US-E1-01/AC1–AC3, US-E1-06/AC3: where the app opens. No profile → step 1; a profile but no
 * confirmed menu → step 2; otherwise the calendar.
 */
export function startScreen(store: BentoMinderStore): 'onboarding-1' | 'onboarding-2' | 'calendar' {
  if (store.profile === null) return 'onboarding-1';
  return hasEverConfirmed(store) ? 'calendar' : 'onboarding-2';
}
