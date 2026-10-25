// Decision state machine (BR-02, BR-03, BR-13, BR-17, BR-19, BR-25, BR-27; ADR 004 §2; data
// contract §3.6; user-stories E5). One DayDecision record per date, written only by `transition`
// from an explicit parent event. It takes no Assessment: an assessment cannot change a decision
// because it is not an input (BR-01, BR-02).
import { DECISION_HISTORY_LIMIT } from '../rules.ts';
import type { DecisionKind } from '../menu/day-kind.ts';
import type { DayDecision } from '../schema/index.ts';
import { toJstTimestamp, type Instant, type LocalDate } from '../time/jst.ts';

export type DecisionState = 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned' | 'no-school-lunch';

/** One per parent action (contract §3.6). Dialog steps and opening the recommendation view are not events. */
export type DecisionEvent =
  | { type: 'CONFIRM_RECIPE'; recipeId: string }
  | { type: 'CHANGE_RECIPE'; recipeId: string }
  | { type: 'DEFER' }
  | { type: 'SET_SCHOOL_LUNCH' }
  | { type: 'CLEAR_PLAN' }
  | { type: 'KEEP_PLAN' }
  | { type: 'MARK_RESERVATION'; done: boolean };
export type DecisionEventType = DecisionEvent['type'];

export const DECISION_EVENT_TYPES: readonly DecisionEventType[] = ['CONFIRM_RECIPE', 'CHANGE_RECIPE', 'DEFER', 'SET_SCHOOL_LUNCH', 'CLEAR_PLAN', 'KEEP_PLAN', 'MARK_RESERVATION'];

export interface DayContext {
  date: LocalDate;
  kind: DecisionKind;
  /** The version of the confirmed menu of the date's month; null when the month has none. */
  menuVersion: number | null;
  /** The date is in the current version's `changedDatesSincePrevious` (decides `needsAck`). */
  changedInCurrentVersion: boolean;
}

export type DecisionConflict = 'none' | 'plan-on-no-lunch' | 'plan-date-removed' | 'dormant';

export interface DisplayedDecision {
  /** null: no decision is shown (outside the menu). */
  state: DecisionState | null;
  conflict: DecisionConflict;
  /** A refresh conflict that the parent has not acknowledged for the version that changed it (KEEP_PLAN). */
  needsAck: boolean;
}

export type DecisionError = 'INVALID_TRANSITION' | 'DATE_IN_PAST' | 'NOT_PLANNABLE_DAY' | 'UNKNOWN_RECIPE' | 'RECIPE_EXCLUDED';

/** What the state machine needs from a recipe: its id, names and the two short names (snapshots). */
export interface RecipeRef {
  id: string;
  name: { ja: string; en?: string | undefined };
  shortNameJa: string;
  shortNameEn: string;
}

export interface TransitionEnv {
  /** Today in Asia/Tokyo (BR-15, BR-27). */
  today: LocalDate;
  now: Instant;
  recipe: (id: string) => RecipeRef | undefined;
  /** BR-06 "never plannable": false refuses the recipe. M3 wires the ranker's hard filters here. */
  isRecipeAllowed?: (id: string) => boolean;
  ownerId?: string;
}

export type TransitionResult = { ok: true; next: DayDecision | null } | { ok: false; error: DecisionError };

const BENTO: DecisionState = 'homemade-bento-planned';

/** Contract §3.6 `needsAck`: unacknowledged, or changed again since the acknowledged version. */
function needsAck(ctx: DayContext, record: DayDecision): boolean {
  const ack = record.acknowledgedMenuVersion;
  return ack === undefined || (ctx.changedInCurrentVersion && ctx.menuVersion !== null && ack < ctx.menuVersion);
}

/**
 * What a date shows, by the stored record and the date's current kind (ADR 004 §2 note ³).
 * A stored record is never changed by this function.
 */
