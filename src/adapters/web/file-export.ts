// FileExport web adapter: a download link for the export file (US-E10-03/AC4).
import type { FileExport } from '../../domain/ports.ts';

export function createWebFileExport(): FileExport {
  return {
    save(filename, contents, mime) {
      const url = URL.createObjectURL(new Blob([contents], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return Promise.resolve();
    },
  };
}

/** US-E10-01/AC3: the import needs the network; everything else works offline. */
export function webIsOnline(): boolean {
  return navigator.onLine;
}
