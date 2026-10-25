// Calendar marks (design/components.md §2.4): the assessment marks and the decision icons. They
// are drawn shapes plus text elsewhere, so colour is never the only signal (BR-03). All are
// decorative (aria-hidden); the accessible name comes from the catalog.
import type { AssessmentState } from '../../domain/assessment/assess.ts';

interface MarkProps {
  state: AssessmentState;
  /** A manual override: the mark gets a 2 px bar under it (US-E4-03/AC1). */
  overridden?: boolean;
  size?: number;
}

export function AssessMark({ state, overridden = false, size = 16 }: MarkProps) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  let shape;
  switch (state) {
    case 'likely-enjoyable':
      shape = <circle cx="12" cy="11" r="7" {...common} />;
      break;
    case 'mixed-uncertain':
      shape = <path d="M12 4l8 14H4z" {...common} />;
      break;
    case 'low-preference':
      shape = (
        <>
          <circle cx="12" cy="11" r="7.5" {...common} strokeDasharray="3 3" />
          <path d="M10 9.2a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M12 14.6v.01" {...common} />
        </>
      );
      break;
    case 'not-assessed':
      shape = <path d="M6 11h12" {...common} />;
      break;
    case 'no-school-lunch':
      return null;
  }
  return (
    <svg className={`mark mark--${state}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {shape}
      {overridden && <path d="M5 21h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}

/** The bento box: filled for a plan, outline for 「あとで決める」 / an open お弁当の日. */
export function BentoIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg className="bento-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="3" y="6" width="18" height="13" rx="3" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v13M3 12.5h18" stroke={filled ? 'var(--bento-line, var(--navy-fill))' : 'currentColor'} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** The needs-review badge: a "!" in a ring (warning), or the same shape in danger tones. */
export function FlagBadge({ tone = 'warning' }: { tone?: 'warning' | 'danger' }) {
  return (
    <span className={`flag-badge flag-badge--${tone}`} aria-hidden="true">
      {'!'}
    </span>
  );
}
