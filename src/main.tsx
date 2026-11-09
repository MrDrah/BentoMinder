// Start-up: pick the sign-in adapter, render the sign-in shell. The shell opens an account (its own storage keys,
// adapters and reminders) after sign-in; nothing of the app runs signed out (ADR 014). The debug module (simulated
// clock, AI failure switches, panel) is loaded only in development; Vite replaces import.meta.env.DEV with false in
// production builds and drops every branch and chunk behind it (architecture §5, BR-24; proven by check:no-debug).
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { selectAdapters } from './adapters/select.ts';
import { selectAuth } from './adapters/select-auth.ts';
import type { AuthUser } from './domain/auth/types.ts';
import { adoptLegacyStore } from './domain/storage/adoption.ts';
import { createRepository } from './domain/storage/repository.ts';
import { AuthRoot, type AccountEnv } from './ui/auth/AuthRoot.tsx';
import 'virtual:display-font.css';
import './ui/styles/global.css';
import './ui/styles/processed.css';

/** One signed-in account: its storage keys (after the one-time adoption of the old unkeyed data), adapters and reminders. */
async function openAccount(_user: AuthUser, accountId: string | undefined): Promise<AccountEnv> {
  const adapters = selectAdapters(accountId);
  const dbg = import.meta.env.DEV ? await import('./debug/index.ts') : null;
  const clock = dbg ? dbg.wrapClock(adapters.clock) : adapters.clock;
  if (accountId !== undefined) {
    try {
      await adoptLegacyStore(adapters.storage, clock, accountId); // US-E13-04/AC1: before the first load
    } catch {
      // Storage unavailable: the app shows its own "cannot save" notice; the old data stays where it is.
    }
  }
  const repository = createRepository(adapters.storage, clock, accountId === undefined ? {} : { accountId });
  const services = {
    pdfSource: dbg ? dbg.wrapPdfSource(adapters.pdfSource) : adapters.pdfSource,
    extractor: dbg ? dbg.wrapExtractor(adapters.extractor) : adapters.extractor,
    fileExport: adapters.fileExport,
    share: adapters.share,
    isOnline: adapters.isOnline,
    notifications: adapters.notifications,
  };
  const DebugPanel = import.meta.env.DEV ? lazy(() => import('./debug/panel.tsx')) : null;
  return {
    repository,
    clock,
    newDeviceId: adapters.newDeviceId,
    services,
    ...(import.meta.env.DEV ? { warn: (message: string) => console.warn(message) } : {}),
    extra: DebugPanel && (
      <Suspense fallback={null}>
        <DebugPanel />
      </Suspense>
    ),
    cancelReminders: () => adapters.notifications.cancelAll(),
  };
}

async function boot(): Promise<void> {
  const rootElement = document.getElementById('root');
  if (rootElement === null) throw new Error('#root is missing from index.html');
  const { auth, accountOf } = await selectAuth();
  createRoot(rootElement).render(
    <StrictMode>
      <AuthRoot auth={auth} accountOf={accountOf} openAccount={openAccount} />
    </StrictMode>,
  );
}

void boot();