export function displayedDecision(ctx: DayContext, record: DayDecision | undefined): DisplayedDecision {
  const none: DisplayedDecision = { state: null, conflict: 'none', needsAck: false };
  switch (ctx.kind) {
    case 'school-day':
      return { state: record?.state ?? 'school-lunch-planned', conflict: 'none', needsAck: false };
    case 'bento-day':
      if (record?.state === BENTO) return { state: BENTO, conflict: 'none', needsAck: false };
      return { state: 'no-school-lunch', conflict: record === undefined ? 'none' : 'dormant', needsAck: false };
    case 'other-no-lunch':
      if (record === undefined) return { state: 'no-school-lunch', conflict: 'none', needsAck: false };
      if (record.state === BENTO) return { state: BENTO, conflict: 'plan-on-no-lunch', needsAck: needsAck(ctx, record) };
      return { state: 'no-school-lunch', conflict: 'dormant', needsAck: false };
    case 'not-in-menu':
      if (record === undefined) return none;
      if (record.state === BENTO) return { state: BENTO, conflict: 'plan-date-removed', needsAck: needsAck(ctx, record) };
      return { state: null, conflict: 'dormant', needsAck: false };
  }
}

const isConflict = (c: DecisionConflict): boolean => c === 'plan-on-no-lunch' || c === 'plan-date-removed';

/** Guards and the allowed-transition table, independent of the recipe (shared with the UI's "which actions"). */
export function eventError(ctx: DayContext, record: DayDecision | undefined, event: DecisionEvent, today: LocalDate): DecisionError | null {
  const shown = displayedDecision(ctx, record);
  const conflict = isConflict(shown.conflict);
  // Guard 1: nothing is plannable outside school days and bento days, except a refresh conflict's keep / clear.
  if (ctx.kind === 'other-no-lunch' || ctx.kind === 'not-in-menu') {
    if (!(conflict && (event.type === 'CLEAR_PLAN' || event.type === 'KEEP_PLAN'))) return 'NOT_PLANNABLE_DAY';
  }
  // Guard 2: dates before today (Asia/Tokyo) are read-only (BR-27); today is writable.
  if (ctx.date < today) return 'DATE_IN_PAST';
  const from = shown.state;
  const school = ctx.kind === 'school-day';
  const bentoDay = ctx.kind === 'bento-day';
  let allowed: boolean;
  switch (event.type) {
    case 'CONFIRM_RECIPE':
      allowed = (school && (from === 'school-lunch-planned' || from === 'not-confirmed')) || (bentoDay && from === 'no-school-lunch');
      break;
    case 'DEFER':
      allowed = school && (from === 'school-lunch-planned' || from === BENTO);
      break;
    case 'SET_SCHOOL_LUNCH':
      allowed = school && (from === 'not-confirmed' || from === BENTO);
      break;
    case 'CHANGE_RECIPE':
      allowed = (school || bentoDay) && from === BENTO;
      break;
    case 'CLEAR_PLAN':
      allowed = (bentoDay && from === BENTO) || conflict;
      break;
    case 'KEEP_PLAN':
      allowed = conflict && ctx.menuVersion !== null;
      break;
    case 'MARK_RESERVATION':
      allowed = school && from === 'school-lunch-planned' && (event.done || record !== undefined);
      break;
  }
  return allowed ? null : 'INVALID_TRANSITION';
}

/** The event types the state machine would accept right now (for showing only allowed actions). */
export function allowedEvents(ctx: DayContext, record: DayDecision | undefined, today: LocalDate): DecisionEventType[] {
  const probe = (event: DecisionEvent) => eventError(ctx, record, event, today) === null;
  const out: DecisionEventType[] = [];
  for (const type of DECISION_EVENT_TYPES) {
    const event: DecisionEvent =
      type === 'CONFIRM_RECIPE' || type === 'CHANGE_RECIPE' ? { type, recipeId: 'rcp-probe' } : type === 'MARK_RESERVATION' ? { type, done: true } : { type };
    if (probe(event)) out.push(type);
  }
  return out;
}

