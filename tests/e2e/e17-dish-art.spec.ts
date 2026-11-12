// US-E17-01 dish illustrations on the production build, in both projects (mobile 390 px, desktop 1280 px):
// the frame carries data-dish-type on the library, the recommendations and the recipe page; the drawing is
// decorative; reduced motion has no animation; list cards animate only on hover or focus, one at a time; the
// header loop is finite and off-screen-paused; no image request; the frame does not move when the chunk arrives.
// Today is 2026-11-02 10:00 JST.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const TYPES = ['onigiri', 'rice-bowl', 'sandwich', 'noodles', 'egg', 'fried-chicken', 'meat-patty', 'meat-roll', 'grilled-fish', 'simmered', 'tofu', 'salad', 'soup', 'vegetable-side', 'fritter', 'dumpling', 'sweet', 'other'];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T01:00:00Z'));
  await seedStore(page, STATE);
});

const frames = (page: Page) => page.getByTestId('recipe-art');
/** Every frame on the screen has its drawing (the lazy chunk arrived). */
async function drawn(page: Page) {
  await expect(frames(page).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-testid="recipe-art"]')].filter((f) => f.querySelector('svg.dish') === null).length)).toBe(0);
}
/** The card (rec-card / library-row) of each running illustration animation. */
const runningCards = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running' && ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('.dish .a'))
      .map((a) => ((a.effect as KeyframeEffect).target as Element).closest('.library-row, .rec-card, .recipe__left')?.getAttribute('data-testid') ?? 'none'),
  );

test('US-E17-01/AC1 US-E17-01/AC3 the library, the recommendations and the recipe page show a frame with a listed dish type and one decorative drawing', async ({ page }) => {
  await page.goto('./#/recipes');
  await drawn(page);
  const n = await frames(page).count();
  expect(n).toBeGreaterThan(5);
  const check = async () => {
    const info = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="recipe-art"]')].map((f) => {
        const svgs = f.querySelectorAll('svg');
        const svg = svgs[0];
        return {
          type: (f as HTMLElement).dataset['dishType'],
          svgs: svgs.length,
          hidden: svg?.getAttribute('aria-hidden'),
          frameHidden: f.getAttribute('aria-hidden'),
          text: svg?.querySelectorAll('text,title,desc,image,filter,foreignObject').length,
          role: svg?.getAttribute('role'),
        };
      }),
    );
    for (const i of info) {
      expect(TYPES).toContain(i.type);
      expect(i).toMatchObject({ svgs: 1, hidden: 'true', frameHidden: 'true', text: 0, role: null });
    }
    return info.length;
  };
  expect(await check()).toBe(n);
  await page.goto('./#/recommend/2026-11-12');
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  await drawn(page);
  expect(await check()).toBeGreaterThanOrEqual(3);
  const id = (await page.getByTestId('rec-card-0').getAttribute('data-recipe-id')) as string;
  await page.goto(`./#/recipe/${id}`);
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
  await drawn(page);
  expect(await check()).toBe(1);
  // the frame types match the drawing set: every type of the library is one of the 18
  expect(await page.getByTestId('recipe-art').getAttribute('data-dish-type')).toMatch(new RegExp(`^(${TYPES.join('|')})$`));
});

test('US-E17-01/AC1 the frames keep the design sizes: card 72 or 120 px high, thumb 64 or 72 px wide, hero 150 px high', async ({ page }, info) => {
  await page.goto('./#/recommend/2026-11-12');
  await drawn(page);
  const card = (await page.getByTestId('rec-card-0').getByTestId('recipe-art').boundingBox())!;
  expect(card.height).toBe(info.project.name === 'mobile' ? 72 : 120);
  await page.goto('./#/recipes');
  await drawn(page);
  const thumb = (await frames(page).first().boundingBox())!;
  expect(thumb.width).toBe(72); // the library row's existing thumb width (recommend.css)
  expect(thumb.height).toBeGreaterThanOrEqual(64);
  await page.goto('./#/recommend/2026-11-12');
  await page.getByTestId('recs-more').click();
  await drawn(page);
  const compact = (await page.getByTestId('recs-more-list').getByTestId('recipe-art').first().boundingBox())!;
  expect(compact.width).toBe(64);
  expect(compact.height).toBeGreaterThanOrEqual(64);
  await page.goto('./#/recipe/rcp-delish-panda-onigiri');
  await drawn(page);
  const hero = (await frames(page).first().boundingBox())!;
  expect(hero.height).toBe(150);
  const svg = (await page.locator('svg.dish').first().boundingBox())!;
  expect(svg.height).toBe(150);
});

