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
      <path d="M12 6v13M3 12.5h18" stroke={filled ? 'var(--bento-line)' : 'currentColor'} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

export type TileIconName = 'lunchbox' | 'home-bento' | 'bento-unsure';

// design/components.md §18.1: 24 px grid, 2 px stroke, round caps; one dot is filled. The names are the icon names.
const SPOON_SPATULA = (
  <>
    <ellipse cx="6.8" cy="6.8" rx="2.6" ry="3.6" transform="rotate(-45 6.8 6.8)" />
    <path d="M9.4 9.4 20 20" />
    <rect x="14.7" y="3.9" width="4.6" height="6" rx="1.2" transform="rotate(45 17 6.9)" />
    <path d="M14.6 9.4 4 20" />
  </>
);

/** The state icon of a calendar tile (school lunch, homemade bento, not confirmed); a CSS class sets the size. */
export function TileIcon({ name, size = 24, className }: { name: TileIconName; size?: number; className?: string }) {
  let shape;
  switch (name) {
    case 'lunchbox':
      shape = (
        <>
          <rect x="3" y="6.5" width="18" height="12" rx="3" />
          <path d="M14 6.5v12" />
          <circle cx="8.5" cy="12.5" r="1.7" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case 'home-bento':
      shape = SPOON_SPATULA;
      break;
    case 'bento-unsure':
      shape = (
        <>
          <g transform="translate(.5 8) scale(.72)" strokeWidth="2.78">
            {SPOON_SPATULA}
          </g>
          <path d="M15.2 6.6a3.1 3.1 0 1 1 4.5 2.8c-1 .5-1.5 1.1-1.5 2.1" />
          <path d="M18.2 15.6v.01" />
        </>
      );
      break;
  }
  return (
    <svg className={className} data-icon={name} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shape}
    </svg>
  );
}

/** The allergen mark of a tile, an agenda row or a legend sample (components §18.12): a round badge with a 「!」. */
export function AllergenMark({ className = 'cell__allergen' }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {'!'}
    </span>
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
