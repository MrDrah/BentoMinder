// Hash router (ADR 001): typed parse and format, round trip.
import { describe, expect, it } from 'vitest';
import { parseHash, toHash, type Route } from '../../../src/ui/router.ts';

describe('hash router', () => {
  it('parses every route and formats it back', () => {
    const routes: Route[] = [
      { name: 'calendar', month: null },
      { name: 'calendar', month: '2026-11' as never },
      { name: 'day', date: '2026-11-05' as never },
      { name: 'recipe', id: 'rcp-kuma-onigiri', date: null },
      { name: 'recipe', id: 'rcp-kuma-onigiri', date: '2026-11-05' as never },
      { name: 'recipes' },
      { name: 'settings' },
      { name: 'onboarding', step: 2 },
    ];
    for (const r of routes) expect(parseHash(toHash(r))).toEqual(r);
  });

  it('treats an empty hash as the calendar and anything malformed as not found', () => {
    expect(parseHash('')).toEqual({ name: 'calendar', month: null });
    expect(parseHash('#/')).toEqual({ name: 'calendar', month: null });
    for (const bad of ['#/calendar/2026-13', '#/day/2027-02-29', '#/recipe/Kuma', '#/settings/x', '#/onboarding/4', '#/debug', '#/day/2026-11-05/extra', '#/recipe']) {
      expect(parseHash(bad)).toEqual({ name: 'not-found' });
    }
    expect(parseHash('#/recipe/rcp-a?date=nope')).toEqual({ name: 'recipe', id: 'rcp-a', date: null });
    expect(parseHash('#/onboarding')).toEqual({ name: 'onboarding', step: 1 });
    expect(toHash({ name: 'not-found' })).toBe('#/not-found');
  });
});
