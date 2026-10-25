// Public surface of the pure domain (ADR 004). Engines arrive in M2–M4; M0 ships time,
// schemas, rules, storage and the ports. Data (dictionary, library) is passed into factories
// by the caller, so tests use fixtures.
export * from './time/jst.ts';
export * from './schema/index.ts';
export * from './rules.ts';
export * from './text/normalize.ts';
export * from './storage/repository.ts';
export * from './storage/defaults.ts';
export * from './storage/migrations/index.ts';
export * from './menu/normalize.ts';
export * from './menu/extraction.ts';
export * from './menu/review.ts';
export * from './menu/store-ops.ts';
export * from './profile/profile.ts';
export type * from './ports.ts';
export { STORAGE_KEYS } from './ports.ts';
export * from './menu/day-kind.ts';
export * from './menu/refresh.ts';
export * from './assessment/dictionary-index.ts';
export * from './assessment/matcher.ts';
export * from './assessment/ambiguity.ts';
export * from './assessment/assess.ts';
export * from './assessment/override.ts';
export * from './decision/decision.ts';
export * from './decision/apply.ts';
export * from './calendar/day-view.ts';
