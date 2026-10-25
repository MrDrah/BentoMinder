// Ambiguity choices on review (US-E4-01/AC6, AC21; data contract §3.3 `resolvedIds`, rule
// `resolved-ids-candidates`; dictionary §7). The review asks about the ambiguity-group forms the
// matcher could not resolve; the parent's choice is stored on the item as `resolvedIds`.
import type { Dictionary } from '../schema/dictionary.ts';
import { matcherFor, NON_FOOD_READINGS } from './matcher.ts';

export interface AmbiguityPrompt {
  groupId: string;
  /** The form as it appears in the item (normalised). */
  surface: string;
  /** Candidate ids in the dictionary's order (labels come from the dictionary or `amb.*`). */
  candidateIds: string[];
  /** 「味」 for amb-aji, 「無し」 for amb-nashi: a reading that is not a food (stored as `[]`). */
  nonFoodReading: string | null;
}

/** The unresolved ambiguity forms of one item text, one prompt per group (dictionary §7). */
export function ambiguityPrompts(dict: Dictionary, text: string): AmbiguityPrompt[] {
  const seen = new Set<string>();
  const prompts: AmbiguityPrompt[] = [];
  for (const u of matcherFor(dict).match(text).unresolved) {
    if (seen.has(u.groupId)) continue;
    seen.add(u.groupId);
    const group = dict.ambiguity.find((g) => g.id === u.groupId);
    if (group === undefined) continue;
    prompts.push({ groupId: u.groupId, surface: u.surface, candidateIds: [...group.candidateIds], nonFoodReading: NON_FOOD_READINGS[u.groupId] ?? null });
  }
  return prompts;
}

/**
 * True when `resolvedIds` breaks `resolved-ids-candidates`: an id that is not a candidate of an
 * ambiguity group whose form occurs unresolved in the text, `[]` for a text whose groups have no
 * non-food reading, or any choice for a text with nothing unresolved.
 */
export function resolvedIdsViolation(dict: Dictionary, text: string, resolvedIds: readonly string[]): boolean {
  const prompts = ambiguityPrompts(dict, text);
  if (prompts.length === 0) return true;
  const candidates = new Set(prompts.flatMap((p) => p.candidateIds));
  if (resolvedIds.some((id) => !candidates.has(id))) return true;
  return resolvedIds.length === 0 && !prompts.some((p) => p.nonFoodReading !== null);
}
