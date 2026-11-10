// ADR 016 slice C, the pure parts: the base address variable, the owner scope, the repository's owner list, and the push
// path guard. Fixtures only; no clock, no network.
import { describe, expect, it } from 'vitest';
import { createRepository, StoreValidationError } from '../../../../src/domain/storage/repository.ts';
import { parseSyncBase } from '../../../../src/domain/sync/base-url.ts';
import { createOwnerScope } from '../../../../src/domain/sync/owner-scope.ts';
import { INVALID_RECORD_DETAIL, withPushGuard, wouldBeRefused } from '../../../../src/domain/sync/push-guard.ts';
import { liveEnvelope, tombstoneEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { SyncPortError, type Envelope, type PushResult, type SyncPort } from '../../../../src/domain/sync/types.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';
import { storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { DEVICE_A, T0, UID1, storeWithData, testClock, ts } from './helpers.ts';

const FAM = 'fam-test-001';

describe('US-E15-06 the sync base address variable', () => {
  it.each([
    ['https with a path', 'https://sync.example.test/api', 'https://sync.example.test/api'],
    ['trailing slash dropped', 'https://sync.example.test/api/', 'https://sync.example.test/api'],
  ])('US-E15-06/AC1 %s is the base', (_n, raw, base) => {
    expect(parseSyncBase(raw)).toEqual({ base, rejected: false });
  });

  it.each([undefined, null, '', '   '])('US-E15-11/AC1 unset or empty (%s) means sync is off, without a warning', (raw) => {
    expect(parseSyncBase(raw)).toEqual({ base: null, rejected: false });
  });

  it.each(['http://sync.example.test', 'http://127.0.0.1:8787', 'http://localhost:8787', 'ftp://x.test', 'not a url', 'https://u:p@x.test', 'https://x.test/?a=1', 'https://x.test/#f', 42, {}])(
    'US-E15-11/AC1 an invalid or non-https value (%s) is ignored and flagged for one warning',
    (raw) => {
      expect(parseSyncBase(raw)).toEqual({ base: null, rejected: true });
    },
  );
});

describe('US-E15-11/AC3 the repository accepts the uid or the family id, nothing else (contract 14.7)', () => {
  const memberStore = () => JSON.parse(JSON.stringify(storeWithData(DEVICE_A, FAM))) as ReturnType<typeof storeWithData>;

  it('US-E15-11/AC3 a store owned by the family id is refused without the list and accepted with it', async () => {
    const clock = fixedClock('2026-11-10T10:00:00+09:00');
    const plain = createRepository(memoryStorage(), clock, { accountId: UID1 });
    await expect(plain.save(memberStore())).rejects.toBeInstanceOf(StoreValidationError);
    const storage = memoryStorage();
    const withList = createRepository(storage, clock, { accountId: UID1, allowedOwnerIds: [FAM] });
    await withList.save(memberStore());
    expect((await withList.load()).kind).toBe('ok');
    expect(storage.data.has(storeKeysFor(UID1).state)).toBe(true);
  });

  it('US-E15-11/AC3 the list may change at run time (create, join, leave): the repository asks every time', async () => {
    const clock = fixedClock('2026-11-10T10:00:00+09:00');
    const scope = createOwnerScope(UID1);
    const repo = createRepository(memoryStorage(), clock, { accountId: UID1, allowedOwnerIds: () => scope.ids() });
    await expect(repo.save(memberStore())).rejects.toBeInstanceOf(StoreValidationError);
    scope.setFamilyId(FAM);
    await repo.save(memberStore());
    scope.setFamilyId(null);
    expect(repo.exportJson(storeWithData(DEVICE_A, UID1))).toContain(UID1);
    expect(() => repo.exportJson(memberStore())).toThrow(StoreValidationError);
  });

  it('US-E15-11/AC3 any other owner value fails, with or without the list', async () => {
    const clock = fixedClock('2026-11-10T10:00:00+09:00');
    const repo = createRepository(memoryStorage(), clock, { accountId: UID1, allowedOwnerIds: [FAM] });
    await expect(repo.save(storeWithData(DEVICE_A, 'someone-else'))).rejects.toBeInstanceOf(StoreValidationError);
  });

  it('US-E15-11/AC1 without the list (sync off) the repository behaves exactly as before', async () => {
    const repo = createRepository(memoryStorage(), fixedClock('2026-11-10T10:00:00+09:00'), { accountId: UID1 });
    await repo.save(storeWithData(DEVICE_A, UID1));
    expect(createOwnerScope(UID1).ids()).toEqual([UID1]);
    expect(createOwnerScope(UID1).ids()).not.toContain(FAM);
  });
});

const live = (kind: Envelope['kind'], key: string, at = T0, payload = '{}'): Envelope => liveEnvelope({ kind, key, payloadJson: payload, updatedAt: ts(at), updatedBy: UID1, deviceId: DEVICE_A });

class ScriptedPort implements Pick<SyncPort, 'push'> {
  readonly sent: string[][] = [];
  private readonly badKeys: Set<string>;
  private readonly failAfter: number;
  private readonly tooLargeOver: number;
  constructor(badKeys: Set<string> = new Set(), failAfter = Infinity, tooLargeOver = Infinity) {
    this.badKeys = badKeys;
    this.failAfter = failAfter;
    this.tooLargeOver = tooLargeOver;
  }
  push(envelopes: readonly Envelope[]): Promise<PushResult[]> {
    this.sent.push(envelopes.map((e) => `${e.kind}_${e.key}`));
    if (envelopes.length > this.tooLargeOver) return Promise.reject(new SyncPortError('limit', 'request'));
    if (envelopes.some((e) => this.badKeys.has(`${e.kind}_${e.key}`))) return Promise.reject(new SyncPortError('refused', INVALID_RECORD_DETAIL));
    if (this.sent.length > this.failAfter) return Promise.reject(new SyncPortError('temporary'));
    return Promise.resolve(envelopes.map((e) => ({ kind: e.kind, key: e.key, status: 'accepted' as const, stored: { ...e, seq: 1 } })));
  }
}
const guarded = (inner: ScriptedPort, nowMs = T0) => withPushGuard(inner as unknown as SyncPort, () => nowMs);

describe('US-E15-10/AC1 and US-E15-06 the push path never sends what the server would refuse', () => {
  it('US-E15-10/AC1 a live record beyond 13 months and one over 256 KiB are filtered; their tombstones and profile or settings are not', () => {
    const old = live('menu', '2025-01');
    const big = live('decision', '2026-11-04', T0, JSON.stringify({ x: 'a'.repeat(262_200) }));
    expect(wouldBeRefused(old, T0)).toBe(true);
    expect(wouldBeRefused(big, T0)).toBe(true);
    expect(wouldBeRefused(tombstoneEnvelope({ kind: 'menu', key: '2025-01', updatedAt: ts(T0), updatedBy: UID1, deviceId: DEVICE_A }), T0)).toBe(false);
    expect(wouldBeRefused(live('profile', 'profile'), T0)).toBe(false);
    expect(wouldBeRefused(live('menu', '2026-11'), T0)).toBe(false);
  });

  it('US-E15-10/AC1 only the sendable records reach the port; nothing at all means no request', async () => {
    const inner = new ScriptedPort();
    const port = guarded(inner);
    const r = await port.push([live('menu', '2025-01'), live('menu', '2026-11')]);
    expect(inner.sent).toEqual([['menu_2026-11']]);
    expect(r.map((x) => x.key)).toEqual(['2026-11']);
    expect(await port.push([live('menu', '2025-01')])).toEqual([]);
    expect(inner.sent).toHaveLength(1);
  });

  it('US-E15-06/AC9 one invalid record never blocks the rest: the batch is retried per record, the others are accepted', async () => {
    const inner = new ScriptedPort(new Set(['decision_2026-11-05']));
    const port = guarded(inner);
    const batch = [live('decision', '2026-11-04'), live('decision', '2026-11-05'), live('decision', '2026-11-06')];
    const r = await port.push(batch);
    expect(r.map((x) => x.key)).toEqual(['2026-11-04', '2026-11-06']);
    expect(port.refused.get('decision_2026-11-05')).toBe(batch[1]?.updatedAt);
  });

  it('US-E15-06/AC9 a refused record is not offered again until it is edited', async () => {
    const inner = new ScriptedPort(new Set(['decision_2026-11-05']));
    const port = guarded(inner);
    await port.push([live('decision', '2026-11-05')]);
    const before = inner.sent.length;
    expect(await port.push([live('decision', '2026-11-05')])).toEqual([]);
    expect(inner.sent.length).toBe(before);
    await port.push([live('decision', '2026-11-05', T0 + 5000)]);
    expect(inner.sent.length).toBe(before + 1);
  });

  it('US-E15-06/AC5 a temporary failure part-way keeps what was accepted and shows the error again next cycle', async () => {
    const inner = new ScriptedPort(new Set(['decision_2026-11-04']), 3);
    const port = guarded(inner);
    const r = await port.push([live('decision', '2026-11-04'), live('decision', '2026-11-05'), live('decision', '2026-11-06')]);
    expect(r.map((x) => x.key)).toEqual(['2026-11-05']);
    const failing = new ScriptedPort(new Set(), 0);
    await expect(guarded(failing).push([live('decision', '2026-11-05'), live('decision', '2026-11-06')])).rejects.toMatchObject({ kind: 'temporary' });
  });

  it('US-E15-10/AC1 a request that is too large is split in halves', async () => {
    const inner = new ScriptedPort(new Set(), Infinity, 2);
    const port = guarded(inner);
    const r = await port.push([live('decision', '2026-11-01'), live('decision', '2026-11-02'), live('decision', '2026-11-03'), live('decision', '2026-11-04')]);
    expect(r).toHaveLength(4);
    expect(inner.sent.map((s) => s.length)).toEqual([4, 2, 2]);
  });

  it('US-E15-10/AC6 membership calls pass through unchanged', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const port = withPushGuard(backend.portFor(UID1), clock.fn);
    expect((await port.createFamily({ version: 1 })).familyId).toMatch(/\S/);
    expect(await port.readMembership()).toMatchObject({ status: 'member' });
  });
});
