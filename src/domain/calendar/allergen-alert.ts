// The allergen alert of a menu day (US-E1-05/AC2): the declared allergens of the day that the child's
// registered allergens match. One predicate for the day-sheet banner (`day-banner-allergen`) and the
// calendar tile mark (US-E5-01/AC16), so the two can never disagree.
import type { ExtractedDay, ChildProfile } from '../schema/index.ts';

export function allergenAlertIds(profile: ChildProfile | null, day: ExtractedDay): string[] {
  const known = profile !== null && profile.allergyStatus === 'has-known' ? profile.knownAllergenIds : [];
  const declared = day.allergenDeclaration;
  return declared.status === 'declared' ? declared.allergenIds.filter((id) => known.includes(id)) : [];
}
