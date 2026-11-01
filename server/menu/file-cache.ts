// On-disk extraction cache (ADR 002 §2 layer 2), keyed by the PDF's SHA-256 only. An entry is the
// validated model reply plus meta (model, promptVersion, schemaVersion, time). Never stored: the
// API key, request headers, the PDF itself, or any child data. Entries from another prompt or
// schema version are ignored (a miss); a corrupt or oddly named file is a miss; writes are atomic
// (temp file then rename); the directory is capped by entry count and bytes, oldest first.
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../../src/domain/menu/extraction.ts';
import { memoryCache, type ExtractionCache } from './extract.ts';

export interface FileCacheOptions {
  dir: string;
  promptVersion?: number;
  schemaVersion?: number;
  maxEntries?: number;
  maxBytes?: number;
  nowMs?: () => number;
}

const SHA = /^[0-9a-f]{64}$/;

export function fileCache(options: FileCacheOptions): ExtractionCache {
  const { dir } = options;
  const promptVersion = options.promptVersion ?? PROMPT_VERSION;
  const schemaVersion = options.schemaVersion ?? EXTRACTION_SCHEMA_VERSION;
  const maxEntries = options.maxEntries ?? 200;
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  const nowMs = options.nowMs ?? Date.now;
  mkdirSync(dir, { recursive: true });
  const file = (sha: string) => join(dir, `${sha}.json`);

  const evict = () => {
    const entries = readdirSync(dir)
      .filter((n) => n.endsWith('.json') && SHA.test(n.slice(0, -5)))
      .map((n) => {
        try {
          const st = statSync(join(dir, n));
          return { n, size: st.size, at: st.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((e): e is { n: string; size: number; at: number } => e !== null)
      .sort((a, b) => a.at - b.at || a.n.localeCompare(b.n));
    let total = entries.reduce((s, e) => s + e.size, 0);
    let count = entries.length;
    for (const e of entries) {
      if (count <= maxEntries && total <= maxBytes) break;
      rmSync(join(dir, e.n), { force: true });
      count -= 1;
      total -= e.size;
    }
  };

  return {
    get(sha256) {
      if (!SHA.test(sha256)) return undefined;
      try {
        const v: unknown = JSON.parse(readFileSync(file(sha256), 'utf8'));
        if (typeof v !== 'object' || v === null) return undefined;
        const e = v as Record<string, unknown>;
        if (e['promptVersion'] !== promptVersion || e['schemaVersion'] !== schemaVersion) return undefined;
        if (typeof e['text'] !== 'string' || typeof e['model'] !== 'string') return undefined;
        return { text: e['text'], model: e['model'] };
      } catch {
        return undefined;
      }
    },
    set(sha256, entry) {
      if (!SHA.test(sha256)) return;
      const tmp = join(dir, `${sha256}.${process.pid}.tmp`);
      try {
        const body = JSON.stringify({ text: entry.text, model: entry.model, promptVersion, schemaVersion, storedAt: nowMs() });
        writeFileSync(tmp, body, 'utf8');
        renameSync(tmp, file(sha256));
        utimesSync(file(sha256), nowMs() / 1000, nowMs() / 1000);
        evict();
      } catch {
        rmSync(tmp, { force: true });
      }
    },
  };
}

/** The proxy's cache: on disk when `dir` is writable, otherwise in memory. */
export function defaultCache(dir: string, log?: (message: string) => void): ExtractionCache {
  try {
    return fileCache({ dir });
  } catch {
    log?.('cache directory is not writable; using the in-memory cache');
    return memoryCache();
  }
}