test('US-E17-01/AC4 reduced motion: no animation exists on the library, the recommendations or the recipe page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [hash, ready] of [
    ['./#/recipes', 'screen-library'],
    ['./#/recommend/2026-11-12', 'screen-recs'],
    ['./#/recipe/rcp-delish-panda-onigiri', 'screen-recipe'],
  ] as const) {
    await page.goto(hash);
    await expect(page.getByTestId(ready)).toBeVisible();
    await drawn(page);
    expect(await page.evaluate(() => document.querySelector('.dish .s1') === null || getComputedStyle(document.querySelector('.dish .s1')!).opacity)).not.toBe('0');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  }
});

test('US-E17-01/AC7 a list does not animate until hover or focus, and only the one card animates', async ({ page }) => {
  await page.goto('./#/recipes');
  await drawn(page);
  await page.waitForTimeout(400); // the 120 ms fade-in has ended
  expect(await runningCards(page)).toEqual([]);
  const links = page.getByTestId('library-list').getByRole('link');
  // keyboard focus on one row
  await links.nth(1).focus();
  const focused = await runningCards(page);
  expect(focused.length).toBeGreaterThan(0);
  expect(new Set(focused).size).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  expect(await runningCards(page)).toEqual([]);
  // pointer hover (only where the device can hover)
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    await links.nth(2).hover();
    const hovered = await runningCards(page);
    expect(hovered.length).toBeGreaterThan(0);
    expect(new Set(hovered).size).toBe(1);
    await page.mouse.move(0, 0);
    expect(await runningCards(page)).toEqual([]);
  }
  // the recommendation cards behave the same
  await page.goto('./#/recommend/2026-11-12');
  await drawn(page);
  await page.waitForTimeout(400);
  expect(await runningCards(page)).toEqual([]);
  await page.getByTestId('rec-card-1-confirm').focus();
  const rec = await runningCards(page);
  expect(rec.length).toBeGreaterThan(0);
  expect(new Set(rec)).toEqual(new Set(['rec-card-1']));
});

test('US-E17-01/AC7 the recipe page header loops 5 cycles, at most 2 groups, transform and opacity only, paused when off-screen', async ({ page }) => {
  await page.goto('./#/recipe/rcp-delish-penguin-seiretsu-bento');
  await drawn(page);
  const loop = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => ((a.effect as KeyframeEffect).target as Element | null)?.closest('.dish .a'))
      .map((a) => {
        const e = a.effect as KeyframeEffect;
        return {
          target: (e.target as Element).closest('.a')!.getAttribute('class'),
          iterations: e.getComputedTiming().iterations,
          duration: Number(e.getComputedTiming().duration),
          state: a.playState,
          props: [...new Set(e.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))],
        };
      }),
  );
  expect(loop.length).toBeGreaterThan(0);
  expect(new Set(loop.map((l) => l.target)).size).toBeLessThanOrEqual(2);
  for (const l of loop) {
    expect(l.iterations).toBe(5);
    expect(l.duration).toBeGreaterThanOrEqual(2400);
    expect(l.state).toBe('running');
    for (const p of l.props) expect(['opacity', 'transform']).toContain(p);
  }
  // off-screen: push the header out of view; the loop pauses, and resumes when it is back
  await page.evaluate(() => {
    (document.querySelector('[data-testid="screen-recipe"]') as HTMLElement).style.paddingTop = '4000px';
    window.scrollTo(0, 3000);
  });
  await expect(page.locator('svg.dish')).toHaveAttribute('data-paused', '');
  expect(await runningCards(page)).toEqual([]);
  await page.evaluate(() => {
    (document.querySelector('[data-testid="screen-recipe"]') as HTMLElement).style.paddingTop = '0';
    window.scrollTo(0, 0);
  });
  await expect(page.locator('svg.dish')).not.toHaveAttribute('data-paused', '');
  expect((await runningCards(page)).length).toBeGreaterThan(0);
});

