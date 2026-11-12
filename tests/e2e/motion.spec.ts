// US-E16-01 Motion (design/motion.md): press feedback, sheet and dialog entrances, month fade, instant close,
// reduced motion and cheap properties only. Today is fixed at 2026-11-02 (tests/fixtures/state/m2-november.json).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const NOW = new Date('2026-11-02T01:00:00Z');
const CHEAP = new Set(['opacity', 'transform', 'offset', 'easing', 'composite', 'computedOffset', 'backgroundColor', 'color', 'borderColor']);

interface Anim {
  kind: string;
  name: string;
  duration: number;
  props: string[];
  target: string;
}
/** Every running animation or transition on the page, described with plain data. */
const animations = (page: Page): Promise<Anim[]> =>
  page.evaluate(() =>
    document.getAnimations().map((a) => {
      const e = a.effect as KeyframeEffect;
      const target = e.target as HTMLElement | null;
      return {
        kind: a instanceof CSSTransition ? 'transition' : 'animation',
        name: a instanceof CSSAnimation ? a.animationName : (a as CSSTransition).transitionProperty,
        duration: Number(e.getComputedTiming().duration),
        props: [...new Set(e.getKeyframes().flatMap((k) => Object.keys(k)))],
        target: `${target?.tagName.toLowerCase()}.${target?.className}`,
      };
    }),
  );
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => !((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('.dish .a')).map((a) => a.finished.catch(() => undefined))));
const cell = (page: Page, date: string) => page.getByTestId(`cal-cell-${date}`);
const mobile = (name: string) => name === 'mobile';
const riseToken = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rise-offset')));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await seedStore(page, STATE);
});

test.describe('buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('./');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:100px;left:10px;z-index:9999;display:flex;flex-wrap:wrap;gap:8px';
      probe.innerHTML = [
        '<button class="btn btn--primary" id="b-primary">a</button>',
        '<button class="btn btn--secondary" id="b-secondary">b</button>',
        '<button class="btn btn--destructive" id="b-destructive">c</button>',
        '<button class="btn btn--primary" id="b-disabled" disabled>d</button>',
        '<button class="btn btn--secondary" id="b-busy" aria-busy="true">e</button>',
        '<button class="btn btn--text" id="b-text">f</button>',
      ].join('');
      document.body.append(probe);
    });
  });
  const transform = (page: Page, id: string) => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).transform);
  const centre = async (page: Page, id: string) => {
    const box = (await page.locator(`#${id}`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };

  test('US-E16-01/AC1 primary, secondary and destructive buttons scale to 0.97 with the pressed fill and return on release', async ({ page }) => {
    for (const id of ['b-primary', 'b-secondary', 'b-destructive']) {
      const b = page.locator(`#${id}`);
      const before = await b.evaluate((el) => getComputedStyle(el).backgroundColor);
      await centre(page, id);
      await page.mouse.down();
      expect(await transform(page, id), id).toBe('matrix(0.97, 0, 0, 0.97, 0, 0)');
      await page.mouse.up();
      await page.mouse.move(2, 2);
      await expect.poll(() => transform(page, id), { message: id }).toBe('none');
      await expect.poll(() => b.evaluate((el) => getComputedStyle(el).backgroundColor), { message: id }).toBe(before);
    }
  });
  test('US-E16-01/AC1 disabled and busy buttons do not scale, and the text variant does not scale either', async ({ page }) => {
    for (const id of ['b-disabled', 'b-busy', 'b-text']) {
      await centre(page, id);
      await page.mouse.down();
      expect(await transform(page, id), id).toBe('none');
      await page.mouse.up();
    }
  });
  test('US-E16-01/AC7 a released press transitions only transform and colours, within 250 ms', async ({ page }) => {
    await centre(page, 'b-primary');
    await page.mouse.down();
    await page.mouse.up();
    const list = (await animations(page)).filter((a) => a.kind === 'transition');
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) {
      expect(['transform', 'background-color', 'color', 'border-color'], a.name).toContain(a.name);
      expect(a.duration).toBeLessThanOrEqual(250);
    }
  });
});

