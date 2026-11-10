// records.push / records.pull (ADR 016 section 1): the seq cursor, winner rule, skew clamp, size and write limits, lazy
// tombstone purge. Server parts of US-E15-06/07/10, against the fake Firestore through the real pipeline.
import { describe, expect, it } from 'vitest';
import { SYNC_LIMITS } from '../../../../src/domain/sync/config.ts';
import type { Envelope, PushResult, StoredEnvelope } from '../../../../src/domain/sync/types.ts';
import { DAY, DEVICE_A, DEVICE_B, familyOfTwo, fixtureEnvelopes, HOUR, makeRig, T0, tombstoneOf, ts, UID1, UID2, type Rig } from './harness.ts';

const env = fixtureEnvelopes();
const profile = env['profile_profile']!;
const menu = env['menu_2026-11']!;
const decisionKey = Object.keys(env).find((k) => k.startsWith('decision_'))!;
const decision = env[decisionKey]!;

const at = (e: Envelope, ms: number, extra: Partial<Envelope> = {}): Envelope => ({ ...e, updatedAt: ts(ms), updatedAtMs: Math.floor(ms / 1000) * 1000, ...extra });
/** A decision for another date (payload and key agree). */
function decisionOn(date: string, atMs: number, deviceId = DEVICE_A): Envelope {
  const payload = { ...(JSON.parse(decision.payloadJson!) as Record<string, unknown>), date };
  return { ...decision, key: date, payloadJson: JSON.stringify(payload), updatedAt: ts(atMs), updatedAtMs: Math.floor(atMs / 1000) * 1000, deviceId };
}
const dates = (n: number): string[] => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

type PushReply = { results: PushResult[]; seq: number; schemaVersion: number };
type PullReply = { envelopes: StoredEnvelope[]; seq: number; hasMore: boolean };
const push = async (rig: Rig, uid: string, records: Envelope[]): Promise<PushReply> => (await rig.ok('records.push', uid, { records })) as unknown as PushReply;
const pull = async (rig: Rig, uid: string, cursor: number): Promise<PullReply> => (await rig.ok('records.pull', uid, { cursor })) as unknown as PullReply;
async function ready(over: Parameters<typeof makeRig>[0] = {}): Promise<{ rig: Rig; famId: string }> {
  const rig = makeRig(over);
  const famId = await familyOfTwo(rig);
  return { rig, famId };
}

describe('seq cursor and pull', () => {
  it('US-E15-10/AC4 one push bumps the family seq once and every record of it carries that seq; a pull from the cursor returns only newer records', async () => {
    const { rig, famId } = await ready();
    const r1 = await push(rig, UID1, [profile, menu]);
    expect(r1.seq).toBe(1);
    expect(r1.results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
    const r2 = await push(rig, UID2, [decision]);
    expect(r2.seq).toBe(2);
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ seq: 2 });
    const all = await pull(rig, UID2, 0);
    expect(all.envelopes.map((e) => [e.key, e.seq]).sort()).toEqual([['profile', 1], ['2026-11', 1], [decision.key, 2]].sort()); // order within one seq is not defined
    expect(all).toMatchObject({ seq: 2, hasMore: false });
    const none = await pull(rig, UID1, 2);
    expect(none).toMatchObject({ envelopes: [], seq: 2 }); // an idle poll downloads nothing
    expect((await pull(rig, UID1, 1)).envelopes.map((e) => e.key)).toEqual([decision.key]);
  });

  it('US-E15-10/AC4 a pulled record carries the wire fields only (no bytes, no purge helper), and updatedBy is the writer', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [profile, tombstoneOf(menu, T0 + 1000)]);
    const got = await pull(rig, UID2, 0);
    for (const e of got.envelopes) expect(Object.keys(e).sort()).toEqual(expect.not.arrayContaining(['bytes', 'deletedAtMs']));
    expect(got.envelopes.every((e) => e.updatedBy === UID1)).toBe(true);
    const gone = got.envelopes.find((e) => e.kind === 'menu');
    expect(gone).toMatchObject({ deletedAt: ts(T0 + 1000) });
    expect(gone).not.toHaveProperty('payloadJson');
  });

  it('US-E15-10/AC4 a page never splits records that share one seq, and the cursor continues where the page ended', async () => {
    const { rig, famId } = await ready();
    // 520 stored records, 7 per seq: 500 is not a multiple of 7, so the page must run on to the end of its group.
    for (let i = 0; i < 520; i += 1) {
      const key = `2026-01-${String((i % 28) + 1).padStart(2, '0')}`;
      rig.db.seed(`families/${famId}/records/decision_${key}_${i}`, { kind: 'decision', key, payloadJson: '{}', updatedAt: ts(T0), updatedAtMs: T0, updatedBy: UID1, deviceId: DEVICE_A, seq: Math.floor(i / 7) + 1, bytes: 2 });
    }
    rig.db.seed(`families/${famId}`, { ...rig.db.get(`families/${famId}`)!, seq: 75 });
    const first = await pull(rig, UID1, 0);
    expect(first.hasMore).toBe(true);
    expect(first.envelopes.length).toBeGreaterThanOrEqual(SYNC_LIMITS.pullPageSize);
    expect(first.envelopes.length % 7).toBe(0);
    expect(first.seq).toBe(first.envelopes[first.envelopes.length - 1]?.seq);
    const second = await pull(rig, UID1, first.seq);
    expect(second.hasMore).toBe(false);
    expect(first.envelopes.length + second.envelopes.length).toBe(520);
    expect(second.seq).toBe(75);
  });

  it('US-E15-10/AC4 a bad cursor is a 400, and a cursor past the end returns nothing', async () => {
    const { rig } = await ready();
    for (const cursor of [-1, 1.5, '3', null, undefined]) expect((await rig.call('records.pull', UID1, { cursor })).status).toBe(400);
    expect(await pull(rig, UID1, 999)).toMatchObject({ envelopes: [], seq: 0 });
  });
});

