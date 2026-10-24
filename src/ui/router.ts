// Typed hash router (ADR 001): `#/calendar/<YYYY-MM>`, `#/day/<date>`, `#/recipe/<id>`,
// `#/recipes` (library, US-E6-05), `#/settings`, `#/onboarding/<step>`. Pure parse/format; the hook listens to hashchange.
import { useEffect, useState } from 'react';
import { isLocalDate, isYearMonth, type LocalDate, type YearMonth } from '../domain/time/jst.ts';

export type OnboardingStep = 1 | 2 | 3;

export type Route =
  | { name: 'calendar'; month: YearMonth | null }
  | { name: 'day'; date: LocalDate }
  | { name: 'recipe'; id: string; date: LocalDate | null }
  | { name: 'recipes' }
  | { name: 'settings' }
  | { name: 'onboarding'; step: OnboardingStep }
  | { name: 'not-found' };

const RECIPE_ID_RE = /^rcp-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path = '', query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const [head, arg, ...rest] = parts;
  if (rest.length > 0) return { name: 'not-found' };
  if (head === undefined) return { name: 'calendar', month: null };
  switch (head) {
    case 'calendar':
      if (arg === undefined) return { name: 'calendar', month: null };
      return isYearMonth(arg) ? { name: 'calendar', month: arg } : { name: 'not-found' };
    case 'day':
      return arg !== undefined && isLocalDate(arg) ? { name: 'day', date: arg } : { name: 'not-found' };
    case 'recipe': {
      if (arg === undefined || !RECIPE_ID_RE.test(arg)) return { name: 'not-found' };
      const date = new URLSearchParams(query).get('date');
      return { name: 'recipe', id: arg, date: date !== null && isLocalDate(date) ? date : null };
    }
    case 'recipes':
      return arg === undefined ? { name: 'recipes' } : { name: 'not-found' };
    case 'settings':
      return arg === undefined ? { name: 'settings' } : { name: 'not-found' };
    case 'onboarding': {
      const step = Number(arg ?? '1');
      return step === 1 || step === 2 || step === 3 ? { name: 'onboarding', step } : { name: 'not-found' };
    }
    default:
      return { name: 'not-found' };
  }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'calendar':
      return route.month === null ? '#/calendar' : `#/calendar/${route.month}`;
    case 'day':
      return `#/day/${route.date}`;
    case 'recipe':
      return route.date === null ? `#/recipe/${route.id}` : `#/recipe/${route.id}?date=${route.date}`;
    case 'recipes':
      return '#/recipes';
    case 'settings':
      return '#/settings';
    case 'onboarding':
      return `#/onboarding/${route.step}`;
    case 'not-found':
      return '#/not-found';
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: Route): void {
  window.location.hash = toHash(route);
}
