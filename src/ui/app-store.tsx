// App state: React context + reducer around the domain store (ADR 001). The repository does
// validation and persistence; the reducer only holds what the screens render. `commit` writes
// first and updates the screen only when the write succeeded, so a failed write never shows a
// "saved" state (US-E10-02/AC5–AC6).
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createWebExtractor } from '../adapters/web/extractor.ts';
import { createWebFileExport, webIsOnline } from '../adapters/web/file-export.ts';
import { createWebShare } from '../adapters/web/share.ts';
import { createWebNotifications, type WebNotifications } from '../adapters/web/notifications.ts';
import { createWebPdfSource } from '../adapters/web/pdf-source.ts';
import type { Clock, FileExport, MenuExtractor, PdfSource, Share } from '../domain/ports.ts';
import type { Dictionary } from '../domain/schema/dictionary.ts';
import type { Recipe } from '../domain/schema/recipe.ts';
import type { BentoMinderStore } from '../domain/schema/store.ts';
import { createEmptyStore } from '../domain/storage/defaults.ts';
import { StoreConflictError, type LoadResult, type Repository } from '../domain/storage/repository.ts';
import { toJstTimestamp, todayJst, type Instant, type LocalDate } from '../domain/time/jst.ts';
import { createTranslator, type Language, type Translate } from '../i18n/index.ts';
import { shippedDictionary } from './dictionary.ts';
import { shippedLibrary } from './library.ts';
import { setProfileDraft } from './session.ts';

export type AppState =
  | { phase: 'loading'; language: Language }
  | { phase: 'ready'; language: Language; store: BentoMinderStore; persisted: boolean; saveFailed: boolean }
  | { phase: 'too-new'; language: Language; version: number; raw: string }
  | { phase: 'corrupt'; language: Language; raw: string };

export type AppAction =
  | { type: 'loaded'; result: LoadResult; fresh: BentoMinderStore }
  | { type: 'store-changed'; store: BentoMinderStore; persisted?: boolean }
  | { type: 'reset'; store: BentoMinderStore }
  | { type: 'language-changed'; language: Language }
  | { type: 'save-result'; ok: boolean };

type SaveOutcome = 'saved' | 'failed' | 'conflict';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'loaded': {
      const r = action.result;
      if (r.kind === 'too-new') return { phase: 'too-new', language: state.language, version: r.version, raw: r.raw };
      if (r.kind === 'corrupt') return { phase: 'corrupt', language: state.language, raw: r.raw };
      const store = r.kind === 'empty' ? action.fresh : r.state;
      return { phase: 'ready', language: store.settings.language, store, persisted: r.kind !== 'empty', saveFailed: false };
    }
    case 'store-changed':
      return state.phase === 'ready'
        ? {
            ...state,
            store: action.store,
            language: action.store.settings.language,
            ...(action.persisted === true ? { persisted: true, saveFailed: false } : {}),
          }
        : state;
    case 'reset':
      return { phase: 'ready', language: action.store.settings.language, store: action.store, persisted: false, saveFailed: false };
    case 'language-changed':
      return { ...state, language: action.language };
    case 'save-result':
      return state.phase === 'ready' ? { ...state, saveFailed: !action.ok, ...(action.ok ? { persisted: true } : {}) } : state;
  }
}

export interface AppServices {
  pdfSource: PdfSource;
  extractor: MenuExtractor;
  fileExport: FileExport;
  share: Share;
  notifications: WebNotifications;
  isOnline: () => boolean;
  dictionary: Dictionary;
  library: readonly Recipe[];
}

/** One-shot notes passed from the import screen to the review screen (in memory only). */
export interface Flash {
  sameFile?: boolean;
}

interface AppContextValue {
  state: AppState;
  t: Translate;
  today: LocalDate;
  now: () => Instant;
  services: AppServices;
  repository: Repository;
  setLanguage: (language: Language) => void;
  /** Validates and writes; true when stored. The screen updates only on success. */
  commit: (store: BentoMinderStore) => Promise<boolean>;
  /** The toast for a commit that returned false: names the other tab when that was the cause. */
  showSaveFailed: () => void;
  /** True after this tab reloaded because another tab saved (ADR 003 change log 2026-10-25). */
  updatedElsewhere: boolean;
  dismissUpdatedElsewhere: () => void;
  /** US-E10-04/AC1, US-E10-02/AC7: removes every app key and starts over in Japanese. */
  startOver: () => Promise<void>;
  /** US-E10-03/AC3: replaces the stored data with an imported store. */
  replaceStore: (store: BentoMinderStore) => Promise<boolean>;
  toast: string | null;
  showToast: (text: string) => void;
  flash: Flash;
  setFlash: (flash: Flash) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  repository: Repository;
  clock: Clock;
  newDeviceId: () => string;
  services?: Partial<AppServices>;
  warn?: (message: string) => void;
  children: ReactNode;
}

const TOAST_MS = 4000;

