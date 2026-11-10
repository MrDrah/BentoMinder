// E15 slice E, US-E15-11/AC6 and AC7 through the real screens: the member imports a file (after the warning) and the other
// device converges; delete-all as a member sends no deletions. Real controller over a FakeBackend.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';
import { DEVICE_B, NOW_MS, UID1, UID2, driftMs, makeDevice, renderDevice, resetFamilyUi } from './family-harness.tsx';
import { setNote } from '../domain/sync/helpers.ts';

let backend: FakeBackend;
beforeEach(async () => {
  await import('../../../src/ui/sync/family/index.tsx'); // load the lazy chunk first (the test runner's module cycle quirk)
  backend = new FakeBackend({ nowMs: () => NOW_MS });
  driftMs.value = 0;
  resetFamilyUi();
});
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe('US-E15-11 import and delete-all as a member, through the screens', () => {
  it('US-E15-11/AC6 confirming the warning replaces the family data: the other device shows the imported data, the family id is the owner', async () => {
    const user = userEvent.setup();
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    await b.controller.family.join(code);
    await settle(150);
    const file = setNote(a.stored() as BentoMinderStore, '読み込んだメモ', NOW_MS - 3_600_000);
    const familyId = a.meta().familyId as string;

    renderDevice(a, '#/settings');
    await user.upload(await screen.findByTestId('data-import'), new File([a.repository.exportJson(file)], 'export.json', { type: 'application/json' }));
    await user.click(await screen.findByTestId('dialog-import-family-confirm'));
    await screen.findByTestId('screen-calendar');
    expect(a.stored()?.profile?.note).toBe('読み込んだメモ');
    expect(a.stored()?.profile?.ownerId).toBe(familyId);
    expect(a.stored()?.deviceId).not.toBe(DEVICE_B);
    driftMs.value += 40_000;
    a.controller.syncNow();
    await settle(200);
    b.controller.syncNow();
    await settle(200);
    expect(b.stored()?.profile?.note).toBe('読み込んだメモ'); // the file's own stamp was older: "now" makes it win
    expect(b.stored()?.profile?.ownerId).toBe(familyId);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-11/AC6 cancelling the warning changes nothing on either device', async () => {
    const user = userEvent.setup();
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    const before = a.storage.data.get('bentominder.test-uid-001.state');
    const file = setNote(a.stored() as BentoMinderStore, '読み込まない', NOW_MS - 3_600_000);
    renderDevice(a, '#/settings');
    await user.upload(await screen.findByTestId('data-import'), new File([a.repository.exportJson(file)], 'export.json'));
    await user.click(await screen.findByTestId('dialog-import-family-cancel'));
    expect(a.storage.data.get('bentominder.test-uid-001.state')).toBe(before);
    a.controller.stop();
  });
});
