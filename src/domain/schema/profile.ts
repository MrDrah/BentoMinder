// Data contract §3.2 ChildProfile. No birthdate, gender, height, weight, photo, real name,
// school, class or address: such fields don't exist and are rejected as unknown (BR-20).
import { z } from 'zod';
import {
  allergenIdSchema,
  boundedText,
  DIETS,
  idSchema,
  issue,
  metaShape,
  metaTimestampsOk,
  obj,
  themeIdSchema,
  uniqueList,
} from './primitives.ts';

export const AGE_RANGES = ['age-under-3', 'age-3-4', 'age-4-5', 'age-5-6', 'age-6-9', 'age-9-12'] as const;

const foodIdSchema = idSchema('ing', 'cat', 'dish');

export const childProfileSchema = obj({
  id: idSchema('child'),
  nickname: boundedText(1, 20).optional(),
  ageRange: z.enum(AGE_RANGES),
  likedIds: uniqueList(foodIdSchema, 0, 30),
  dislikedIds: uniqueList(foodIdSchema, 0, 30),
  allergyStatus: z.enum(['none-known', 'has-known', 'unknown']),
  knownAllergenIds: uniqueList(allergenIdSchema),
  excludedIngredientIds: uniqueList(idSchema('ing', 'cat')),
  diet: uniqueList(z.enum(DIETS)),
  themeIds: uniqueList(themeIdSchema, 0, 3),
  note: boundedText(0, 200).optional(),
  ...metaShape,
}).superRefine((p, ctx) => {
  const liked = new Set(p.likedIds);
  if (p.dislikedIds.some((id) => liked.has(id))) issue(ctx, 'profile-like-dislike-overlap', ['dislikedIds']);
  const anyKnown = p.knownAllergenIds.length > 0 || p.excludedIngredientIds.length > 0;
  if ((p.allergyStatus === 'has-known') !== anyKnown) issue(ctx, 'profile-allergy-status', ['allergyStatus']);
  if (!metaTimestampsOk(p)) issue(ctx, 'meta-timestamps', ['updatedAt']);
});
export type ChildProfile = z.infer<typeof childProfileSchema>;
