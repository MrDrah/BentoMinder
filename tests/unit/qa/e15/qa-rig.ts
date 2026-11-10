// QA E15 support. Re-uses only the INFRASTRUCTURE of the developer's function tests (fake Firestore, request pipeline rig, token table);
// every expectation in the qa/e15 tests is derived from the stories and the data contract, not from the developers' assertions.
import type { SyncDb, SyncTx } from '../../../../functions/src/sync/types.ts';
import type { SyncDeps } from '../../../../functions/src/sync/service.ts';
import { makeRig, type Rig } from '../../functions/sync/harness.ts';

export * from '../../functions/sync/harness.ts';

/** The twelve wire operations (slice-b-wire), listed by name here on purpose. */
export const ALL_OPS = ['membership.get', 'membership.ack', 'family.create', 'invite.create', 'invite.cancel', 'invite.redeem', 'consent.set', 'family.leave', 'family.removeMember', 'family.delete', 'records.push', 'records.pull'] as const;
export const MEMBER_ONLY_OPS = ['invite.create', 'invite.cancel', 'consent.set', 'family.leave', 'family.removeMember', 'family.delete', 'records.push', 'records.pull'] as const;

export interface Counters {
  tx: number;
  gets: number;
  queryDocsCalls: number;
  queryRows: number;
  sets: number;
  deletes: number;
  recursive: number;
}
export const zero = (): Counters => ({ tx: 0, gets: 0, queryDocsCalls: 0, queryRows: 0, sets: 0, deletes: 0, recursive: 0 });

/** Wraps the rig's database with operation counters (Firestore bills: 1 read per get, 1 per returned row of a query (min 1), 1 per write/delete). */
export function counting(rig: Rig): { c: Counters; deps: () => SyncDeps; reset(): void } {
  const c = zero();
  const inner = rig.db;
  const db: SyncDb = {
    runTransaction: (fn) =>
      inner.runTransaction((tx) => {
        c.tx += 1;
        const wrapped: SyncTx = {
          get: (p) => {
            c.gets += 1;
            return tx.get(p);
          },
          query: async (coll, spec) => {
            c.queryDocsCalls += 1;
            const rows = await tx.query(coll, spec);
            c.queryRows += Math.max(1, rows.length);
            return rows;
          },
          set: (p, d) => {
            c.sets += 1;
            tx.set(p, d);
          },
          delete: (p) => {
            c.deletes += 1;
            tx.delete(p);
          },
        };
        return fn(wrapped);
      }),
    query: async (coll, spec) => {
      c.queryDocsCalls += 1;
      const rows = await inner.query(coll, spec);
      c.queryRows += Math.max(1, rows.length);
      return rows;
    },
    recursiveDelete: async (p) => {
      c.recursive += 1;
      return inner.recursiveDelete(p);
    },
  };
  return {
    c,
    deps: () => ({ ...rig.deps(), db }),
    reset() {
      Object.assign(c, zero());
    },
  };
}

export const snapshot = (rig: Rig, ...prefixes: string[]): string =>
  JSON.stringify([...rig.db.docs.entries()].filter(([p]) => prefixes.length === 0 || prefixes.some((x) => p === x || p.startsWith(`${x}/`))).sort());

export { makeRig };
