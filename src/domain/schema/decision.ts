// Data contract §3.6 DayDecision: stored only after a parent action (BR-02).
import { z } from 'zod';
import {
  boundedList,
  codePoints,
  dateSchema,
  idSchema,
  intRange,
  issue,
  localizedTextSchema,
  metaShape,
  metaTimestampsOk,
  obj,
  timestampSchema,
} from './primitives.ts';

export const STORED_DECISION_STATES = ['school-lunch-planned', 'homemade-bento-planned', 'not-confirmed'] as const;
export const DECISION_STATES = [...STORED_DECISION_STATES, 'no-school-lunch'] as const;

const shortName = z.string().refine((s) => s === s.trim() && codePoints(s) >= 1 && codePoints(s) <= 8, {
  error: 'recipe-short-name',
});

export const dayDecisionSchema = obj({
  date: dateSchema,
  // `no-school-lunch` parses so the rule can name it, then is refused below.
  state: z.enum(DECISION_STATES),
  recipeId: idSchema('rcp').optional(),
  recipeNameSnapshot: localizedTextSchema.optional(),
  recipeShortNameSnapshot: obj({ ja: shortName, en: shortName }).optional(),
  reservationDoneExternally: z.boolean(),
  decidedAt: timestampSchema,
  plannedAt: timestampSchema.optional(),
  acknowledgedMenuVersion: intRange(1).optional(),
  history: boundedList(
    obj({ state: z.enum(STORED_DECISION_STATES), recipeId: idSchema('rcp').optional(), at: timestampSchema }),
    0,
    5,
  ),
  ...metaShape,
}).superRefine((d, ctx) => {
  if (d.state === 'no-school-lunch') issue(ctx, 'decision-no-lunch-not-stored', ['state']);
  const bento = d.state === 'homemade-bento-planned';
  if (bento !== (d.recipeId !== undefined)) issue(ctx, 'decision-bento-requires-recipe', ['recipeId']);
  if (bento !== (d.recipeNameSnapshot !== undefined)) issue(ctx, 'decision-bento-snapshot', ['recipeNameSnapshot']);
  if (bento !== (d.recipeShortNameSnapshot !== undefined)) {
    issue(ctx, 'decision-bento-snapshot', ['recipeShortNameSnapshot']);
  }
  if (bento !== (d.plannedAt !== undefined)) issue(ctx, 'decision-planned-at', ['plannedAt']);
  if (d.reservationDoneExternally && d.state !== 'school-lunch-planned') {
    issue(ctx, 'decision-reservation-flag', ['reservationDoneExternally']);
  }
  if (!metaTimestampsOk(d)) issue(ctx, 'meta-timestamps', ['updatedAt']);
});
export type DayDecision = z.infer<typeof dayDecisionSchema>;
