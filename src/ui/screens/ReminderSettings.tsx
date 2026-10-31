// Settings, reminders section (design/components.md §9, §9.1; US-E7-04, US-E7-06/AC1, US-E7-07/AC2):
// a switch and a 15-minute time per reminder, the weekly day, and the always-visible web limit.
import { useId } from 'react';
import { deviceIsTokyo } from '../../adapters/web/notifications.ts';
import { HOURS, MINUTES, splitTime, type ReminderSettingsPatch } from '../../domain/reminders/index.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner, Switch } from '../components/Controls.tsx';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function TimePicker({ id, time, disabled, onChange }: { id: string; time: string; disabled: boolean; onChange: (time: string) => void }) {
  const { t } = useApp();
  const { hour, minute } = splitTime(time);
  return (
    <fieldset className="time-picker" disabled={disabled}>
      <legend className="field__sublabel">{t('settings.time.group')}</legend>
      <label className="time-picker__part" htmlFor={`select-${id}-hour`}>
        <select id={`select-${id}-hour`} className="input" value={hour} data-testid={`select-${id}-hour`} onChange={(e) => onChange(`${e.target.value}:${minute}`)}>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span>{t('settings.time.hour')}</span>
      </label>
      <label className="time-picker__part" htmlFor={`select-${id}-minute`}>
        <select id={`select-${id}-minute`} className="input" value={minute} data-testid={`select-${id}-minute`} onChange={(e) => onChange(`${hour}:${e.target.value}`)}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span>{t('settings.time.minute')}</span>
      </label>
    </fieldset>
  );
}

export function ReminderSettings({ onChange }: { onChange: (patch: ReminderSettingsPatch) => void }) {
  const { t } = useApp();
  const { weekly, dayBefore } = useStore().settings.reminders;
  const weeklyLabel = useId();
  const dayBeforeLabel = useId();
  const japanTime = deviceIsTokyo() ? '' : ` ${t('common.japanTime')}`;
  const wd = t(`wd.long.${weekly.weekday}` as MessageKey);
  return (
    <section className="card" aria-labelledby="settings-reminders">
      <h2 id="settings-reminders" className="card__title">
        {t('settings.reminders')}
      </h2>

      <div className="switch-row">
        <span id={weeklyLabel} className="field__label">
          {t('settings.weekly')}
        </span>
        <Switch labelledBy={weeklyLabel} checked={weekly.enabled} onChange={(enabled) => onChange({ weekly: { enabled } })} testId="switch-weekly" />
      </div>
      <p className="switch-row__value" data-testid="settings-weekly-value">
        {t('settings.weekly.value', { wdLong: wd, wdLongEn: wd, time: weekly.time })}
        {japanTime}
      </p>
      <div className="field">
        <label className="field__sublabel" htmlFor="select-weekly-day">
          {t('settings.weekly.day')}
        </label>
        <select
          id="select-weekly-day"
          className="input"
          value={weekly.weekday}
          disabled={!weekly.enabled}
          data-testid="select-weekly-day"
          onChange={(e) => onChange({ weekly: { weekday: Number(e.target.value) } })}
        >
          {WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {t(`wd.long.${d}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      <TimePicker id="weekly" time={weekly.time} disabled={!weekly.enabled} onChange={(time) => onChange({ weekly: { time } })} />
      <p className="field__hint">{t('settings.weekly.hint')}</p>

      <div className="switch-row">
        <span id={dayBeforeLabel} className="field__label">
          {t('settings.dayBefore')}
        </span>
        <Switch labelledBy={dayBeforeLabel} checked={dayBefore.enabled} onChange={(enabled) => onChange({ dayBefore: { enabled } })} testId="switch-day-before" />
      </div>
      <p className="switch-row__value" data-testid="settings-day-before-value">
        {dayBefore.time}
        {japanTime}
      </p>
      <TimePicker id="day-before" time={dayBefore.time} disabled={!dayBefore.enabled} onChange={(time) => onChange({ dayBefore: { time } })} />
      <p className="field__hint">{t('settings.dayBefore.hint')}</p>

      <Banner variant="info" testId="settings-web-limit" live={false}>
        <p className="banner__body">{t('settings.webLimit')}</p>
      </Banner>
    </section>
  );
}
