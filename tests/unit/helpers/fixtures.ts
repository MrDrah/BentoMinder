// Fixture loaders for unit tests. Every value is a deep copy, so tests can mutate freely.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

export function loadFixture<T = unknown>(relativePath: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, relativePath), 'utf8')) as T;
}

export const storeV1 = (): BentoMinderStore => loadFixture<BentoMinderStore>('state/v1.json');

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
