// QA E15: the sync Function writes nothing personal to its log (contract 14.13, ADR 016, US-E14-06 pattern), at rest only the fields
// the model allows are stored, and the store holds no PDF text or allergy values outside the record payload.
import { describe, expect, it } from 'vitest';
import { ALL_OPS, UID1, UID2, UID3, createFamilyOf, familyOfTwo, fixtureEnvelopes, makeRig, type Rig } from './qa-rig.ts';

const env = fixtureEnvelopes();
const MARKERS = ['one@example.test', 'two@example.test', 'three@example.test', UID1, UID2, UID3, 'test-uid', 'ピーナッツ', 'PDF-TEXT-MARKER', '削除する', 'mrdrah'];

async function drive(rig: Rig): Promise<string[]> {
  const fam = await createFamilyOf(rig, UID1);
  const { code } = await rig.ok('invite.create', UID1);
  await rig.call('invite.redeem', UID3, { code: 'WRONGCODE2', consentVersion: 1 });
  await rig.call('invite.redeem', UID2, { code, consentVersion: 1 });
  const marked = { ...env['profile_profile']!, payloadJson: env['profile_profile']!.payloadJson!.replace(/"nickname":"[^"]*"/, '"nickname":"ピーナッツ PDF-TEXT-MARKER"') };
  await rig.call('records.push', UID1, { records: [marked] });
  await rig.call('records.pull', UID2, { cursor: 0 });
  await rig.call('records.push', UID3, { records: [marked] });
  await rig.call('family.removeMember', UID1, { uid: UID2 });
  await rig.call('records.pull', UID2, { cursor: 0 });
  await rig.call('membership.get', UID1);
  await rig.call('family.delete', UID1, { confirmation: '削除する' });
  for (const op of ALL_OPS) await rig.call(op, UID3, { code: 'ABCD234567', uid: UID1, familyId: fam, email: 'one@example.test', consentVersion: 1 }, { origin: 'https://evil.example' });
  await rig.call('records.pull', UID1, 'not json');
  return rig.logs;
}

describe('US-E15-09 log lines carry no personal data', () => {
  it('after every operation, success and refusal, no log line holds an e-mail, uid, name, allergy text, code, confirmation word or PDF text', async () => {
    const rig = makeRig();
    const logs = await drive(rig);
    expect(logs.length).toBeGreaterThan(20);
    for (const l of logs) for (const m of MARKERS) expect(l, `${m} in: ${l}`).not.toContain(m);
    for (const l of logs) expect(l).toMatch(/^(sync op=[A-Za-z.-]{1,40} outcome=[A-Za-z0-9._-]+ status=\d{3} ms=\d+ account=([0-9a-f]{32}|-)|error op=[A-Za-z.-]+ class=\w+)$/);
  });

  it('an internal failure logs the error class only, never its message (which here contains a uid, e-mail and PDF text), and answers a fixed 503', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    rig.logs.length = 0;
    const deps = { ...rig.deps(), db: { runTransaction: () => Promise.reject(new Error('uid test-uid-001 one@example.test PDF-TEXT-MARKER families/x')), query: rig.db.query.bind(rig.db), recursiveDelete: rig.db.recursiveDelete.bind(rig.db) } };
    const r = await rig.call('records.pull', UID1, { cursor: 0 }, {}, deps);
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ ok: false, error: 'UNAVAILABLE' });
    expect(rig.logs.join('\n')).not.toMatch(/test-uid|one@|PDF-TEXT|families\//);
    expect(rig.logs.join('\n')).toContain('class=Error');
  });

  it('an error class name carrying personal text or a line break cannot inject it into a log line', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    class Evil extends Error {}
    Object.defineProperty(Evil, 'name', { value: 'test-uid-001\nINJECT' });
    const deps = { ...rig.deps(), db: { runTransaction: () => Promise.reject(new Evil('x')), query: rig.db.query.bind(rig.db), recursiveDelete: rig.db.recursiveDelete.bind(rig.db) } };
    rig.logs.length = 0;
    await rig.call('records.pull', UID1, { cursor: 0 }, {}, deps);
    const all = rig.logs.join('\n');
    expect(all).not.toContain('INJECT');
    expect(all).not.toContain('test-uid');
  });
});

describe('at rest', () => {
  it('attempt/limit documents are keyed by hashes and hold no uid or e-mail; e-mails exist only in member documents', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await rig.call('invite.redeem', UID3, { code: 'WRONGCODE2', consentVersion: 1 });
    await rig.ok('records.push', UID1, { records: [env['profile_profile']!] });
    for (const [path, doc] of rig.db.docs) {
      const text = JSON.stringify(doc);
      if (path.startsWith('inviteAttempts/') || path.startsWith('syncLimits/')) {
        expect(path).toMatch(/^[a-zA-Z]+\/[0-9a-f]{64}$/);
        expect(text).not.toMatch(/test-uid|@/);
      }
      if (path.startsWith('accounts/')) expect(text).not.toContain('@');
    }
    const withMail = rig.db.mentioning('@example.test');
    expect(withMail.length).toBeGreaterThan(0);
    expect(withMail.every((p) => /^families\/[^/]+\/members\//.test(p))).toBe(true);
  });

  it('membership.get shows e-mail only to members of that family, and for that family only; a non-member sees no family at all', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await createFamilyOf(rig, 'test-uid-004');
    expect(JSON.stringify(await rig.ok('membership.get', UID1))).toContain('two@example.test');
    expect(JSON.stringify(await rig.ok('membership.get', 'test-uid-004'))).not.toMatch(/example\.test/);
    expect(JSON.stringify(await rig.ok('membership.get', UID3))).not.toMatch(/example\.test|familyId|members|invite/);
  });
});
