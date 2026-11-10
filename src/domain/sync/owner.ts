// Contract 14.7: `meta-owner-matches-account` while in a family accepts the account's uid OR the family id of its
// current membership, and no other value. The schema's `ownerMismatches` checks one id; this checks a list
// without touching the schema (ADR 016 section 4 puts the list into the repository options in slice C).
import { ownerMismatches, type BentoMinderStore, type RuleIssue } from '../schema/store.ts';
import { rewriteOwnerId } from '../storage/owner.ts';

export function ownerMismatchesFor(store: BentoMinderStore, allowedOwnerIds: readonly string[]): RuleIssue[] {
  const [first, ...rest] = allowedOwnerIds;
  if (first === undefined) return ownerMismatches(store, '');
  let issues = ownerMismatches(store, first);
  for (const id of rest) {
    const other = new Set(ownerMismatches(store, id).map((i) => i.path));
    issues = issues.filter((i) => other.has(i.path));
  }
  return issues;
}

/** Create or join (US-E15-11/AC3): every record's `ownerId` becomes the family id. Nothing else changes. */
export function withFamilyOwner(store: BentoMinderStore, familyId: string): BentoMinderStore {
  return rewriteOwnerId(store, familyId);
}

/** Leave, removal, family deleted (US-E15-11/AC3, contract 14.7): every `ownerId` is the uid again. */
export function withAccountOwner(store: BentoMinderStore, uid: string): BentoMinderStore {
  return rewriteOwnerId(store, uid);
}
