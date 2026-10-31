// Binds the shipped recipe library (generated data/library.json) for the UI. The domain takes the
// library as an argument, so tests pass fixtures instead.
import data from '../../data/library.json';
import type { Recipe } from '../domain/schema/recipe.ts';

export const shippedLibrary = data as unknown as readonly Recipe[];
