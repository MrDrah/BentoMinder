// Hash router (ADR 001): typed parse and format, round trip, leave guard.
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { navigate, parseHash, setLeaveGuard, toHash, useRoute, type Route } from '../../../src/ui/router.ts';

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
      { name: 'profile' },
      { name: 'import' },
      { name: 'review', month: '2026-11' as never, manual: false },
      { name: 'review', month: '2026-11' as never, manual: true },
      { name: 'onboarding', step: 2, month: null, manual: false },
      { name: 'onboarding', step: 3, month: '2026-12' as never, manual: true },
    ];
    for (const r of routes) expect(parseHash(toHash(r))).toEqual(r);
  });

  it('treats an empty hash as the calendar and anything malformed as not found', () => {
    expect(parseHash('')).toEqual({ name: 'calendar', month: null });
    expect(parseHash('#/')).toEqual({ name: 'calendar', month: null });
    for (const bad of ['#/calendar/2026-13', '#/day/2027-02-29', '#/recipe/Kuma', '#/settings/x', '#/onboarding/4', '#/debug', '#/day/2026-11-05/extra', '#/recipe', '#/review', '#/review/2026-13', '#/import/x']) {
      expect(parseHash(bad)).toEqual({ name: 'not-found' });
    }
    expect(parseHash('#/recipe/rcp-a?date=nope')).toEqual({ name: 'recipe', id: 'rcp-a', date: null });
    expect(parseHash('#/onboarding')).toEqual({ name: 'onboarding', step: 1, month: null, manual: false });
    expect(parseHash('#/onboarding/3?month=bad')).toEqual({ name: 'onboarding', step: 3, month: null, manual: false });
    expect(toHash({ name: 'not-found' })).toBe('#/not-found');
  });

  it('US-E3-03/AC5 a leave guard keeps the current screen until the parent decides', async () => {
    function Show() {
      const r = useRoute();
      return <p data-testid="route">{r.name}</p>;
    }
    window.location.hash = '#/settings';
    render(<Show />);
    expect(screen.getByTestId('route')).toHaveTextContent('settings');
    const asked: Route[] = [];
    setLeaveGuard((target) => {
      asked.push(target);
      return false;
    });
    await act(async () => {
      window.location.hash = '#/recipes';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(asked).toEqual([{ name: 'recipes' }]);
    expect(screen.getByTestId('route')).toHaveTextContent('settings');
    expect(window.location.hash).toBe('#/settings');
    await act(async () => {
      navigate({ name: 'recipes' }, { force: true });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route')).toHaveTextContent('recipes');
    setLeaveGuard(null);
  });
});
