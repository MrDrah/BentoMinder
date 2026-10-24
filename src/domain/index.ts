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
export type * from './ports.ts';
export { STORAGE_KEYS } from './ports.ts';
