// One flag shared by the join screen and the adoption screen in this page session: a join that was committed a moment
// ago (so "Cancel" can still undo it) versus a resumed one after a restart (no cancel, only the note `family.adopt.later`).
let fresh = false;

export const markFreshJoin = (): void => {
  fresh = true;
};
export const clearFreshJoin = (): void => {
  fresh = false;
};
export const isFreshJoin = (): boolean => fresh;
