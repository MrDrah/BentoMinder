// Share web adapter (US-E9-01/AC2, AC4): the Web Share API when present, else (or when it rejects) the
// clipboard. Only ever called from a tap; the text goes to the OS sheet or the clipboard and nowhere else.
import type { Share } from '../../domain/ports.ts';

export function createWebShare(nav: Pick<Navigator, 'share' | 'clipboard'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): Share {
  const canShare = () => typeof nav?.share === 'function';
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
    canShare,
    copy,
    async share(text) {
      if (canShare()) {
        try {
          await nav?.share({ text });
          return 'shared';
        } catch {
          // rejected or dismissed: fall back to the clipboard (AC2)
        }
      }
      return (await copy(text)) ? 'copied' : 'cancelled';
    },
  };
}
