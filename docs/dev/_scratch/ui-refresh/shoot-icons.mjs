import { chromium } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 560, height: 260 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(resolve('docs/dev/_scratch/ui-refresh/icons-test.html')).href);
await p.screenshot({ path: 'docs/dev/_scratch/ui-refresh/after-design/icons-test.png' }); await b.close();
