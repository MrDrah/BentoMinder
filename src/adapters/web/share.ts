// Share web adapter (Web Share API, else copy). M0 stub: reports "cancelled". Built in M4 (US-E9-01).
import type { Share } from '../../domain/ports.ts';

export function createWebShare(): Share {
  return { share: () => Promise.resolve('cancelled') };
}
