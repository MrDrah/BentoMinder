// Dev-only debug panel (architecture §5, design/components.md §13). Rendered inside the app's providers by
// main.tsx in development only, so it can read the store, the clock and the services. Strings come from the
// dev-only catalog, never from the shipped catalogs.
import { useEffect, useReducer, useState } from 'react';
import sampleMenuFixture from '../../tests/fixtures/menus/fixture-menu-2026-11/recorded/hand-1.json';
import sampleState from '../../tests/fixtures/state/v1.json';
import { planRemindersForStore } from '../domain/calendar/reminder-days.ts';
import { parseModelReply } from '../domain/menu/extraction.ts';
import { recordExtraction } from '../domain/menu/store-ops.ts';
import type { ReminderJob } from '../domain/ports.ts';
import type { BentoMinderStore } from '../domain/schema/index.ts';
import { jstWallToInstant, monthOf, todayJst, toJstTimestamp, wallTimeJst, type Instant, type LocalDate, type YearMonth } from '../domain/time/jst.ts';
import { useApp, useStore } from '../ui/app-store.tsx';
import { useDayViewer } from '../ui/calendar/use-day-viewer.ts';
import { Dialog } from '../ui/components/Controls.tsx';
import { ReminderBanner } from '../ui/reminders/ReminderList.tsx';
import { navigate } from '../ui/router.ts';
import { debugCatalog, type DebugKey } from './catalog.ts';
import { DEBUG_MARKER, DEBUG_PANEL_MARKER } from './marker.ts';
import { AI_MODES, emit, realNow, sim, subscribe, type AiMode } from './sim.ts';

const STYLE = `
.debug-open{position:fixed;left:8px;bottom:8px;z-index:var(--z-debug);min-height:44px;padding:0 12px;
  border:0;border-radius:999px;background:var(--debug-accent);color:var(--debug-surface);font-family:var(--font-mono)}
.debug-panel{position:fixed;top:0;right:0;bottom:0;width:min(360px,100vw);z-index:var(--z-debug);padding:16px;overflow:auto;
  background:var(--debug-surface);color:var(--debug-ink);font-family:var(--font-mono);font-size:14px;
  border-top:8px solid transparent;border-image:var(--debug-hatch) 8}
.debug-panel h2,.debug-panel h3{margin:12px 0 6px;font-size:15px}
.debug-panel button,.debug-panel input,.debug-panel select{min-height:44px;margin:2px;padding:0 8px;border:2px solid var(--debug-accent);
  border-radius:0;background:var(--debug-surface);color:var(--debug-ink);font:inherit}
.debug-panel button:hover{background:var(--debug-accent);color:var(--debug-surface)}
.debug-panel :focus-visible{outline:2px solid var(--debug-accent);outline-offset:2px}
.debug-panel button:disabled{border-style:dashed}
.debug-panel table{border-collapse:collapse;width:100%}
.debug-panel td,.debug-panel th{border:1px solid var(--debug-accent);padding:2px 4px;text-align:left;font-weight:400}
.debug-badge{border:2px solid var(--debug-accent);padding:0 6px;margin-left:6px}
`;

const sampleExtraction = () => {
  const out = parseModelReply(JSON.stringify(sampleMenuFixture.response.modelOutput), {
    targetMonth: '2026-11' as YearMonth,
    sha256: 'f'.repeat(64),
    byteSize: 16,
    model: 'sample-fixture',
    promptVersion: 1,
    at: '2026-11-15T00:30:00+09:00',
  });
  if (out.kind !== 'ok') throw new Error(`sample menu: ${out.kind}`);
  return out.menu;
};
sim.sampleMenu = sampleExtraction;

/** A browser-local 'YYYY-MM-DDTHH:mm' value read as Japan time. */
function parseInput(value: string): Instant | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (m === null) return null;
  const at = jstWallToInstant(m[1] as LocalDate, m[2] as string);
  return Number.isNaN(at) ? null : at;
}
const nudge = () => window.dispatchEvent(new Event('focus')); // the app re-reads the Tokyo date and re-plans on focus

