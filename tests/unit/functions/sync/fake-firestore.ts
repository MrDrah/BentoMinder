// An in-memory Firestore for the sync function's tests. It implements SyncDb and enforces the constraints that bite in the
// real service (ADR 016 section 7), so a handler that would fail on Firestore fails here:
//  - a transaction must do all its reads before its first write;
//  - at most 500 writes per transaction (and per recursive-delete chunk);
//  - a document is at most 1 MiB; a value must not be undefined;
//  - optimistic concurrency: if a document or collection a transaction read changed before it commits, the callback runs again.
// Fidelity is a stated risk (it is not Firestore); the manual smoke test and the optional emulator run are the other checks.
import type { Data, QuerySpec, Row, Snap, SyncDb, SyncTx } from '../../../../functions/src/sync/types.ts';

export const MAX_TX_WRITES = 500;
export const MAX_DOC_BYTES = 1_048_576;

const parentOf = (p: string): string => p.slice(0, p.lastIndexOf('/'));

function assertValue(v: unknown, at: string): void {
  if (v === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (found in ${at})`);
  if (Array.isArray(v)) v.forEach((x, i) => assertValue(x, `${at}[${i}]`));
  else if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) assertValue(x, `${at}.${k}`);
}

export class FakeFirestore implements SyncDb {
  readonly docs = new Map<string, Data>();
  private readonly docVersion = new Map<string, number>();
  private readonly collVersion = new Map<string, number>();
  /** Runs once per commit attempt, just before validation: lets a test play "another instance committed first". */
  beforeCommit: (() => void | Promise<void>) | null = null;
  failReads = false;
  retries = 0;
  commits = 0;
  maxTxWrites = 0;
  deletedByRecursive = 0;

  private bump(path: string): void {
    this.docVersion.set(path, (this.docVersion.get(path) ?? 0) + 1);
    const c = parentOf(path);
    this.collVersion.set(c, (this.collVersion.get(c) ?? 0) + 1);
  }

  /** Test setup: writes a document directly. */
  seed(path: string, data: Data): void {
    assertValue(data, path);
    this.docs.set(path, structuredClone(data));
    this.bump(path);
  }

  get(path: string): Data | undefined {
    const d = this.docs.get(path);
    return d === undefined ? undefined : structuredClone(d);
  }

  /** Every stored path that is, or lies below, one of the prefixes. */
  paths(...prefixes: string[]): string[] {
    return [...this.docs.keys()].filter((p) => prefixes.some((x) => p === x || p.startsWith(`${x}/`))).sort();
  }

  /** Every document that mentions `needle` in its path or its JSON (the completeness listing of US-E15-08/AC11). */
  mentioning(needle: string): string[] {
    return [...this.docs.entries()].filter(([p, d]) => p.includes(needle) || JSON.stringify(d).includes(needle)).map(([p]) => p).sort();
  }

  private select(collection: string, spec: QuerySpec): Row[] {
    let rows = [...this.docs.entries()].filter(([p]) => parentOf(p) === collection).map(([p, d]) => ({ path: p, data: structuredClone(d) }));
    const w = spec.where;
    if (w !== undefined) {
      rows = rows.filter((r) => {
        const v = r.data[w.field];
        if (typeof v !== typeof w.value) return false; // a missing field or another type never matches (as Firestore)
        if (w.op === '==') return v === w.value;
        return w.op === '>' ? (v as number) > (w.value as number) : (v as number) < (w.value as number);
      });
    }
    if (spec.orderBy !== undefined) {
      const f = spec.orderBy;
      rows = rows.filter((r) => r.data[f] !== undefined).sort((a, b) => ((a.data[f] as number) < (b.data[f] as number) ? -1 : (a.data[f] as number) > (b.data[f] as number) ? 1 : a.path < b.path ? -1 : 1));
    } else rows.sort((a, b) => (a.path < b.path ? -1 : 1));
    return spec.limit === undefined ? rows : rows.slice(0, spec.limit);
  }

  async query(collection: string, spec: QuerySpec): Promise<Row[]> {
    if (this.failReads) throw new Error('UNAVAILABLE');
    await Promise.resolve();
    return this.select(collection, spec);
  }

  async runTransaction<T>(fn: (tx: SyncTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const readDocs = new Map<string, number>();
      const readColls = new Map<string, number>();
      const staged = new Map<string, Data | null>(); // null = delete
      const tx: SyncTx = {
        get: async (p): Promise<Snap> => {
          if (staged.size > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          if (this.failReads) throw new Error('UNAVAILABLE');
          await Promise.resolve();
          readDocs.set(p, this.docVersion.get(p) ?? 0);
          const d = this.docs.get(p);
          return { exists: d !== undefined, data: d === undefined ? undefined : structuredClone(d) };
        },
        query: async (collection, spec): Promise<Row[]> => {
          if (staged.size > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          if (this.failReads) throw new Error('UNAVAILABLE');
          await Promise.resolve();
          readColls.set(collection, this.collVersion.get(collection) ?? 0);
          const rows = this.select(collection, spec);
          for (const r of rows) readDocs.set(r.path, this.docVersion.get(r.path) ?? 0);
          return rows;
        },
        set: (p, data) => {
          assertValue(data, p);
          if (Buffer.byteLength(JSON.stringify(data)) + p.length > MAX_DOC_BYTES) throw new Error(`Document ${p} exceeds the maximum size of 1 MiB`);
          staged.set(p, structuredClone(data));
          if (staged.size > MAX_TX_WRITES) throw new Error('Transaction too big: at most 500 writes');
        },
        delete: (p) => {
          staged.set(p, null);
          if (staged.size > MAX_TX_WRITES) throw new Error('Transaction too big: at most 500 writes');
        },
      };
      const value = await fn(tx);
      await this.beforeCommit?.();
      const clash = [...readDocs].some(([p, v]) => (this.docVersion.get(p) ?? 0) !== v) || [...readColls].some(([c, v]) => (this.collVersion.get(c) ?? 0) !== v);
      if (clash) {
        this.retries += 1;
        continue;
      }
      for (const [p, d] of staged) {
        if (d === null) this.docs.delete(p);
        else this.docs.set(p, d);
        this.bump(p);
      }
      this.commits += 1;
      this.maxTxWrites = Math.max(this.maxTxWrites, staged.size);
      return value;
    }
    throw new Error('transaction aborted after too many retries');
  }

  async recursiveDelete(path: string): Promise<void> {
    if (this.failReads) throw new Error('UNAVAILABLE');
    const victims = [...this.docs.keys()].filter((p) => p === path || p.startsWith(`${path}/`));
    for (let i = 0; i < victims.length; i += MAX_TX_WRITES) {
      await Promise.resolve();
      for (const p of victims.slice(i, i + MAX_TX_WRITES)) {
        this.docs.delete(p);
        this.bump(p);
        this.deletedByRecursive += 1;
      }
    }
  }
}
