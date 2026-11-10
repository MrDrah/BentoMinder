// Contract 14.7 at run time: the owner ids the repository accepts for the signed-in account (its uid, and the family id
// while it is a member). Mutable on purpose: membership changes while the app runs and the repository asks each time.
export interface OwnerScope {
  ids(): readonly string[];
  setFamilyId(familyId: string | null): void;
}

export function createOwnerScope(uid: string): OwnerScope {
  let familyId: string | null = null;
  return {
    ids: () => (familyId === null ? [uid] : [uid, familyId]),
    setFamilyId: (id) => {
      familyId = id;
    },
  };
}