describe('winner rule on the server (contract 14.6)', () => {
  it('US-E15-07/AC1 a later edit wins, an earlier one is superseded and the stored winner comes back', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [at(menu, T0 + 10_000)]);
    const old = await push(rig, UID2, [at(menu, T0 + 5_000)]);
    expect(old.results[0]).toMatchObject({ status: 'superseded', winner: { updatedBy: UID1, updatedAtMs: T0 + 10_000 } });
    expect(old.seq).toBe(1); // nothing written, no seq bump
    const newer = await push(rig, UID2, [at(menu, T0 + 20_000)]);
    expect(newer.results[0]).toMatchObject({ status: 'accepted', stored: { updatedBy: UID2, seq: 2 } });
    expect((await pull(rig, UID1, 0)).envelopes[0]?.updatedBy).toBe(UID2);
  });

  it('US-E15-07/AC2 equal stamps: the greater deviceId wins, whichever arrives first', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [at(menu, T0 + 1000, { deviceId: DEVICE_B })]);
    expect((await push(rig, UID2, [at(menu, T0 + 1000, { deviceId: DEVICE_A })])).results[0]?.status).toBe('superseded');
    const { rig: rig2 } = await ready();
    await push(rig2, UID1, [at(menu, T0 + 1000, { deviceId: DEVICE_A })]);
    expect((await push(rig2, UID2, [at(menu, T0 + 1000, { deviceId: DEVICE_B })])).results[0]?.status).toBe('accepted');
  });

  it('US-E15-07/AC3 a later edit resurrects a deleted record; a later delete removes it', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [at(menu, T0 + 1000)]);
    expect((await push(rig, UID2, [tombstoneOf(menu, T0 + 2000)])).results[0]?.status).toBe('accepted');
    expect((await push(rig, UID1, [at(menu, T0 + 1500)])).results[0]?.status).toBe('superseded'); // an older edit does not resurrect
    expect((await push(rig, UID1, [at(menu, T0 + 3000)])).results[0]?.status).toBe('accepted');
    expect((await push(rig, UID2, [tombstoneOf(menu, T0 + 4000)])).results[0]?.status).toBe('accepted');
    const [e] = (await pull(rig, UID1, 0)).envelopes;
    expect(e).toMatchObject({ deletedAt: ts(T0 + 4000) });
  });

  it('US-E15-07/AC4 re-pushing the same envelope is a no-op: accepted again, same seq, no new write (a lost response is safe)', async () => {
    const { rig } = await ready();
    const first = await push(rig, UID1, [profile]);
    const writes = rig.db.commits;
    const again = await push(rig, UID1, [profile]);
    expect(again.results[0]).toMatchObject({ status: 'accepted', stored: { seq: 1 } });
    expect(again.seq).toBe(first.seq);
    expect(rig.db.commits).toBe(writes + 1); // the transaction runs, but writes nothing
    expect(await pull(rig, UID1, 0)).toMatchObject({ seq: 1 });
  });

  it('US-E15-07/AC5 aiUsage keeps the larger count whoever writes it last, and an aiUsage tombstone is refused', async () => {
    const { rig } = await ready();
    const usage = env['aiUsage_2026-11']!;
    const withCount = (n: number, ms: number): Envelope => ({ ...usage, payloadJson: JSON.stringify({ count: n }), updatedAt: ts(ms), updatedAtMs: ms });
    await push(rig, UID1, [withCount(5, T0)]);
    expect((await push(rig, UID2, [withCount(3, T0 + 60_000)])).results[0]).toMatchObject({ status: 'superseded', winner: { payloadJson: '{"count":5}' } });
    expect((await push(rig, UID2, [withCount(7, T0 - 60_000)])).results[0]?.status).toBe('accepted');
    expect((await rig.call('records.push', UID1, { records: [tombstoneOf(usage, T0 + 1000)] })).status).toBe(400);
  });

  it('US-E15-07/AC6 a tombstone older than 90 days is purged by a later push (up to 20 per push), a younger one stays', async () => {
    const { rig, famId } = await ready();
    const ds = dates(25);
    // Tombstones stamped 100 days ago (old) and 10 days ago (young), written directly through pushes.
    await push(rig, UID1, [...ds.map((d) => tombstoneOf(decisionOn(d, T0), T0 - 100 * DAY)), tombstoneOf(decisionOn('2026-02-01', T0), T0 - 10 * DAY)]);
    expect(rig.db.paths(`families/${famId}/records`)).toHaveLength(26);
    await push(rig, UID1, [profile]); // the next push purges 20
    expect(rig.db.paths(`families/${famId}/records`)).toHaveLength(26 - 20 + 1);
    await push(rig, UID1, [at(profile, T0 + 1000)]); // and the rest
    const left = rig.db.paths(`families/${famId}/records`).map((p) => p.split('/').pop());
    expect(left).toContain('decision_2026-02-01'); // 10 days old: kept
    expect(left).toContain('profile_profile');
    expect(left.filter((k) => k?.startsWith('decision_2026-01'))).toEqual([]);
    expect(rig.db.maxTxWrites).toBeLessThan(500);
  });

  it('US-E15-07/AC6 a purged tombstone is gone from a pull (the device reconciles by the contract rule)', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [tombstoneOf(menu, T0 - 100 * DAY)]);
    expect((await pull(rig, UID2, 0)).envelopes).toHaveLength(1);
    await push(rig, UID1, [profile]);
    expect((await pull(rig, UID2, 0)).envelopes.map((e) => e.kind)).toEqual(['profile']);
  });

  it('US-E15-07/AC10 a record whose month is beyond the 13-month retention is not written; a tombstone for one is accepted', async () => {
    const { rig } = await ready();
    const old = decisionOn('2025-01-05', T0);
    const r = await rig.call('records.push', UID1, { records: [old] });
    expect(r).toMatchObject({ status: 400, body: { error: 'INVALID_RECORD', reason: 'beyond-retention' } });
    expect((await rig.call('records.push', UID1, { records: [tombstoneOf(old, T0)] })).status).toBe(200);
  });

  it('US-E15-07/AC11 two records with the same key in one push are refused (the client sends the latest per record)', async () => {
    const { rig } = await ready();
    expect((await rig.call('records.push', UID1, { records: [profile, at(profile, T0 + 1000)] })).body).toMatchObject({ error: 'INVALID_RECORD', reason: 'duplicate-key' });
  });
});

