// Stable serialisation and a small synchronous hash for change detection (ADR 016 section 3, dirty.ts).
// Not a security hash: it only decides "did this record change since it was last synced".

/** JSON with object keys sorted at every depth, so equal content always gives equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

/** cyrb53 (53 bits) plus the length: the collision chance for a changed record is negligible for change detection. */
export function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${n.toString(36)}-${text.length.toString(36)}`;
}

/** A copy of the record without the given keys (no dynamic `delete`). */
export function without<V>(rec: Readonly<Record<string, V>>, keys: Iterable<string>): Record<string, V> {
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !drop.has(k)));
}

/** UTF-8 byte length without TextEncoder (keeps the domain free of platform globals). */
export function utf8Bytes(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}
