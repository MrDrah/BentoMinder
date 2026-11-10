// Button audit + screenshots. Usage: node btn-audit.mjs <outDir> [--shots-only]; expects the e2e preview on :4173.
// Walks the screens that hold buttons (login, import, settings incl. destructive dialogs, family card with a faked sync wire,
// day sheet, recommend, review, profile, onboarding, banners), screenshots each in light and dark at 390 and 1280, and for
// every visible .btn compares computed fill / text / border with the spec (components 1.3) built from the tokens.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const shotsOnly = process.argv.includes('--shots-only');
const base = process.env.BASE ?? 'http://localhost:4173';
const state = JSON.stringify(JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/state/m2-november.json'), 'utf8')));
const NOW = new Date('2026-11-02T10:00:00+09:00');
const sizes = { sp: { width: 390, height: 844 }, pc: { width: 1280, height: 800 } };
const browser = await chromium.launch();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const member = { ok: true, status: 'member', familyId: 'f1', consentVersion: 1, consentedAt: new Date().toISOString(), maxMembers: 2,
  members: [{ uid: 'test-uid-001', you: true, joinedAt: new Date().toISOString(), consentVersion: 1, email: 'parent@example.test' }], invite: { code: 'ABCDEFGHJK', expiresAt: '2026-12-31T00:00:00Z' } };

async function open(size, scheme, { signedOut = false, sync = false, state: st = state } = {}) {
  const c = await browser.newContext({ viewport: sizes[size], hasTouch: size === 'sp', isMobile: size === 'sp', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: scheme });
  await c.addInitScript(([v, so, sy]) => {
    if (so) localStorage.setItem('bentominder.fake-auth', 'signed-out');
    else if (localStorage.getItem('bentominder.state') === null && v) localStorage.setItem('bentominder.state', v);
    if (sy) localStorage.setItem('bentominder.fake-sync-base', 'https://sync.e2e.test');
  }, [st, signedOut, sync]);
  if (sync) {
    await c.route('https://sync.e2e.test/**', async (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const op = new URL(r.request().url()).pathname.replace(/^\/v1\//, '');
      const body = op.startsWith('membership') || op.startsWith('invite') || op.startsWith('family') ? member : { ok: true };
      return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
    });
  }
  const p = await c.newPage();
  await p.clock.setFixedTime(NOW);
  return p;
}

// Spec per variant, resolved from the live tokens (so light and dark are both checked).
async function audit(p, label, problems) {
  const rows = await p.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rgb = (v) => { const e = document.createElement('i'); e.style.color = root.getPropertyValue(v).trim(); document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const t = (n) => rgb('--' + n);
    const spec = {
      primary: { bg: t('accent-strong'), fg: t('ink-inverse'), border: 'rgba(0, 0, 0, 0)' },
      secondary: { bg: t('surface-2'), fg: t('ink-1'), border: t('ink-1') },
      destructive: { bg: t('danger-strong'), fg: t('ink-inverse'), border: 'rgba(0, 0, 0, 0)' },
      text: { bg: 'rgba(0, 0, 0, 0)', fg: t('ink-1'), border: 'rgba(0, 0, 0, 0)' },
      'destructive-text': { bg: 'rgba(0, 0, 0, 0)', fg: t('danger'), border: 'rgba(0, 0, 0, 0)' },
    };
    const dis = { bg: t('surface-3'), fg: t('ink-3') };
    const res = [];
    for (const el of document.querySelectorAll('.btn')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      const v = ['destructive-text', 'destructive', 'primary', 'secondary', 'text'].find((x) => el.classList.contains('btn--' + x)) ?? 'none';
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
      const busy = el.getAttribute('aria-busy') === 'true';
      const s = spec[v];
      const bad = [];
      if (!s) bad.push('no variant class');
      else if (disabled && !busy) {
        if (v !== 'text' && v !== 'destructive-text' && (cs.backgroundColor !== dis.bg || cs.color !== dis.fg)) bad.push(`disabled bg/fg ${cs.backgroundColor}/${cs.color}`);
        if ((v === 'text' || v === 'destructive-text') && cs.color !== dis.fg) bad.push(`disabled text fg ${cs.color}`);
      } else {
        if (cs.backgroundColor !== s.bg) bad.push(`bg ${cs.backgroundColor} want ${s.bg}`);
        if (cs.color !== s.fg) bad.push(`fg ${cs.color} want ${s.fg}`);
        if (cs.borderTopColor !== s.border && s.border !== 'rgba(0, 0, 0, 0)') bad.push(`border ${cs.borderTopColor} want ${s.border}`);
        if (s.border === 'rgba(0, 0, 0, 0)' && cs.borderTopColor !== s.border && !/transparent|rgba\(0, 0, 0, 0\)/.test(cs.borderTopColor)) bad.push(`border ${cs.borderTopColor} want none`);
      }
      const minH = v === 'text' || v === 'destructive-text' ? 44 : 44;
      if (r.height < minH - 0.5) bad.push(`height ${r.height}`);
      res.push({ id: el.getAttribute('data-testid') ?? el.textContent.trim().slice(0, 16), v, disabled, h: Math.round(r.height), font: cs.fontFamily.slice(0, 18), bad });
    }
    return res;
  });
  for (const r of rows) if (r.bad.length) problems.push(`${label} [${r.v}] ${r.id}: ${r.bad.join('; ')}`);
  return rows;
}

const summary = [];
const problems = [];
async function snap(p, name, label) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  if (!shotsOnly) summary.push(`${label}: ${(await audit(p, label, problems)).map((r) => `${r.v}${r.disabled ? '(dis)' : ''}:${r.h}`).join(' ')}`);
}