export function AppProvider({ repository, clock, newDeviceId, services: given, warn, children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, { phase: 'loading', language: 'ja' });
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>({});
  const [updatedElsewhere, setUpdatedElsewhere] = useState(false);
  const lastOutcome = useRef<SaveOutcome>('saved');
  const stateRef = useRef(state);
  stateRef.current = state;
  const [fallbackNotifications] = useState(() => createWebNotifications());
  const services = useMemo<AppServices>(
    () => ({
      pdfSource: given?.pdfSource ?? createWebPdfSource(),
      extractor: given?.extractor ?? createWebExtractor(),
      fileExport: given?.fileExport ?? createWebFileExport(),
      share: given?.share ?? createWebShare(),
      notifications: given?.notifications ?? fallbackNotifications,
      isOnline: given?.isOnline ?? webIsOnline,
      dictionary: given?.dictionary ?? shippedDictionary,
      library: given?.library ?? shippedLibrary,
    }),
    [given, fallbackNotifications],
  );

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((result) => {
      if (!cancelled) dispatch({ type: 'loaded', result, fresh: createEmptyStore({ deviceId: newDeviceId(), now: clock.now() }) });
    });
    return () => {
      cancelled = true;
    };
  }, [repository, clock, newDeviceId]);

  // Another tab saved: drop the in-memory copy and read what is stored, so this tab never
  // writes from a stale copy (ADR 003 change log 2026-10-25, D-M1-06).
  const reloadFromStorage = useCallback(async () => {
    const result = await repository.load();
    dispatch({ type: 'loaded', result, fresh: createEmptyStore({ deviceId: newDeviceId(), now: clock.now() }) });
    setUpdatedElsewhere(true);
  }, [repository, clock, newDeviceId]);

  useEffect(() => repository.onExternalChange(() => void reloadFromStorage()), [repository, reloadFromStorage]);

  const setLanguage = useCallback(
    (language: Language) => {
      const current = stateRef.current;
      if (current.phase !== 'ready') {
        // Recovery screens write nothing (US-E10-02/AC3, AC4); the switch is in memory only.
        dispatch({ type: 'language-changed', language });
        return;
      }
      const ts = toJstTimestamp(clock.now());
      const store: BentoMinderStore = {
        ...current.store,
        updatedAt: ts,
        settings: { ...current.store.settings, language, updatedAt: ts },
      };
      dispatch({ type: 'store-changed', store });
      repository.save(store).then(
        () => dispatch({ type: 'save-result', ok: true }),
        () => dispatch({ type: 'save-result', ok: false }),
      );
    },
    [repository, clock],
  );

  const commit = useCallback(
    async (store: BentoMinderStore) => {
      try {
        await repository.save(store);
      } catch (err) {
        if (err instanceof StoreConflictError) {
          // Nothing was written. Show what the other tab saved instead of this tab's copy.
          lastOutcome.current = 'conflict';
          await reloadFromStorage();
          return false;
        }
        lastOutcome.current = 'failed';
        dispatch({ type: 'save-result', ok: false });
        return false;
      }
      lastOutcome.current = 'saved';
      dispatch({ type: 'store-changed', store, persisted: true });
      return true;
    },
    [repository, reloadFromStorage],
  );

  const startOver = useCallback(async () => {
    await repository.deleteAll();
    setProfileDraft(null); // typed-but-unsaved step-1 answers go too (BR-22: nothing of the family's stays)
    dispatch({ type: 'reset', store: createEmptyStore({ deviceId: newDeviceId(), now: clock.now() }) });
  }, [repository, newDeviceId, clock]);

  const replaceStore = useCallback(
    async (store: BentoMinderStore) => {
      try {
        await repository.save(store, { force: true });
      } catch {
        dispatch({ type: 'save-result', ok: false });
        return false;
      }
      dispatch({ type: 'reset', store });
      dispatch({ type: 'save-result', ok: true });
      return true;
    },
    [repository],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const t = useMemo(() => createTranslator(state.language, warn ? { warn } : {}), [state.language, warn]);
  const now = useCallback(() => clock.now(), [clock]);
  // US-E7-03/AC3: the Tokyo date is re-read every minute and when the tab becomes visible again, so the
  // calendar and the today card roll over at Tokyo midnight without a reload.
  const [today, setToday] = useState<LocalDate>(() => todayJst(clock.now()));
  useEffect(() => {
    const sync = () => setToday(todayJst(clock.now()));
    sync();
    const id = setInterval(sync, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, [clock]);

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

  const theme = state.phase === 'ready' ? state.store.settings.theme : 'auto';
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showSaveFailed = useCallback(() => {
    showToast(t(lastOutcome.current === 'conflict' ? 'toast.updatedElsewhere' : 'toast.saveFailed'));
  }, [showToast, t]);
  const dismissUpdatedElsewhere = useCallback(() => setUpdatedElsewhere(false), []);

  const value = useMemo(
    () => ({ state, t, today, now, services, repository, setLanguage, commit, showSaveFailed, updatedElsewhere, dismissUpdatedElsewhere, startOver, replaceStore, toast, showToast, flash, setFlash }),
    [state, t, today, now, services, repository, setLanguage, commit, showSaveFailed, updatedElsewhere, dismissUpdatedElsewhere, startOver, replaceStore, toast, showToast, flash],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === null) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

/** The ready store; screens that need it render only in the ready phase. */
export function useStore(): BentoMinderStore {
  const { state } = useApp();
  if (state.phase !== 'ready') throw new Error('store not ready');
  return state.store;
}
