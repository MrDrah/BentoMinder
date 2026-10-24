// Binds the shipped dictionary (generated data/dictionary.json) for the UI. The domain takes
// the dictionary as an argument, so tests pass fixtures instead.
import data from '../../data/dictionary.json';
import type { Dictionary } from '../domain/schema/dictionary.ts';

export const shippedDictionary = data as Dictionary;