test('US-E17-01/AC8 no image is requested, no SVG filter exists and no element has a CSS filter', async ({ page }) => {
  const images: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' || /\.(svg|png|jpe?g|gif|webp|avif)(\?|$)/i.test(r.url())) images.push(r.url());
  });
  for (const hash of ['./#/recipes', './#/recommend/2026-11-12', './#/recipe/rcp-delish-panda-onigiri']) {
    await page.goto(hash);
    await drawn(page);
  }
  expect(images).toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll('svg.dish filter').length + [...document.querySelectorAll('svg.dish, svg.dish *')].filter((e) => getComputedStyle(e).filter !== 'none').length)).toBe(0);
});

for (const [name, hash] of [
  ['library', './#/recipes'],
  ['recommendations', './#/recommend/2026-11-12'],
  ['recipe page', './#/recipe/rcp-delish-panda-onigiri'],
] as const) {
  test(`US-E17-01/AC6 ${name}: usable before the chunk arrives, and the frames do not move or resize when the drawings appear`, async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/assets/dish-art-*.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(hash);
    await expect(frames(page).first()).toBeVisible();
    expect(await page.locator('svg.dish').count()).toBe(0); // the frame (panel and stripe) is first
    const measure = () =>
      page.evaluate(() => ({
        boxes: [...document.querySelectorAll('[data-testid="recipe-art"]')].map((f) => JSON.stringify(f.getBoundingClientRect())),
        height: document.documentElement.scrollHeight,
      }));
    await page.evaluate(() => document.fonts.ready); // text re-wrapping when the web font lands is not the illustration
    const before = await measure();
    expect(before.boxes.length).toBeGreaterThan(0);
    release();
    await drawn(page);
    expect(await measure()).toEqual(before);
  });
}

test.describe('axe at 390 px', () => {
  test.skip(({ viewport }) => viewport?.width !== 390, 'phone width only');
  for (const scheme of ['light', 'dark'] as const) {
    for (const lang of ['ja', 'en'] as const) {
      test(`US-E17-01/AC3 AC5 US-NF-02/AC1 no serious axe violation with the drawings, ${scheme} ${lang}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('./#/recommend/2026-11-12');
        await expect(page.getByTestId('screen-recs')).toBeVisible();
        if (lang === 'en') {
          await page.getByTestId('lang-toggle-en').click();
          await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        }
        await drawn(page);
        await expectNoSeriousAxe(page, `recs ${scheme} ${lang}`);
        await page.goto('./#/recipes');
        await drawn(page);
        await expectNoSeriousAxe(page, `library ${scheme} ${lang}`);
        await page.goto('./#/recipe/rcp-delish-panda-onigiri');
        await drawn(page);
        await expectNoSeriousAxe(page, `recipe ${scheme} ${lang}`);
      });
    }
  }

  test('US-E17-01/AC5 the drawings use the theme tokens: outline and fill are separate paths and the outline token differs per theme', async ({ page }) => {
    await page.goto('./#/recipe/rcp-delish-panda-onigiri');
    await drawn(page);
    const read = () =>
      page.evaluate(() => {
        const svg = document.querySelector('svg.dish')!;
        return {
          line: getComputedStyle(svg.querySelector('path.o')!).stroke,
          lineFill: getComputedStyle(svg.querySelector('path.o')!).fill,
          fill: getComputedStyle(svg.querySelector('path.rice')!).stroke,
          rice: getComputedStyle(svg.querySelector('path.rice')!).fill,
        };
      });
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await read();
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await read();
    expect(light.line).toBe('rgb(63, 75, 102)');
    expect(dark.line).toBe('rgb(205, 198, 184)');
    expect(light.lineFill).toBe('none');
    expect(light.fill).toBe('none');
    expect(dark.rice).not.toBe('rgb(255, 255, 255)');
    expect(dark.rice).not.toBe('rgb(0, 0, 0)');
  });
});
