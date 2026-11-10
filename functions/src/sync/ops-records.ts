// records.push / records.pull (ADR 016 section 1): one transaction on the family document bumps `seq`, writes the accepted
// records with that `seq` and keeps `totalBytes`. Validation is the shared `validateEnvelope` of slice A (rules-write-shape);
// the winner rule is `compareEnvelopes`; `updatedBy` is always the token's uid; future stamps are clamped to the receive time.
import { SYNC_LIMITS } from '../../../src/domain/sync/config.ts';
import { validateEnvelope } from '../../../src/domain/sync/envelope.ts';
import { utf8Bytes } from '../../../src/domain/sync/hash.ts';
import { clampUpdatedAt, compareEnvelopes, isBeyondRetention } from '../../../src/domain/sync/merge.ts';
import { recordKeyOf, type Envelope, type PushResult, type StoredEnvelope } from '../../../src/domain/sync/types.ts';
import { familyBytes, familySchema, familySeq, gate } from './authorize.ts';
import { stamp } from './ops-membership.ts';
import { path, toDocument, toStored } from './store.ts';
import { refuse, type Caller, type Ctx, type Data } from './types.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const PURGE_PER_PUSH = 20;

/** The skew clamp of contract 14.6, kept at whole seconds so `updatedAtMs` still equals `Date.parse(updatedAt)`. */
function receive(sent: Envelope, uid: string, nowMs: number): Envelope {
  const wholeNow = Math.floor(nowMs / 1000) * 1000;
  const clamped = clampUpdatedAt(sent.updatedAtMs, nowMs);
  const base: Envelope = { ...sent, updatedBy: uid }; // never the client's value
  if (clamped === sent.updatedAtMs) return base;
  const at = stamp(wholeNow);
  const out: Envelope = { ...base, updatedAtMs: wholeNow, updatedAt: at };
  if (sent.deletedAt !== undefined) out.deletedAt = at;
  return out;
}

