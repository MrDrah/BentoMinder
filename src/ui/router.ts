// Typed hash router (ADR 001): `#/calendar/<YYYY-MM>`, `#/day/<date>`, `#/recipe/<id>`,
// `#/recipes` (library, US-E6-05), `#/settings`, `#/profile` (edit), `#/import`,
// `#/review/<YYYY-MM>[?manual=1]`, `#/onboarding/<1|2|3>[?month=YYYY-MM&manual=1]`.
// Pure parse/format; the hook listens to hashchange. A leave guard lets a screen hold the
// parent on it (US-E3-03/AC5: leaving the review asks first).
import { useEffect, useState } from 'react';
import { isLocalDate, isYearMonth, type LocalDate, type YearMonth } from '../domain/time/jst.ts';

export type OnboardingStep = 1 | 2 | 3;

export type Route =
  | { name: 'calendar'; month: YearMonth | null }
  | { name: 'day'; date: LocalDate }
  | { name: 'recipe'; id: string; date: LocalDate | null }
  | { name: 'recipes' }
  | { name: 'settings' }
  | { name: 'profile' }
  | { name: 'import' }
  | { name: 'review'; month: YearMonth; manual: boolean }
  | { name: 'onboarding'; step: OnboardingStep; month: YearMonth | null; manual: boolean }
  | { name: 'not-found' };

const RECIPE_ID_RE = /^rcp-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path = '', query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const [head, arg, ...rest] = parts;
  if (rest.length > 0) return { name: 'not-found' };
  if (head === undefined) return { name: 'calendar', month: null };
  const manual = params.get('manual') === '1';
  switch (head) {
    case 'calendar':
      if (arg === undefined) return { name: 'calendar', month: null };
      return isYearMonth(arg) ? { name: 'calendar', month: arg } : { name: 'not-found' };
    case 'day':
      return arg !== undefined && isLocalDate(arg) ? { name: 'day', date: arg } : { name: 'not-found' };
    case 'recipe': {
      if (arg === undefined || !RECIPE_ID_RE.test(arg)) return { name: 'not-found' };
      const date = params.get('date');
      return { name: 'recipe', id: arg, date: date !== null && isLocalDate(date) ? date : null };
    }
    case 'recipes':
    case 'settings':
    case 'profile':
    case 'import':
      return arg === undefined ? { name: head } : { name: 'not-found' };
    case 'review':
      return arg !== undefined && isYearMonth(arg) ? { name: 'review', month: arg, manual } : { name: 'not-found' };
    case 'onboarding': {
      const step = Number(arg ?? '1');
      const month = params.get('month');
      if (step !== 1 && step !== 2 && step !== 3) return { name: 'not-found' };
      return { name: 'onboarding', step, month: month !== null && isYearMonth(month) ? month : null, manual };
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
    case 'settings':
    case 'profile':
    case 'import':
      return `#/${route.name}`;
    case 'review':
      return `#/review/${route.month}${route.manual ? '?manual=1' : ''}`;
    case 'onboarding': {
      const q = new URLSearchParams();
      if (route.month !== null) q.set('month', route.month);
      if (route.manual) q.set('manual', '1');
      const s = q.toString();
      return `#/onboarding/${route.step}${s === '' ? '' : `?${s}`}`;
    }
    case 'not-found':
      return '#/not-found';
  }
}

/** Returns false to keep the current screen (the guard then asks the parent itself). */
export type LeaveGuard = (target: Route) => boolean;
let guard: LeaveGuard | null = null;
let currentHash = typeof window === 'undefined' ? '' : window.location.hash;

export function setLeaveGuard(next: LeaveGuard | null): void {
  guard = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    currentHash = window.location.hash;
    const onChange = () => {
      const target = parseHash(window.location.hash);
      if (guard !== null && window.location.hash !== currentHash && !guard(target)) {
        // Put the address back without another hashchange; the screen shows its dialog.
        window.history.replaceState(null, '', currentHash === '' ? window.location.pathname : currentHash);
        return;
      }
      currentHash = window.location.hash;
      setRoute(target);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: Route, options: { force?: boolean } = {}): void {
  if (options.force === true) guard = null;
  window.location.hash = toHash(route);
}