for (const scheme of ['light', 'dark']) {
  for (const size of ['sp', 'pc']) {
    const tag = `${size}-${scheme}`;
    let p = await open(size, scheme, { signedOut: true });
    await p.goto(base + '/#/calendar'); await snap(p, `login-${tag}`, `login ${tag}`); await p.context().close();

    p = await open(size, scheme, { state: '' });
    await p.goto(base + '/#/calendar'); await snap(p, `onboarding-${tag}`, `onboarding ${tag}`); await p.context().close();

    p = await open(size, scheme);
    for (const [n, h] of [['import', '#/import'], ['home', '#/calendar'], ['day', '#/day/2026-11-04'], ['recommend', '#/recommend/2026-11-04'], ['review', '#/review/2026-11'], ['profile', '#/profile'], ['recipes', '#/recipes']]) {
      await p.goto(base + '/' + h); await snap(p, `${n}-${tag}`, `${n} ${tag}`);
    }
    await p.goto(base + '/#/settings'); await snap(p, `settings-${tag}`, `settings ${tag}`);
    for (const id of ['settings-profile-delete', 'data-delete-all']) {
      const b = p.getByTestId(id);
      if (await b.count()) { await b.first().click(); await snap(p, `dialog-${id}-${tag}`, `dialog ${id} ${tag}`); await p.keyboard.press('Escape'); }
    }
    await p.context().close();

    // reminder banners: weekly summary (Sunday 14:00 JST, the plan link) and the day-before reminder (17:30, CTA)
    for (const [n, iso, ff] of [['weekly', '2026-11-08T04:59:00Z', '02:00'], ['daybefore', '2026-11-03T08:29:00Z', '02:00']]) {
      const c = await browser.newContext({ viewport: sizes[size], hasTouch: size === 'sp', isMobile: size === 'sp', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: scheme });
      await c.addInitScript((v) => { if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v); }, state);
      const q = await c.newPage();
      await q.clock.install({ time: new Date(iso) });
      await q.goto(base + '/');
      await q.waitForTimeout(600);
      await q.clock.fastForward(ff);
      await q.waitForTimeout(600);
      await snap(q, `banner-${n}-${tag}`, `banner ${n} ${tag}`);
      await c.close();
    }

    p = await open(size, scheme, { sync: true });
    await p.goto(base + '/#/settings'); await p.waitForTimeout(800); await snap(p, `family-${tag}`, `family ${tag}`); await p.context().close();
  }
}

// States on one instance of each variant (light + dark, desktop): hover, active, focus, disabled.
if (!shotsOnly) {
  for (const scheme of ['light', 'dark']) {
    const p = await open('pc', scheme);
    await p.goto(base + '/#/settings'); await p.waitForTimeout(600);
    const probe = async (sel, label) => {
      const el = p.locator(sel).first();
      if (!(await el.count())) { summary.push(`state probe ${label}: not found`); return; }
      const g = () => el.evaluate((e) => { const c = getComputedStyle(e); return `${c.backgroundColor}|${c.color}|${c.textDecorationLine}${c.textDecorationThickness}`; });
      const rest = await g();
      const cdp = await p.context().newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const marker = 'data-probe-' + label;
      await el.evaluate((e, m) => e.setAttribute(m, '1'), marker);
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[' + marker + ']' });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] }); const hover = await g();
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover', 'active'] }); const active = await g();
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await el.focus(); const focus = await el.evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineColor);
      summary.push(`${scheme} ${label}\n  rest ${rest}\n  hover ${hover}\n  active ${active}\n  focus ${focus}`);
    };
    await probe('.btn--secondary', 'secondary'); await probe('.btn--destructive-text', 'destructive-text'); await probe('.btn--text', 'text'); await p.goto(base + '/#/import'); await p.waitForTimeout(500); await probe('.btn--primary', 'primary');
    await p.context().close();
  }
}
console.log(summary.join('\n'));
console.log(problems.length ? `PROBLEMS (${problems.length}):\n` + [...new Set(problems)].join('\n') : 'no rest-state deviations');
await browser.close();
