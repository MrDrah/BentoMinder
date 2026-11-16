// Loads the shipped recipe library (generated data/library.json) as its own lazy chunk, so the main bundle stays small
// (ADR 001 budgets). The domain takes the library as an argument, so tests pass fixtures instead.
import type { Recipe } from '../domain/schema/recipe.ts';

let pending: Promise<readonly Recipe[]> | null = null;

/** One shared request; a failed one is forgotten so a retry asks the network again. */
export function loadShippedLibrary(): Promise<readonly Recipe[]> {
  if (pending === null) {
    const p = import('../../data/library.json').then((m) => m.default as unknown as readonly Recipe[]);
    pending = p;
    p.catch(() => {
      if (pending === p) pending = null;
    });
  }
  return pending;
}
