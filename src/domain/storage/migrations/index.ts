// Forward-only migrations (ADR 003): `migrations[n]` turns a version-n document into version
// n+1. Pure: no clock, no network. Each one ships with a frozen tests/fixtures/state/v<n>.json.
// Schema v1 is the first released shape, so the map is empty.

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
export type MigrationMap = Readonly<Record<number, Migration>>;

export const migrations: MigrationMap = {};

export class MigrationError extends Error {
  readonly fromVersion: number;
  constructor(fromVersion: number, cause?: unknown) {
    super(`no migration from schema version ${fromVersion}`, cause === undefined ? undefined : { cause });
    this.name = 'MigrationError';
    this.fromVersion = fromVersion;
  }
}

/** Runs every migration from `from` up to `to`, in order. Throws MigrationError on a gap or a throw. */
export function migrate(
  doc: Record<string, unknown>,
  from: number,
  to: number,
  map: MigrationMap = migrations,
): Record<string, unknown> {
  let current = doc;
  for (let v = from; v < to; v += 1) {
    const step = map[v];
    if (step === undefined) throw new MigrationError(v);
    try {
      current = { ...step(current), schemaVersion: v + 1 };
    } catch (err) {
      throw new MigrationError(v, err);
    }
  }
  return current;
}
