// FileExport native adapter (US-E10-03/AC4). A WebView does not honour `<a download>`, so the export file is written
// to the app's cache (Filesystem plugin) and handed to the OS share sheet as a file: the parent saves it to Files or
// Drive, or sends it to another app. Chosen over writing to Documents: no storage permission, and the parent decides
// where it goes.
import type { FileExport } from '../../domain/ports.ts';
import type { FilesystemPlugin, SharePlugin } from './plugins.ts';

export function createNativeFileExport(plugins: { filesystem: FilesystemPlugin; share: SharePlugin }): FileExport {
  return {
    async save(filename, contents) {
      const { uri } = await plugins.filesystem.writeFile({ path: filename, data: contents, directory: 'CACHE', encoding: 'utf8' });
      await plugins.share.share({ title: filename, dialogTitle: filename, files: [uri] });
    },
  };
}
