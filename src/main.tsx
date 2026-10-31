// Start-up: pick adapters, create the repository, mount the app. The debug panel is imported
// only in development; Vite replaces import.meta.env.DEV with false in production builds and
// drops the branch and its chunk (architecture §5, BR-24; proven by check:no-debug).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { selectAdapters } from './adapters/select.ts';
import { createRepository } from './domain/storage/repository.ts';
import { AppProvider } from './ui/app-store.tsx';
import { App } from './ui/App.tsx';
import 'virtual:display-font.css';
import './ui/styles/global.css';

const adapters = selectAdapters();
const repository = createRepository(adapters.storage, adapters.clock);
const services = { pdfSource: adapters.pdfSource, extractor: adapters.extractor, fileExport: adapters.fileExport, isOnline: adapters.isOnline, notifications: adapters.notifications };
const warn = import.meta.env.DEV ? (message: string) => console.warn(message) : undefined;

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('#root is missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppProvider repository={repository} clock={adapters.clock} newDeviceId={adapters.newDeviceId} services={services} {...(warn ? { warn } : {})}>
      <App />
    </AppProvider>
  </StrictMode>,
);

if (import.meta.env.DEV) {
  void import('./debug/mount.tsx').then(({ mountDebug }) => mountDebug());
}
