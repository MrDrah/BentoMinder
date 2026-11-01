// Start-up: pick adapters, create the repository, mount the app. The debug module (simulated clock, AI failure
// switches, panel) is loaded only in development; Vite replaces import.meta.env.DEV with false in production
// builds and drops every branch and chunk behind it (architecture §5, BR-24; proven by check:no-debug).
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { selectAdapters } from './adapters/select.ts';
import { createRepository } from './domain/storage/repository.ts';
import { AppProvider } from './ui/app-store.tsx';
import { App } from './ui/App.tsx';
import 'virtual:display-font.css';
import './ui/styles/global.css';
import './ui/styles/processed.css';

async function boot(): Promise<void> {
  const adapters = selectAdapters();
  const dbg = import.meta.env.DEV ? await import('./debug/index.ts') : null;
  const clock = dbg ? dbg.wrapClock(adapters.clock) : adapters.clock;
  const repository = createRepository(adapters.storage, clock);
  const services = {
    pdfSource: dbg ? dbg.wrapPdfSource(adapters.pdfSource) : adapters.pdfSource,
    extractor: dbg ? dbg.wrapExtractor(adapters.extractor) : adapters.extractor,
    fileExport: adapters.fileExport,
    share: adapters.share,
    isOnline: adapters.isOnline,
    notifications: adapters.notifications,
  };
  const warn = import.meta.env.DEV ? (message: string) => console.warn(message) : undefined;
  const DebugPanel = import.meta.env.DEV ? lazy(() => import('./debug/panel.tsx')) : null;

  const rootElement = document.getElementById('root');
  if (rootElement === null) throw new Error('#root is missing from index.html');

  createRoot(rootElement).render(
    <StrictMode>
      <AppProvider repository={repository} clock={clock} newDeviceId={adapters.newDeviceId} services={services} {...(warn ? { warn } : {})}>
        <App />
        {DebugPanel && (
          <Suspense fallback={null}>
            <DebugPanel />
          </Suspense>
        )}
      </AppProvider>
    </StrictMode>,
  );
}

void boot();
