// The fake must be as strict as the constraints it stands in for (ADR 016 section 7), or the handler tests prove nothing.
import { describe, expect, it } from 'vitest';
import { FakeFirestore, MAX_DOC_BYTES, MAX_TX_WRITES } from './fake-firestore.ts';

describe('FakeFirestore enforces the real constraints', () => {
  it('ADR 016 section 7: a read after a write in one transaction is refused', async () => {
    const db = new FakeFirestore();
    await expect(
      db.runTransaction(async (tx) => {
        tx.set('a/1', { x: 1 });
        await tx.get('a/2');
      }),
    ).rejects.toThrow(/reads to be executed before all writes/);
    await expect(
      db.runTransaction(async (tx) => {
        tx.delete('a/1');
        await tx.query('a', {});
      }),
    ).rejects.toThrow(/before all writes/);
    expect(db.docs.size).toBe(0); // the aborted transaction wrote nothing
  });

  it('ADR 016 section 7: more than 500 writes in one transaction is refused; exactly 500 is allowed', async () => {
    const db = new FakeFirestore();
    await db.runTransaction(async (tx) => {
      for (let i = 0; i < MAX_TX_WRITES; i += 1) tx.set(`a/${i}`, { i });
    });
    expect(db.docs.size).toBe(500);
    await expect(
      db.runTransaction(async (tx) => {
        for (let i = 0; i <= MAX_TX_WRITES; i += 1) tx.delete(`a/${i}`);
      }),
    ).rejects.toThrow(/500 writes/);
    expect(db.docs.size).toBe(500);
  });

  it('ADR 016 section 7: a document over 1 MiB and a value of undefined are refused', async () => {
    const db = new FakeFirestore();
    await expect(db.runTransaction(async (tx) => tx.set('a/1', { big: 'x'.repeat(MAX_DOC_BYTES) }))).rejects.toThrow(/1 MiB/);
    await expect(db.runTransaction(async (tx) => tx.set('a/1', { nested: { v: undefined } }))).rejects.toThrow(/undefined/);
    await db.runTransaction(async (tx) => tx.set('a/1', { ok: 'x'.repeat(MAX_DOC_BYTES - 1000) }));
    expect(db.docs.size).toBe(1);
  });

  it('ADR 016 section 7: a transaction whose document changed under it runs again (optimistic retry), and a query counts as a read of its collection', async () => {
    const db = new FakeFirestore();
    db.seed('c/1', { n: 1 });
    let runs = 0;
    let once = true;
    db.beforeCommit = () => {
      if (once) {
        once = false;
        db.seed('c/2', { n: 2 }); // a new document appears in the collection the query read
      }
    };
    const total = await db.runTransaction(async (tx) => {
      runs += 1;
      const rows = await tx.query('c', {});
      tx.set('sum/1', { n: rows.length });
      return rows.length;
    });
    expect(runs).toBe(2);
    expect(total).toBe(2);
    expect(db.get('sum/1')).toEqual({ n: 2 });
    expect(db.retries).toBe(1);
  });

  it('ADR 016 section 7: queries filter, order and limit like Firestore; a missing field never matches; sub-collections are separate', async () => {
    const db = new FakeFirestore();
    db.seed('f/x/records/a', { seq: 3 });
    db.seed('f/x/records/b', { seq: 1 });
    db.seed('f/x/records/c', { seq: 2, deletedAtMs: 10 });
    db.seed('f/x/records/d', { other: true });
    db.seed('f/x/members/m', { seq: 9 });
    const rows = await db.query('f/x/records', { where: { field: 'seq', op: '>', value: 1 }, orderBy: 'seq', limit: 5 });
    expect(rows.map((r) => r.path)).toEqual(['f/x/records/c', 'f/x/records/a']);
    expect((await db.query('f/x/records', { where: { field: 'deletedAtMs', op: '<', value: 99 } })).map((r) => r.path)).toEqual(['f/x/records/c']);
    expect(await db.query('f/x/records', { where: { field: 'seq', op: '==', value: 'x' } })).toEqual([]);
    expect((await db.query('f/x/records', { orderBy: 'seq', limit: 1 })).map((r) => r.path)).toEqual(['f/x/records/b']);
  });

  it('ADR 016 section 7: recursiveDelete removes the document and everything below it, in chunks of at most 500', async () => {
    const db = new FakeFirestore();
    db.seed('f/x', { s: 1 });
    for (let i = 0; i < 1100; i += 1) db.seed(`f/x/records/${i}`, { i });
    db.seed('f/y', { s: 1 });
    await db.recursiveDelete('f/x');
    expect(db.paths('f')).toEqual(['f/y']);
    expect(db.deletedByRecursive).toBe(1101);
  });
});
