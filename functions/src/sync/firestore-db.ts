// The SyncDb port over the Admin SDK Firestore. The SDK object is passed in (functions/src/index.ts), so this file names no
// Google SDK and a fake with the same shape tests it. Any failure rejects, which the pipeline turns into 503 UNAVAILABLE.
import type { Data, QuerySpec, Row, Snap, SyncDb, SyncTx } from './types.ts';

interface RefLike {
  readonly path: string;
}
interface DocSnapLike {
  exists: boolean;
  data(): unknown;
}
interface QuerySnapLike {
  docs: { ref: RefLike; data(): unknown }[];
}
interface QueryLike {
  where(field: string, op: string, value: unknown): QueryLike;
  orderBy(field: string): QueryLike;
  limit(n: number): QueryLike;
  get(): Promise<QuerySnapLike>;
}
interface TxLike {
  get(target: RefLike | QueryLike): Promise<DocSnapLike | QuerySnapLike>;
  set(ref: RefLike, data: Data): unknown;
  delete(ref: RefLike): unknown;
}
export interface FirestoreLike {
  doc(path: string): RefLike;
  collection(path: string): QueryLike;
  runTransaction<T>(fn: (tx: TxLike) => Promise<T>): Promise<T>;
  recursiveDelete(ref: RefLike): Promise<void>;
}

function build(db: FirestoreLike, collection: string, spec: QuerySpec): QueryLike {
  let q = db.collection(collection);
  if (spec.where !== undefined) q = q.where(spec.where.field, spec.where.op, spec.where.value);
  if (spec.orderBy !== undefined) q = q.orderBy(spec.orderBy);
  if (spec.limit !== undefined) q = q.limit(spec.limit);
  return q;
}

const rows = (s: QuerySnapLike): Row[] => s.docs.map((d) => ({ path: d.ref.path, data: (d.data() ?? {}) as Data }));

export function createSyncDb(db: FirestoreLike): SyncDb {
  return {
    runTransaction: (fn) =>
      db.runTransaction((raw) => {
        const tx: SyncTx = {
          get: async (p): Promise<Snap> => {
            const s = (await raw.get(db.doc(p))) as DocSnapLike;
            return { exists: s.exists, data: s.exists ? ((s.data() ?? {}) as Data) : undefined };
          },
          query: async (collection, spec) => rows((await raw.get(build(db, collection, spec))) as QuerySnapLike),
          set: (p, data) => {
            raw.set(db.doc(p), data);
          },
          delete: (p) => {
            raw.delete(db.doc(p));
          },
        };
        return fn(tx);
      }),
    query: async (collection, spec) => rows(await build(db, collection, spec).get()),
    recursiveDelete: (p) => db.recursiveDelete(db.doc(p)),
  };
}
