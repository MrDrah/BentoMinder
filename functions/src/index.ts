// Hosted AI proxy entry (ADR 015): one 2nd gen HTTPS function in Tokyo. This and the two small SDK
// seams below are the only files that name a Google SDK. Deploy is run by the product owner (ADR 015 §7).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import type { ProxyDeps } from '../../server/core/handle.ts';
import { nodeRequester, nodeResolver } from '../../server/menu/node-net.ts';
import { createAdminVerifier, type AuthLike } from './admin-verifier.ts';
import { createFirestoreStore, type DbLike } from './firestore-limits.ts';
import { createApiHandler, type FnRequest, type FnResponse } from './adapter.ts';
import { buildHostedDeps, DEFAULT_ORIGINS } from './hosted-deps.ts';

declare const __APP_VERSION__: string | undefined;

// Secrets (Secret Manager): never in git, never in functions/.env.*.
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ALLOWED_ACCOUNTS = defineSecret('ALLOWED_ACCOUNTS');
// Non-secret settings: functions/.env.<projectId> (git-ignored; names in functions/.env.example). Defaults are the contract values.
const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: DEFAULT_ORIGINS });
const EXTRACT_PER_HOUR = defineInt('EXTRACT_PER_HOUR', { default: 5 });
const EXTRACT_PER_DAY = defineInt('EXTRACT_PER_DAY', { default: 20 });
const FETCH_PER_HOUR = defineInt('FETCH_PER_HOUR', { default: 30 });
const FETCH_PER_DAY = defineInt('FETCH_PER_DAY', { default: 100 });

let deps: ProxyDeps | undefined;

function projectFromFirebaseConfig(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  try {
    const id = (JSON.parse(raw) as { projectId?: unknown }).projectId;
    return typeof id === 'string' && id !== '' ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Built on the first request of an instance (secrets are readable only at run time), then reused. */
function getDeps(): ProxyDeps {
  if (deps !== undefined) return deps;
  // The runtime sets one of these; try all so a missing one cannot refuse every token (E14-D02).
  const projectId = process.env['GCLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT'] || projectFromFirebaseConfig(process.env['FIREBASE_CONFIG']);
  // No credentials file: verification needs only Google's public certificates; Firestore uses the runtime identity.
  const app = getApps()[0] ?? (projectId === undefined || projectId === '' ? initializeApp() : initializeApp({ projectId }));
  deps = buildHostedDeps(
    {
      version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
      geminiKey: GEMINI_API_KEY.value(),
      allowedAccounts: ALLOWED_ACCOUNTS.value(),
      allowedOrigins: ALLOWED_ORIGINS.value(),
      limits: { extractPerHour: EXTRACT_PER_HOUR.value(), extractPerDay: EXTRACT_PER_DAY.value(), fetchPerHour: FETCH_PER_HOUR.value(), fetchPerDay: FETCH_PER_DAY.value() },
    },
    {
      verifier: createAdminVerifier(getAuth(app) as AuthLike, projectId),
      store: createFirestoreStore(getFirestore(app) as unknown as DbLike),
      resolve: nodeResolver,
      request: nodeRequester,
      fetch: globalThis.fetch,
      nowMs: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      log: (m) => console.log(m),
    },
  );
  return deps;
}

const run = createApiHandler(getDeps);

export const api = onRequest(
  {
    region: 'asia-northeast1',
    invoker: 'public', // the app authenticates; the function refuses unsigned callers cheaply
    maxInstances: 3,
    memory: '512MiB',
    timeoutSeconds: 120,
    secrets: [GEMINI_API_KEY, ALLOWED_ACCOUNTS],
  },
  (req, res) => run(req as unknown as FnRequest, res as unknown as FnResponse),
);
