// BR-22, US-E10-01/AC1, ADR 003 change log 2026-10-25 (D-M1-06): two tabs of one browser profile.
// A save from a tab that holds a stale copy is refused (compare-and-swap) and a `storage` event
// reloads an idle tab; neither tab's saved data is lost silently.
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
});

async function submitProfile(page: Page, nickname: string) {
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await page.getByTestId('input-nickname').fill(nickname);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
}

const storedNickname = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('bentominder.state');
    return raw === null ? null : (JSON.parse(raw) as { profile: { nickname: string } | null }).profile?.nickname ?? null;
  });

test('US-E10-01/AC1 a storage event reloads an idle second tab and tells the parent', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) await p.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
  await a.goto('./');
  await b.goto('./');
  await expect(b.getByTestId('ob-step-1')).toBeVisible();
  await submitProfile(a, 'タブA');
  await expect(a.getByTestId('ob-step-2')).toBeVisible();
  await expect(b.getByTestId('banner-updated-elsewhere')).toBeVisible();
  await b.getByTestId('banner-updated-elsewhere-dismiss').click();
  await expect(b.getByTestId('banner-updated-elsewhere')).toHaveCount(0);
  expect(await storedNickname(b)).toBe('タブA');
});

test('US-E10-01/AC1 a stale tab that missed the event cannot overwrite the other tab’s data', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) await p.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
  // tab B never hears about tab A's save: its page ignores every 'storage' listener, so only the
  // compare-and-swap on save protects the data
  await b.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (type === 'storage') return;
      return (original as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof original;
  });
  await a.goto('./');
  await b.goto('./');
  await expect(b.getByTestId('ob-step-1')).toBeVisible();
  await submitProfile(a, 'タブA');
  await expect(a.getByTestId('ob-step-2')).toBeVisible();
  await submitProfile(b, 'タブB');
  await expect(b.getByTestId('banner-updated-elsewhere')).toBeVisible();
  await expect(b.getByTestId('toast')).toContainText('別のタブ');
  expect(await storedNickname(b)).toBe('タブA');
});
