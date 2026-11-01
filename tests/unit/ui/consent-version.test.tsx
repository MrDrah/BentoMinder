// US-E2-08/AC3: the stored consent carries its notice version; a newer notice asks again.
// The notice version is a constant (1), so this file runs the import screen as if the notice were version 2.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeExtractor, profileOnly, renderApp } from '../helpers/app.tsx';

vi.mock('../../../src/domain/menu/store-ops.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/domain/menu/store-ops.ts')>();
  return {
    ...real,
    needsConsent: (store: Parameters<typeof real.needsConsent>[0]) => real.needsConsent(store, 2),
    giveConsent: (store: Parameters<typeof real.giveConsent>[0], now: Parameters<typeof real.giveConsent>[1]) => real.giveConsent(store, now, 2),
  };
});

describe('US-E2-08/AC3 notice version change', () => {
  it('US-E2-08/AC3 consent stored for version 1 is asked again for notice version 2, then stored as 2 and not asked again', async () => {
    const user = userEvent.setup();
    const store = { ...profileOnly(), consent: { aiNoticeVersion: 1, consentedAt: '2026-11-01T10:00:00+09:00' } };
    const app = await renderApp({ store, services: { extractor: fakeExtractor() } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    await screen.findByTestId('consent-dialog');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('consent-accept'));
    expect(await screen.findByTestId('screen-review')).toBeInTheDocument();
    expect(app.services.extractor.extract).toHaveBeenCalledTimes(1);
    expect(app.stored().consent?.aiNoticeVersion).toBe(2);
  });
});
