// UI refresh 2026-11, slice 1 (design/components.md §17): brand about disclosure, home order, legend closed,
// sticky action bars. Stories touched visually only: US-NF-02 (target size, keyboard), US-E2-08 (consent link),
// US-E5-01 (grid), US-E8-01 (ja/en).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { App } from '../../../src/ui/App.tsx';
import { AppProvider } from '../../../src/ui/app-store.tsx';
import { storeV1 } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-14T15:30:00Z');

async function renderCalendar(language?: 'en') {
  window.location.hash = '';
  const storage = memoryStorage({ 'bentominder.state': JSON.stringify(storeV1()) });
  render(
    <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d'}>
      <App />
    </AppProvider>,
  );
  await screen.findByTestId('screen-calendar');
  if (language === 'en') await userEvent.click(screen.getByTestId('lang-toggle-en'));
}

describe('about disclosure (US-NF-02/AC1, US-E2-08)', () => {
  it('US-NF-02/AC1 is closed on load and the toggle names the panel with aria-expanded and aria-controls', async () => {
    await renderCalendar();
    const toggle = screen.getByTestId('about-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName(ja['about.open']);
    expect(screen.getByTestId('about-panel')).not.toBeVisible();
    expect(toggle.getAttribute('aria-controls')).toBe(screen.getByTestId('about-panel').id);
  });

  it('US-NF-02/AC1 opens with the four about copy strings in Japanese and closes with the button, keeping focus on the toggle', async () => {
    await renderCalendar();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('about-toggle'));
    const panel = screen.getByTestId('about-panel');
    expect(panel).toBeVisible();
    expect(screen.getByTestId('about-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel).getByText(ja['about.body.1'])).toBeInTheDocument();
    expect(within(panel).getByText(ja['about.body.2'])).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: ja['app.tagline'] })).toBeInTheDocument();
    expect(screen.getByTestId('about-close')).toHaveAccessibleName(ja['about.close']);
    await user.click(screen.getByTestId('about-close'));
    expect(screen.getByTestId('about-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('about-toggle')).toHaveFocus();
  });

  it('US-NF-02/AC1 Escape closes the panel and returns focus to the toggle', async () => {
    await renderCalendar();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('about-toggle'));
    await user.tab();
    expect(screen.getByTestId('about-toggle')).not.toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('about-panel')).not.toBeVisible();
    expect(screen.getByTestId('about-toggle')).toHaveFocus();
  });

  it('US-E8-01/AC1 shows the English copy after the language switch', async () => {
    await renderCalendar('en');
    const user = userEvent.setup();
    expect(screen.getByTestId('about-toggle')).toHaveAccessibleName(en['about.open']);
    await user.click(screen.getByTestId('about-toggle'));
    const panel = screen.getByTestId('about-panel');
    expect(within(panel).getByText(en['about.body.1'])).toBeInTheDocument();
    expect(within(panel).getByText(en['about.body.2'])).toBeInTheDocument();
    expect(screen.getByTestId('about-close')).toHaveAccessibleName(en['about.close']);
  });

  it('US-E2-08/AC1 the consent link opens the read-only consent dialog', async () => {
    await renderCalendar();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('about-toggle'));
    await user.click(screen.getByTestId('about-consent'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('home order and legend (US-E5-01, UI refresh §17.4, §17.5)', () => {
  it('US-E5-01/AC1 the month grid comes before the Today card and the tools row', async () => {
    await renderCalendar();
    const grid = screen.getByTestId('cal-grid');
    const today = screen.getByTestId('today-card');
    const tools = screen.getByTestId('legend-toggle');
    expect(grid.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(today.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('cal-title').compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('US-E5-01/AC1 the legend starts closed and the toggle opens it; share sits in the same tools row', async () => {
    await renderCalendar();
    const toggle = screen.getByTestId('legend-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.parentElement).toContainElement(screen.getByTestId('share-button'));
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('sticky action bar (UI refresh §17.6)', () => {
  it('US-E1-01/AC1 the import screen puts the primary button in an action bar', async () => {
    window.location.hash = '#/import';
    const storage = memoryStorage({ 'bentominder.state': JSON.stringify(storeV1()) });
    render(
      <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d'}>
        <App />
      </AppProvider>,
    );
    const submit = await screen.findByTestId('import-submit');
    expect(submit.closest('.action-bar')).not.toBeNull();
  });
});