describe('clock skew (contract 14.6)', () => {
  it('US-E15-07/AC7 a stamp more than 5 minutes ahead is stored as the receive time; 5 minutes exactly is kept; a tombstone follows', async () => {
    const { rig } = await ready();
    rig.now = T0 + 1234; // not a whole second: the stored stamp stays consistent
    const future = await push(rig, UID1, [at(menu, T0 + 6 * 60_000)]);
    const stored = future.results[0] as { stored: StoredEnvelope };
    expect(stored.stored.updatedAt).toBe(ts(T0 + 1000)); // the receive time, at whole seconds
    expect(stored.stored.updatedAtMs).toBe(Date.parse(stored.stored.updatedAt)); // still passes the shared validator
    const edge = await push(rig, UID1, [at(decisionOn('2026-11-03', T0), T0 + 5 * 60_000 + 1234)]);
    expect((edge.results[0] as { stored: StoredEnvelope }).stored.updatedAtMs).toBe(Math.floor((T0 + 5 * 60_000 + 1234) / 1000) * 1000);
    const gone = await push(rig, UID1, [tombstoneOf(profile, T0 + 10 * 60_000)]);
    expect((gone.results[0] as { stored: StoredEnvelope }).stored).toMatchObject({ updatedAt: ts(T0 + 1000), deletedAt: ts(T0 + 1000) });
  });

  it('US-E15-07/AC7 a skewed record cannot win for good: after the clamp a genuine edit made later beats it', async () => {
    const { rig } = await ready();
    await push(rig, UID1, [at(menu, T0 + 2 * DAY)]); // a wrong clock two days ahead
    rig.now = T0 + 60_000;
    const real = await push(rig, UID2, [at(menu, T0 + 30_000)]);
    // The two-days-ahead stamp was stored as the receive time T0, so a genuine edit made at T0+30s wins.
    expect(real.results[0]).toMatchObject({ status: 'accepted', stored: { updatedBy: UID2 } });
  });
});

