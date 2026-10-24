// App state: React context + reducer around the domain store (ADR 001). The repository does
// validation and persistence; the reducer only holds what the screens render.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { Clock } from '../domain/ports.ts';
import type { BentoMinderStore } from '../domain/schema/store.ts';
import { createEmptyStore } from '../domain/storage/defaults.ts';
import type { LoadResult, Repository } from '../domain/storage/repository.ts';
import { toJstTimestamp, todayJst, type LocalDate } from '../domain/time/jst.ts';
import { createTranslator, type Language, type Translate } from '../i18n/index.ts';

export type AppState =
  | { phase: 'loading'; language: Language }
  | { phase: 'ready'; language: Language; store: BentoMinderStore; saveFailed: boolean }
  | { phase: 'too-new'; language: Language; version: number }
  | { phase: 'corrupt'; language: Language };

export type AppAction =
  | { type: 'loaded'; result: LoadResult; fresh: BentoMinderStore }
  | { type: 'store-changed'; store: BentoMinderStore }
  | { type: 'language-changed'; language: Language }
  | { type: 'save-result'; ok: boolean };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'loaded': {
      const r = action.result;
      if (r.kind === 'too-new') return { phase: 'too-new', language: state.language, version: r.version };
      if (r.kind === 'corrupt') return { phase: 'corrupt', language: state.language };
      const store = r.kind === 'empty' ? action.fresh : r.state;
      return { phase: 'ready', language: store.settings.language, store, saveFailed: false };
    }
    case 'store-changed':
      return state.phase === 'ready'
        ? { ...state, store: action.store, language: action.store.settings.language }
        : state;
    case 'language-changed':
      return { ...state, language: action.language };
    case 'save-result':
      return state.phase === 'ready' ? { ...state, saveFailed: !action.ok } : state;
  }
}

interface AppContextValue {
  state: AppState;
  t: Translate;
  today: LocalDate;
  setLanguage: (language: Language) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  repository: Repository;
  clock: Clock;
  newDeviceId: () => string;
  warn?: (message: string) => void;
  children: ReactNode;
}

export function AppProvider({ repository, clock, newDeviceId, warn, children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, { phase: 'loading', language: 'ja' });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((result) => {
      if (!cancelled) dispatch({ type: 'loaded', result, fresh: createEmptyStore({ deviceId: newDeviceId(), now: clock.now() }) });
    });
    return () => {
      cancelled = true;
    };
  }, [repository, clock, newDeviceId]);

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

  const t = useMemo(() => createTranslator(state.language, warn ? { warn } : {}), [state.language, warn]);
  const today = todayJst(clock.now());

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

  const theme = state.phase === 'ready' ? state.store.settings.theme : 'auto';
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ state, t, today, setLanguage }), [state, t, today, setLanguage]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === null) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
