// Shared controls from design/components.md §1: dialog (§1.13), banner (§1.10), toast (§1.11),
// stepper (§1.15), chip (§1.6). Text always arrives from the catalog through props.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useApp } from '../app-store.tsx';

export interface DialogProps {
  name: string;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** alertdialog + destructive confirm button for destructive confirms. */
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  children?: ReactNode;
  confirmTestId?: string;
  testId?: string;
  cancelTestId?: string;
}

/** §1.13: modal, labelled and described; initial focus on the least destructive action; Esc = cancel. */
export function Dialog({ name, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, destructive = false, busy = false, error = null, children, confirmTestId, cancelTestId, testId }: DialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(boxRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea') ?? [])].filter((el) => !el.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div className="scrim">
      <div
        ref={boxRef}
        className="dialog"
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body === undefined ? undefined : bodyId}
        data-testid={testId ?? `dialog-${name}`}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        {body !== undefined && (
          <div id={bodyId} className="dialog__body">
            {body}
          </div>
        )}
        {children}
        {error !== null && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button
            type="button"
            className={destructive ? 'btn btn--destructive' : 'btn btn--primary'}
            data-testid={confirmTestId ?? `dialog-${name}-confirm`}
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button ref={cancelRef} type="button" className="btn btn--secondary" data-testid={cancelTestId ?? `dialog-${name}-cancel`} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type BannerVariant = 'info' | 'warning' | 'danger' | 'success';

const BANNER_ICON: Record<BannerVariant, string> = {
  info: 'M12 8v.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  warning: 'M12 4l9 16H3zM12 10v4M12 17v.01',
  danger: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM12 8v5M12 16v.01',
  success: 'M5 12l5 5 9-10',
};

export function BannerIcon({ variant }: { variant: BannerVariant }) {
  return (
    <svg className="banner__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={BANNER_ICON[variant]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** §1.10: icon + title + body; danger banners are alerts, the others status messages. */
export function Banner({ variant, title, children, testId, live = true }: { variant: BannerVariant; title?: string; children?: ReactNode; testId: string; live?: boolean }) {
  const role = !live ? undefined : variant === 'danger' ? 'alert' : 'status';
  return (
    <div className={`banner banner--${variant}`} role={role} data-testid={testId} tabIndex={variant === 'danger' ? -1 : undefined}>
      <div className="banner__row">
        <BannerIcon variant={variant} />
        <div className="banner__content">
          {title !== undefined && <strong className="banner__title">{title}</strong>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** §1.11: one toast at a time, 4 s, polite. */
export function Toast() {
  const { toast } = useApp();
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast !== null && (
        <div className="toast" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

/** §1.15: 3 input steps; the text carries the meaning, the bars are decorative. */
export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useApp();
  const names = [t('ob.step1.name'), t('ob.step2.name'), t('ob.step3.name')];
  return (
    <div className="stepper" data-testid="stepper">
      <div className="stepper__bars" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`stepper__bar${n < step ? ' is-done' : n === step ? ' is-current' : ''}`} />
        ))}
      </div>
      <ol className="stepper__list" aria-label={t('ob.stepper.label', { n: step })}>
        {names.map((name, i) => {
          const n = i + 1;
          return (
            <li key={name} aria-current={n === step ? 'step' : undefined} className={n === step ? 'is-current' : 'visually-hidden'}>
              {n === step && <span className="stepper__count">{t('ob.stepper.label', { n })}</span>}
              <span>{name}</span>
              <span className="visually-hidden">{n < step ? t('ob.stepper.done') : n === step ? t('ob.stepper.current') : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export interface ChipProps {
  testId: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** 'radio' for single choice (age), 'pressed' for multi choice. */
  mode: 'radio' | 'pressed';
  disabledLook?: boolean;
  lang?: string;
  /** The accessible name when it differs from the visible text (e.g. the kind of food, US-E1-02/AC8). */
  ariaLabel?: string;
}

/** §1.6 choice chip: selected = navy fill + check icon + aria state (not colour alone). */
export function Chip({ testId, label, selected, onToggle, mode, disabledLook = false, lang, ariaLabel }: ChipProps) {
  const aria = mode === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected };
  return (
    <button
      type="button"
      className={`chip${selected ? ' is-selected' : ''}${disabledLook ? ' is-disabled' : ''}`}
      data-testid={testId}
      onClick={onToggle}
      lang={lang}
      aria-disabled={disabledLook || undefined}
      aria-label={ariaLabel}
      {...aria}
    >
      {selected && (
        <svg className="chip__check" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </button>
  );
}

export function FieldError({ id, text, testId }: { id: string; text: string; testId: string }) {
  return (
    <p id={id} className="field-error" data-testid={testId}>
      <BannerIcon variant="warning" />
      {text}
    </p>
  );
}

/** §1.8 Switch: role="switch" with the state word beside it (not colour only). */
export function Switch({ labelledBy, checked, onChange, testId }: { labelledBy: string; checked: boolean; onChange: (next: boolean) => void; testId: string }) {
  const { t } = useApp();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} className={`switch${checked ? ' is-on' : ''}`} data-testid={testId} onClick={() => onChange(!checked)}>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
      <span className="switch__state">{t(checked ? 'settings.switch.on' : 'settings.switch.off')}</span>
    </button>
  );
}