describe('limits', () => {
  it('US-E15-10/AC1 a family total over 5 MiB is refused as LIMIT family and nothing is written; a smaller replacement frees room', async () => {
    const { rig, famId } = await ready();
    rig.db.seed(`families/${famId}`, { ...rig.db.get(`families/${famId}`)!, totalBytes: SYNC_LIMITS.maxFamilyBytes - 10 });
    const r = await rig.call('records.push', UID1, { records: [profile] });
    expect(r).toMatchObject({ status: 413, body: { ok: false, error: 'LIMIT', scope: 'family' } });
    expect(rig.db.paths(`families/${famId}/records`)).toEqual([]);
    rig.db.seed(`families/${famId}`, { ...rig.db.get(`families/${famId}`)!, totalBytes: 0 });
    expect((await rig.call('records.push', UID1, { records: [profile] })).status).toBe(200);
  });

  it('US-E15-10/AC1 totalBytes follows the stored records: a replacement counts the difference, a tombstone frees the payload', async () => {
    const { rig, famId } = await ready();
    await push(rig, UID1, [profile]);
    const bytes = rig.db.get(`families/${famId}`)!['totalBytes'] as number;
    expect(bytes).toBe(new TextEncoder().encode(profile.payloadJson!).length);
    await push(rig, UID1, [tombstoneOf(profile, T0 + 5000)]);
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ totalBytes: 0 });
  });

  it('US-E15-10/AC3 the server\'s own runaway guard: writes per account per hour are capped, the refusal says when to retry, and the hour resets', async () => {
    const { rig } = await ready({ writesPerHour: 200 });
    const ds = dates(201);
    for (let i = 0; i < 4; i += 1) await push(rig, UID1, ds.slice(i * 50, i * 50 + 50).map((d) => decisionOn(d, T0)));
    const over = await rig.call('records.push', UID1, { records: [decisionOn(ds[200]!, T0)] });
    expect(over).toMatchObject({ status: 429, body: { ok: false, error: 'LIMIT', scope: 'writes' } });
    expect(over.body['retryAfterSec']).toBe(3600);
    expect(over.headers['retry-after']).toBe('3600');
    expect(rig.db.get(`families/${(rig.db.paths('families')[0] ?? '').split('/')[1]}/records/decision_${ds[200]}`)).toBeUndefined();
    // Another account has its own budget; superseded and unchanged records do not use it up.
    expect((await rig.call('records.push', UID2, { records: [decisionOn(ds[200]!, T0)] })).status).toBe(200);
    rig.now += HOUR + 1000;
    expect((await rig.call('records.push', UID1, { records: [decisionOn(ds[0]!, T0 + 5000)] })).status).toBe(200);
  });

  it('US-E15-10/AC3 re-sent and superseded records do not count against the write guard', async () => {
    const { rig } = await ready({ writesPerHour: 2 });
    await push(rig, UID1, [profile, menu]);
    for (let i = 0; i < 5; i += 1) await push(rig, UID1, [profile, menu]); // unchanged: no writes
    await push(rig, UID1, [at(profile, T0 - 1000)]); // older: superseded
    expect((await rig.call('records.push', UID1, { records: [at(profile, T0 + 9000)] })).status).toBe(429);
  });

  it('US-E15-10/AC1 a push of 50 records is one transaction well under the 500-write limit', async () => {
    const { rig } = await ready();
    await push(rig, UID1, dates(50).map((d) => decisionOn(d, T0)));
    expect(rig.db.maxTxWrites).toBeLessThanOrEqual(53);
  });
});

describe('logs hold no personal data (ADR 016 section 2.1)', () => {
  it('US-E15-10/AC6 every log line has the fixed shape and carries no uid, e-mail, code, family id or record content', async () => {
    const { rig, famId } = await ready({ maxMembers: 3 });
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    await push(rig, UID1, [profile, menu]);
    await pull(rig, UID2, 0);
    await rig.call('invite.redeem', UID2, { code: 'WRONGCODE2', consentVersion: 1 });
    await rig.call('records.push', UID1, { records: [{ ...profile, payloadJson: 'SECRET-PAYLOAD' }] });
    await rig.call('records.push', null, { records: [profile] });
    rig.db.failReads = true;
    await rig.call('records.pull', UID1, { cursor: 0 });
    const lines = rig.logs;
    expect(lines.length).toBeGreaterThan(8);
    for (const line of lines) {
      expect(line, line).toMatch(/^(sync op=[\w.-]+ outcome=[\w.-]+ status=\d{3} ms=\d+ account=[0-9a-f]{32}|sync op=[\w.-]+ outcome=[\w.-]+ status=\d{3} ms=\d+ account=-|error op=[\w.-]+ class=\w+)$/);
      for (const secret of [UID1, UID2, 'example.test', code, famId, 'SECRET-PAYLOAD', 'Bearer', 'tok-']) expect(line).not.toContain(secret);
    }
  });
});
