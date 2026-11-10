// The two lazy chunks of slice D (components §16 "Lazy loading"): `family` (consent, create, invite, members, join,
// adoption, dialogs) and `sync-status` (status sheet, lost-edit list). Nothing here is fetched until a sharing control is
// used, and with sync off nothing renders these at all. Until a chunk arrives the trigger shows a spinner and a busy label.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useApp } from '../app-store.tsx';
import type { MessageKey } from '../../i18n/index.ts';

const familyChunk = () => import('./family/index.tsx');
const statusChunk = () => import('./status/index.tsx');

/** Starts loading the status sheet's chunk ahead of its first use, so the indicator still opens it offline (US-E15-06/AC4, AC6). */
export const prefetchStatusChunk = (): void => {
  void statusChunk().catch(() => undefined);
};

type FamilyModule = Awaited<ReturnType<typeof familyChunk>>;
type StatusModule = Awaited<ReturnType<typeof statusChunk>>;

const fromFamily = <K extends keyof FamilyModule>(name: K): FamilyModule[K] => lazy(() => familyChunk().then((m) => ({ default: m[name] as never }))) as unknown as FamilyModule[K];
const fromStatus = <K extends keyof StatusModule>(name: K): StatusModule[K] => lazy(() => statusChunk().then((m) => ({ default: m[name] as never }))) as unknown as StatusModule[K];

// Typed re-exports: each lazy component keeps the props of the real one.
export const LazySafetyRow = fromFamily('SafetyRow');
export const LazyFamilyMembers = fromFamily('FamilyMembers');
export const LazyCreateFamilyFlow = fromFamily('CreateFamilyFlow');
export const LazyUpgradeConsent = fromFamily('UpgradeConsent');
export const LazyJoinScreen = fromFamily('JoinScreen');
export const LazyAdoptionGate = fromFamily('AdoptionGate');
export const LazyImportFamilyDialog = fromFamily('ImportFamilyDialog');
export const LazyStatusSheet = fromStatus('StatusSheet');
export const LazyLostListDialog = fromStatus('LostListDialog');

export function Pending({ label = 'common.loading' }: { label?: MessageKey }) {
  const { t } = useApp();
  return (
    <p className="family-pending" role="status" aria-busy="true" data-testid="family-pending">
      <span className="auth-spinner" aria-hidden="true" />
      <span>{t(label)}</span>
    </p>
  );
}

class Boundary extends Component<{ children: ReactNode; failed: ReactNode }, { error: boolean }> {
  override state = { error: false };
  static getDerivedStateFromError(): { error: boolean } {
    return { error: true };
  }
  override render(): ReactNode {
    return this.state.error ? this.props.failed : this.props.children;
  }
}

/** Suspense + a failure line (`common.error.generic`) for a lazy chunk. `fallback` defaults to the busy line. */
export function ChunkBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { t } = useApp();
  return (
    <Boundary
      failed={
        <p className="field-error" role="alert" data-testid="chunk-error">
          {t('common.error.generic')}
        </p>
      }
    >
      <Suspense fallback={fallback ?? <Pending />}>{children}</Suspense>
    </Boundary>
  );
}