function PanelBody() {
  const { state, now, commit, startOver, services } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const lang = state.language;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribe(rerender), []);
  const t = (key: DebugKey, params: Record<string, string | number> = {}): string =>
    Object.entries(params).reduce((s: string, [k, v]) => s.replace(`{${k}}`, String(v)), debugCatalog[lang][key]);

  const current = now();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [triggered, setTriggered] = useState<ReminderJob[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const nowText = toJstTimestamp(current).slice(0, 16).replace('T', ' ');

  const setOffset = (offset: number | null) => {
    sim.offset = offset;
    emit();
    nudge();
  };
  const advance = (ms: number) => setOffset((sim.offset ?? 0) + ms);

  const trigger = (type: ReminderJob['type'] | 'all') => {
    const r = store.settings.reminders;
    const forced: BentoMinderStore = { ...store, reminderLog: [], settings: { ...store.settings, reminders: { ...r, weekly: { ...r.weekly, enabled: true }, dayBefore: { ...r.dayBefore, enabled: true } } } };
    const { jobs } = planRemindersForStore(forced, viewer, current, [], {
      recipeExists: (id) => services.library.some((x) => x.id === id),
      recipeAllergenIds: (id) => services.library.find((x) => x.id === id)?.allergenIds ?? [],
    });
    const pick = (k: ReminderJob['type']) => jobs.find((j) => j.type === k);
    setTriggered((type === 'all' ? [pick('day-before'), pick('weekly')] : [pick(type)]).filter((j): j is ReminderJob => j !== undefined));
  };

  const loadProfile = async () => {
    await commit({ ...store, profile: sampleState.profile as unknown as BentoMinderStore['profile'], updatedAt: toJstTimestamp(current) });
  };
  const loadMenu = async () => {
    if (await commit(recordExtraction(store, sampleExtraction(), current))) navigate({ name: 'review', month: '2026-11' as YearMonth, manual: false });
  };

  const usage = store.aiUsage[monthOf(todayJst(current))] ?? 0;
  const decisions = Object.values(store.decisions);
  const overrides = Object.entries(store.overrides);

  return (
    <>
      <h3>{t('debug.clock')}</h3>
      <p data-testid="debug-clock-status">
        {t('debug.clock.now', { datetime: nowText })}
        {sim.offset !== null && (
          <span className="debug-badge" data-testid="debug-clock-simulated">
            {t('debug.clock.simulated')}
          </span>
        )}
      </p>
      <input type="datetime-local" data-testid="debug-clock-input" aria-label={t('debug.clock')} value={input} onChange={(e) => setInput(e.target.value)} />
      <button
        type="button"
        data-testid="debug-clock-set"
        onClick={() => {
          const at = parseInput(input);
          setInvalid(at === null);
          if (at !== null) setOffset(at - realNow());
        }}
      >
        {t('debug.clock.set')}
      </button>
      {invalid && <p data-testid="debug-clock-invalid">! {input === '' ? 'datetime?' : input}</p>}
      <div>
        <button type="button" data-testid="debug-clock-plus-minute" onClick={() => advance(60_000)}>
          {t('debug.clock.plus1m')}
        </button>
        <button type="button" data-testid="debug-clock-plus-hour" onClick={() => advance(3_600_000)}>
          {t('debug.clock.plus1h')}
        </button>
        <button type="button" data-testid="debug-clock-plus-day" onClick={() => advance(86_400_000)}>
          {t('debug.clock.plus1d')}
        </button>
        <button type="button" data-testid="debug-clock-real" onClick={() => setOffset(null)}>
          {t('debug.clock.real')}
        </button>
      </div>

      <h3>{t('debug.reminders')}</h3>
      <div>
        <button type="button" data-testid="debug-trigger-weekly" onClick={() => trigger('weekly')}>
          {t('debug.reminders.weekly')}
        </button>
        <button type="button" data-testid="debug-trigger-day-before" onClick={() => trigger('day-before')}>
          {t('debug.reminders.dayBefore')}
        </button>
        <button type="button" data-testid="debug-force" onClick={() => trigger('all')}>
          {t('debug.reminders.force')}
        </button>
      </div>
      {triggered !== null &&
        (triggered.length === 0 ? (
          <p data-testid="debug-triggered-empty">{t('debug.data.empty')}</p>
        ) : (
          triggered.map((job) => (
            <div key={job.key} data-testid="debug-triggered" data-debug-key={job.key}>
              <span className="debug-badge">{t('debug.reminders.debugTag')}</span>
              <ReminderBanner r={{ job, labelAt: job.dueAt, late: false }} onDismiss={() => setTriggered((all) => (all ?? []).filter((j) => j.key !== job.key))} />
              <p>
                {job.key} {wallTimeJst(job.dueAt)}
              </p>
            </div>
          ))
        ))}

      <h3>{t('debug.samples')}</h3>
      <div>
        <button type="button" data-testid="debug-sample-profile" onClick={() => void loadProfile()}>
          {t('debug.samples.profile')}
        </button>
        <button type="button" data-testid="debug-sample-menu" onClick={() => void loadMenu()}>
          {t('debug.samples.menu')}
        </button>
      </div>

      <h3>
        <label htmlFor="debug-ai-mode">{t('debug.ai')}</label>
      </h3>
      <select
        id="debug-ai-mode"
        data-testid="debug-ai-mode"
        value={sim.aiMode}
        onChange={(e) => {
          sim.aiMode = e.target.value as AiMode;
          emit();
        }}
      >
        <option value="off">{t('debug.ai.off')}</option>
        {AI_MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <p data-testid="debug-ai-usage">{t('debug.ai.usage', { n: usage })}</p>

      <h3>{t('debug.data')}</h3>
      <table data-testid="debug-decisions">
        <caption>{t('debug.data.decisions')}</caption>
        <tbody>
          {decisions.length === 0 ? (
            <tr>
              <td>{t('debug.data.empty')}</td>
            </tr>
          ) : (
            decisions.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.state}</td>
                <td>{d.recipeId ?? ''}</td>
                <td>{d.decidedAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <table data-testid="debug-overrides">
        <caption>{t('debug.data.overrides')}</caption>
        <tbody>
          {overrides.length === 0 ? (
            <tr>
              <td>{t('debug.data.empty')}</td>
            </tr>
          ) : (
            overrides.map(([date, o]) => (
              <tr key={date}>
                <td>{date}</td>
                <td>{JSON.stringify(o)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button type="button" data-testid="debug-clear" onClick={() => setConfirmClear(true)}>
        {t('debug.data.clear')}
      </button>
      {confirmClear && (
        <Dialog
          name="debug-clear"
          title={t('debug.data.clearConfirm')}
          confirmLabel={t('debug.data.clearYes')}
          cancelLabel={t('debug.close')}
          destructive
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            void startOver();
          }}
        />
      )}
    </>
  );
}

export default function DebugPanel() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const c = debugCatalog[state.language];
  return (
    <div data-debug={DEBUG_MARKER}>
      <button type="button" className="debug-open" data-testid="debug-open" onClick={() => setOpen((v) => !v)}>
        {c['debug.open']}
      </button>
      {open && (
        <aside className="debug-panel" data-testid="debug-panel" data-marker={DEBUG_PANEL_MARKER} aria-label={c['debug.title']}>
          <h2>{c['debug.title']}</h2>
          <button type="button" data-testid="debug-close" onClick={() => setOpen(false)}>
            {c['debug.close']}
          </button>
          {state.phase === 'ready' && <PanelBody />}
        </aside>
      )}
    </div>
  );
}
