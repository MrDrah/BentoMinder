// Dev-only debug panel (architecture §5, design/components.md §13). M0: the corner 「Debug」
// button and an empty panel. M4 adds the fake clock, reminder triggers, samples and data tools.
// Strings come from the dev-only `debug` catalog below, never from the shipped catalogs.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEBUG_MARKER, DEBUG_PANEL_MARKER } from './marker.ts';

const debugCatalog = {
  ja: { 'debug.open': 'Debug', 'debug.title': 'デバッグパネル（開発用）', 'common.close': '閉じる' },
  en: { 'debug.open': 'Debug', 'debug.title': 'Debug panel (development)', 'common.close': 'Close' },
} as const;

function DebugPanel() {
  const [open, setOpen] = useState(false);
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ja';
  const c = debugCatalog[lang];
  return (
    <div data-debug={DEBUG_MARKER}>
      <button type="button" className="debug-open" data-testid="debug-open" onClick={() => setOpen((v) => !v)}>
        {c['debug.open']}
      </button>
      {open && (
        <aside className="debug-panel" data-testid="debug-panel" data-marker={DEBUG_PANEL_MARKER} aria-label={c['debug.title']}>
          <h2>{c['debug.title']}</h2>
          <button type="button" onClick={() => setOpen(false)}>
            {c['common.close']}
          </button>
        </aside>
      )}
    </div>
  );
}

const STYLE = `
.debug-open{position:fixed;left:8px;bottom:8px;z-index:var(--z-debug);min-height:44px;padding:0 12px;
  border:0;border-radius:999px;background:var(--debug-accent);color:var(--debug-surface);font-family:var(--font-mono)}
.debug-panel{position:fixed;top:0;right:0;bottom:0;width:min(360px,100vw);z-index:var(--z-debug);padding:16px;
  background:var(--debug-surface);color:var(--debug-ink);font-family:var(--font-mono);
  border-top:8px solid transparent;border-image:var(--debug-hatch) 8}
`;

export function mountDebug(): void {
  const host = document.createElement('div');
  host.id = 'bentominder-debug';
  document.body.appendChild(host);
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  createRoot(host).render(<DebugPanel />);
}