test.describe('sheets and dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('./');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
  });

  test('US-E16-01/AC2 on a phone the day sheet slides up from below within 250 ms, the scrim fades, focus is on the title at once', async ({ page }, info) => {
    test.skip(!mobile(info.project.name), 'phone widths only');
    await cell(page, '2026-11-04').getByRole('button').click();
    const state = await page.evaluate(() => ({
      anims: document.getAnimations().map((a) => {
        const e = a.effect as KeyframeEffect;
        return { name: (a as CSSAnimation).animationName, duration: Number(e.getComputedTiming().duration), cls: (e.target as HTMLElement).className, frames: e.getKeyframes().map((k) => String(k['transform'] ?? '')) };
      }),
      focus: document.activeElement?.getAttribute('data-testid'),
    }));
    expect(state.focus).toBe('day-sheet-title');
    const up = state.anims.find((a) => a.name === 'sheet-up');
    expect(up?.cls).toBe('sheet');
    expect(up!.duration).toBeLessThanOrEqual(250);
    expect(up!.frames[0]).toBe('translateY(100%)');
    const fade = state.anims.find((a) => a.name === 'fade-in' && a.cls === 'sheet-scrim');
    expect(fade).toBeDefined();
    expect(fade!.duration).toBeLessThanOrEqual(250);
    // usable during the slide: the close control takes a click at once
    await page.getByTestId('day-sheet-close').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('day-sheet')).toHaveCount(0);
  });

  test('US-E16-01/AC3 at 1000 px the day sheet fades in with a 12 px rise and stays centred throughout', async ({ page }, info) => {
    test.skip(mobile(info.project.name), 'tablet width on the desktop project');
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __centres: number[] };
      w.__centres = [];
      const tick = () => {
        const el = document.querySelector('[data-testid="day-sheet"]');
        if (el) {
          const r = el.getBoundingClientRect();
          w.__centres.push(r.left + r.width / 2);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await cell(page, '2026-11-04').getByRole('button').click();
    const found = await page.evaluate(() => {
      const a = document.getAnimations().find((x) => (x as CSSAnimation).animationName === 'sheet-in-centred');
      if (a === undefined) return null;
      const e = a.effect as KeyframeEffect;
      return { duration: Number(e.getComputedTiming().duration), frames: e.getKeyframes().map((k) => ({ o: String(k['opacity']), t: String(k['transform']) })) };
    });
    expect(found).not.toBeNull();
    expect(found!.duration).toBeLessThanOrEqual(250);
    expect(found!.frames[0]!.t).toContain('translate(-50%');
    expect(found!.frames[0]!.o).toBe('0');
    expect(found!.frames.at(-1)!.t).toBe('translate(-50%, -50%)');
    expect(await riseToken(page)).toBeLessThanOrEqual(12);
    await settle(page);
    const centres = await page.evaluate(() => (window as unknown as { __centres: number[] }).__centres);
    expect(centres.length).toBeGreaterThan(0);
    for (const c of centres) expect(Math.abs(c - 500)).toBeLessThanOrEqual(1);
  });

  test('US-E16-01/AC3 the share dialog fades in with a rise of at most 12 px within 250 ms', async ({ page }) => {
    await page.getByTestId('share-button').click();
    const a = (await animations(page)).find((x) => x.name === 'dialog-in');
    expect(a, 'dialog-in animation').toBeDefined();
    expect(a!.duration).toBeLessThanOrEqual(250);
    expect(await riseToken(page)).toBeLessThanOrEqual(12);
    await expect(page.getByTestId('share-close')).toBeFocused();
  });

  test('US-E16-01/AC4 every overlay is removed at once on close and focus returns to its opener', async ({ page }, info) => {
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-close').click();
    await expect(page.getByTestId('share-sheet')).toHaveCount(0, { timeout: 100 });
    await expect(page.getByTestId('share-button')).toBeFocused();

    await page.getByTestId('about-toggle').click();
    await expect(page.getByTestId('about-panel')).toBeVisible();
    await page.getByTestId('about-toggle').click();
    await expect(page.getByTestId('about-panel')).toBeHidden({ timeout: 100 });

    if (mobile(info.project.name)) {
      const opener = cell(page, '2026-11-04').getByRole('button');
      await opener.click();
      await page.getByTestId('day-sheet-close').click();
      await expect(page.getByTestId('day-sheet')).toHaveCount(0, { timeout: 100 });
      await expect(opener).toBeFocused();
    }
  });

  test('US-E16-01/AC7 the about panel reveals with about-in on a phone and a cheap rise from 768 px, in at most 250 ms', async ({ page }, info) => {
    await page.getByTestId('about-toggle').click();
    const list = (await animations(page)).filter((a) => a.target.includes('about'));
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) {
      expect(a.duration).toBeLessThanOrEqual(250);
      if (mobile(info.project.name)) expect(a.name).toBe('about-in');
      else {
        expect(a.name).toBe('dialog-in');
        for (const p of a.props) expect(CHEAP.has(p), `${a.name} animates ${p}`).toBe(true);
      }
    }
  });

  test('US-E16-01/AC7 no overlay animation lasts more than 250 ms or animates anything but opacity and transform', async ({ page }) => {
    const seen: Anim[] = [];
    await page.getByTestId('share-button').click();
    seen.push(...(await animations(page)));
    await page.getByTestId('share-close').click();
    await cell(page, '2026-11-04').getByRole('button').click();
    seen.push(...(await animations(page)));
    expect(seen.length).toBeGreaterThan(0);
    for (const a of seen) {
      expect(a.duration, `${a.name} ${a.target}`).toBeLessThanOrEqual(250);
      for (const p of a.props) expect(CHEAP.has(p), `${a.name} animates ${p}`).toBe(true);
    }
  });
});