export async function pushRecords(ctx: Ctx, caller: Caller, body: Record<string, unknown>): Promise<Data> {
  const list = body['records'];
  if (!Array.isArray(list)) throw refuse.badRequest('records');
  if (list.length > SYNC_LIMITS.pushBatchSize) throw refuse.badRequest('batch-too-large');
  const nowMs = ctx.nowMs();
  const incoming: Envelope[] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const checked = validateEnvelope(raw); // client fields only: seq, bytes and any unknown field are refused
    if (!checked.ok) {
      if (checked.reason === 'too-large') throw refuse.limit('record');
      throw refuse.invalidRecord(i, checked.rule, checked.reason);
    }
    const e = checked.envelope;
    if (e.deletedAt === undefined && isBeyondRetention(e.kind, e.key, nowMs)) throw refuse.invalidRecord(i, 'sync-envelope-shape', 'beyond-retention');
    const id = recordKeyOf(e);
    if (seen.has(id)) throw refuse.invalidRecord(i, 'sync-envelope-shape', 'duplicate-key');
    seen.add(id);
    incoming.push(receive(e, caller.uid, nowMs));
  });

  return ctx.db.runTransaction(async (tx) => {
    const az = await gate(tx, caller.uid, 'records.push', ctx.config);
    const limitsSnap = await tx.get(path.limits(caller.uid));
    const existing = new Map<string, { stored: StoredEnvelope; bytes: number }>();
    for (const e of incoming) {
      const snap = await tx.get(path.record(az.familyId, recordKeyOf(e)));
      if (snap.exists && snap.data !== undefined) existing.set(recordKeyOf(e), { stored: toStored(snap.data), bytes: typeof snap.data['bytes'] === 'number' ? snap.data['bytes'] : 0 });
    }
    // Lazy purge of old tombstones (ADR 016 section 1): a numeric `deletedAtMs`, so the query needs only the automatic index.
    const stale = await tx.query(path.records(az.familyId), { where: { field: 'deletedAtMs', op: '<', value: nowMs - SYNC_LIMITS.tombstoneRetentionDays * DAY_MS }, orderBy: 'deletedAtMs', limit: PURGE_PER_PUSH });

    const seq = familySeq(az.family);
    // Decide every record first (nothing is written yet).
    const results: PushResult[] = [];
    const writes: { id: string; envelope: Envelope; bytes: number }[] = [];
    let delta = 0;
    for (const e of incoming) {
      const id = recordKeyOf(e);
      const have = existing.get(id);
      const order = have === undefined ? 1 : compareEnvelopes(e, have.stored);
      if (have !== undefined && order < 0) {
        results.push({ kind: e.kind, key: e.key, status: 'superseded', winner: have.stored });
        continue;
      }
      if (have !== undefined && order === 0) {
        results.push({ kind: e.kind, key: e.key, status: 'accepted', stored: have.stored });
        continue;
      }
      const bytes = utf8Bytes(e.payloadJson ?? '');
      delta += bytes - (have?.bytes ?? 0);
      writes.push({ id, envelope: e, bytes });
      results.push({ kind: e.kind, key: e.key, status: 'accepted', stored: { ...e, seq: seq + 1 } });
    }
    if (writes.length === 0) return { results, seq, schemaVersion: familySchema(az.family) };

    if (familyBytes(az.family) + delta > SYNC_LIMITS.maxFamilyBytes) throw refuse.limit('family');
    // Runaway guard per account: a fixed one-hour window (ADR 016 section 1: three times the client's 200).
    const win = limitsSnap.data;
    const windowStart = win !== undefined && typeof win['windowStartMs'] === 'number' && nowMs - win['windowStartMs'] < HOUR_MS && win['windowStartMs'] <= nowMs ? win['windowStartMs'] : nowMs;
    const used = windowStart === win?.['windowStartMs'] && typeof win['count'] === 'number' ? win['count'] : 0;
    if (used + writes.length > ctx.config.writesPerHour) {
      throw refuse.limit('writes', { retryAfterSec: Math.max(1, Math.ceil((windowStart + HOUR_MS - nowMs) / 1000)) });
    }

    const nextSeq = seq + 1; // the value every stored result above already carries
    for (const w of writes) tx.set(path.record(az.familyId, w.id), toDocument(w.envelope, nextSeq, w.bytes));
    const keep = new Set(writes.map((w) => w.id));
    for (const row of stale) if (!keep.has(row.path.slice(row.path.lastIndexOf('/') + 1))) tx.delete(row.path);
    tx.set(path.family(az.familyId), { ...az.family, seq: nextSeq, totalBytes: familyBytes(az.family) + delta });
    tx.set(path.limits(caller.uid), { windowStartMs: windowStart, count: used + writes.length });
    return { results, seq: nextSeq, schemaVersion: familySchema(az.family) };
  });
}

export async function pullRecords(ctx: Ctx, caller: Caller, body: Record<string, unknown>): Promise<Data> {
  const cursor = body['cursor'];
  if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) throw refuse.badRequest('cursor');
  return ctx.db.runTransaction(async (tx) => {
    const az = await gate(tx, caller.uid, 'records.pull', ctx.config);
    // Fetch room for one whole push after the page: a page never splits records that share one `seq`, or the cursor would skip some.
    const rows = await tx.query(path.records(az.familyId), { where: { field: 'seq', op: '>', value: cursor }, orderBy: 'seq', limit: SYNC_LIMITS.pullPageSize + SYNC_LIMITS.pushBatchSize });
    const all = rows.map((r) => toStored(r.data));
    let end = Math.min(SYNC_LIMITS.pullPageSize, all.length);
    while (end < all.length && all[end]?.seq === all[end - 1]?.seq) end += 1;
    const page = all.slice(0, end);
    const hasMore = all.length > page.length;
    const last = page[page.length - 1];
    return { envelopes: page, seq: hasMore && last !== undefined ? last.seq : familySeq(az.family), hasMore, schemaVersion: familySchema(az.family) };
  });
}

