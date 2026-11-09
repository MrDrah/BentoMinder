// ADR 014: rewriting `ownerId` in a raw store document (adoption of the legacy store, import into an account).
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A copy of the document in which every `ownerId` string, at any depth, is `uid`. Nothing else changes. */
export function rewriteOwnerId<T>(doc: T, uid: string): T {
  if (Array.isArray(doc)) return doc.map((v) => rewriteOwnerId(v, uid)) as T;
  if (!isRecord(doc)) return doc;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) out[k] = k === 'ownerId' && typeof v === 'string' ? uid : rewriteOwnerId(v, uid);
  return out as T;
}