function pushHistory(history: DayDecision['history'], entry: DayDecision['history'][number]): DayDecision['history'] {
  return [...history, entry].slice(-DECISION_HISTORY_LIMIT);
}

type StoredState = Exclude<DayDecision['state'], 'no-school-lunch'>;

/**
 * Applies one parent event. `next` is the record to store, or null to delete it. Every successful
 * write sets `updatedAt`; a state, recipe or reservation change sets `decidedAt` and (except the
 * reservation tick) appends to `history`; KEEP_PLAN sets only `acknowledgedMenuVersion`.
 */
export function transition(ctx: DayContext, record: DayDecision | undefined, event: DecisionEvent, env: TransitionEnv): TransitionResult {
  const error = eventError(ctx, record, event, env.today);
  if (error !== null) return { ok: false, error };
  const ts = toJstTimestamp(env.now);
  const meta = { ownerId: record?.ownerId ?? env.ownerId ?? 'local', createdAt: record?.createdAt ?? ts, updatedAt: ts };
  const history = record?.history ?? [];

  const plain = (state: StoredState): DayDecision => ({
    date: ctx.date,
    state,
    reservationDoneExternally: false,
    decidedAt: ts,
    history: pushHistory(history, { state, at: ts }),
    ...meta,
  });

  switch (event.type) {
    case 'CONFIRM_RECIPE':
    case 'CHANGE_RECIPE': {
      const recipe = env.recipe(event.recipeId);
      if (recipe === undefined) return { ok: false, error: 'UNKNOWN_RECIPE' };
      if (env.isRecipeAllowed?.(event.recipeId) === false) return { ok: false, error: 'RECIPE_EXCLUDED' };
      if (event.type === 'CHANGE_RECIPE' && record?.recipeId === event.recipeId) return { ok: true, next: record }; // same recipe: nothing changes
      const snapshots = {
        recipeId: recipe.id,
        recipeNameSnapshot: recipe.name.en === undefined ? { ja: recipe.name.ja } : { ja: recipe.name.ja, en: recipe.name.en },
        recipeShortNameSnapshot: { ja: recipe.shortNameJa, en: recipe.shortNameEn },
      };
      const entry = { state: BENTO as StoredState, recipeId: recipe.id, at: ts };
      if (event.type === 'CHANGE_RECIPE' && record !== undefined) {
        return { ok: true, next: { ...record, ...snapshots, decidedAt: ts, history: pushHistory(history, entry), updatedAt: ts } };
      }
      // CONFIRM_RECIPE: a new plan (also replaces a dormant record on an お弁当の日, U5); plannedAt = first confirm
      return {
        ok: true,
        next: { date: ctx.date, state: BENTO, ...snapshots, reservationDoneExternally: false, decidedAt: ts, plannedAt: ts, history: pushHistory(history, entry), ...meta },
      };
    }
    case 'DEFER':
      return { ok: true, next: plain('not-confirmed') };
    case 'SET_SCHOOL_LUNCH':
      return { ok: true, next: plain('school-lunch-planned') };
    case 'CLEAR_PLAN':
      return { ok: true, next: null };
    case 'KEEP_PLAN': {
      if (record === undefined || ctx.menuVersion === null) return { ok: false, error: 'INVALID_TRANSITION' };
      return { ok: true, next: { ...record, acknowledgedMenuVersion: ctx.menuVersion, updatedAt: ts } };
    }
    case 'MARK_RESERVATION': {
      if (record !== undefined && record.reservationDoneExternally === event.done) return { ok: true, next: record };
      return {
        ok: true,
        next: { date: ctx.date, state: 'school-lunch-planned', reservationDoneExternally: event.done, decidedAt: ts, history, ...meta },
      };
    }
  }
}
