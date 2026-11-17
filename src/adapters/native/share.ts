// Share native adapter (US-E9-01/AC2, AC4): the OS share sheet through @capacitor/share, then the same fallback
// chain as the web adapter (clipboard). Only called from a tap.
import type { Share } from '../../domain/ports.ts';
import type { SharePlugin } from './plugins.ts';

export function createNativeShare(plugin: SharePlugin, nav: Pick<Navigator, 'clipboard'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): Share {
  const copy = async (text: string): Promise<boolean> => {
    try {
      if (nav?.clipboard === undefined) return false;
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };
  return {
    // The share sheet exists on every Android the app supports, so the button is shown; a failing sheet falls back.
    canShare: () => true,
    copy,
    async share(text) {
      try {
        if ((await plugin.canShare()).value) {
          await plugin.share({ text });
          return 'shared';
        }
      } catch {
        // rejected or dismissed: fall back to the clipboard (AC2)
      }
      return (await copy(text)) ? 'copied' : 'cancelled';
    },
  };
}