test.describe('month change', () => {
  test('US-E16-01/AC5 the grid fades in over 120 ms with no movement and the announcement is unchanged', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('./');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    await settle(page);
    expect((await animations(page)).filter((a) => a.target.includes('cal-grid'))).toEqual([]);
    // A 120 ms animation can end before a poll reads it under load, so record the start event in the page.
    type W = { __fades: string[] };
    await page.evaluate(() => {
      (window as unknown as W).__fades = [];
      document.addEventListener(
        'animationstart',
        (e) => {
          const t = e.target as Element;
          if (t.getAttribute('data-testid') === 'cal-grid') (window as unknown as W).__fades.push(`${e.animationName}|${getComputedStyle(t).animationDuration}`);
        },
        true,
      );
    });
    await page.getByTestId('cal-next').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__fades.length)).toBeGreaterThan(0);
    const [name, dur] = (await page.evaluate(() => (window as unknown as W).__fades[0]!)).split('|');
    expect(name).toBe('fade-in');
    expect(parseFloat(dur!) * (dur!.endsWith('ms') ? 1 : 1000)).toBeLessThanOrEqual(120);
    const title = (await page.getByTestId('cal-title').textContent())!.trim();
    await expect(page.getByTestId('cal-live')).toContainText(title);
    await expect(page.getByTestId('cal-today')).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
  });

  test('US-E16-01/AC6 opening a sheet, a dialog or the about panel creates no animation and nothing moves', async ({ page }, info) => {
    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-sheet')).toBeVisible();
    expect(await animations(page)).toEqual([]);
    const box = (await page.getByTestId('share-sheet').boundingBox())!;
    await page.waitForTimeout(50);
    expect(await page.getByTestId('share-sheet').boundingBox()).toEqual(box);
    await page.getByTestId('share-close').click();

    await page.getByTestId('about-toggle').click();
    await expect(page.getByTestId('about-panel')).toBeVisible();
    expect(await animations(page)).toEqual([]);
    await page.getByTestId('about-toggle').click();

    await cell(page, '2026-11-04').getByRole('button').click();
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    expect(await animations(page)).toEqual([]);
    const styles = await page.evaluate(() =>
      ['.sheet', '.sheet-scrim'].map((s) => {
        const el = document.querySelector(s);
        return el === null ? null : { name: getComputedStyle(el).animationName, td: getComputedStyle(el).transitionDuration };
      }),
    );
    for (const s of styles) if (s !== null) expect(s).toEqual({ name: 'none', td: '0s' });
    if (mobile(info.project.name)) await page.getByTestId('day-sheet-close').click();
  });

  test('US-E16-01/AC6 pressing a button does not scale it and creates no transition', async ({ page }) => {
    await page.getByTestId('cal-next').click();
    const b = page.getByTestId('cal-today');
    await expect(b).toBeVisible();
    const box = (await b.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await b.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    expect(await b.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    await page.mouse.up();
    expect(await animations(page)).toEqual([]);
  });

  test('US-E16-01/AC6 a month change creates no animation', async ({ page }) => {
    await page.getByTestId('cal-next').click();
    await expect(page.getByTestId('cal-today')).toBeVisible();
    expect(await animations(page)).toEqual([]);
  });
});
