// Dish type of a recipe (US-E17-01, design/illustrations.md §1): picks the illustration; never shown as text.
export const DISH_TYPES = [
  'onigiri',
  'rice-bowl',
  'sandwich',
  'noodles',
  'egg',
  'fried-chicken',
  'meat-patty',
  'meat-roll',
  'grilled-fish',
  'simmered',
  'tofu',
  'salad',
  'soup',
  'vegetable-side',
  'fritter',
  'dumpling',
  'sweet',
  'other',
] as const;
export type DishType = (typeof DISH_TYPES)[number];

/** Any value that is not one of the 18 types (missing, null, empty, unknown) renders as `other` (design §5). */
export function normalizeDishType(value: unknown): DishType {
  return typeof value === 'string' && (DISH_TYPES as readonly string[]).includes(value) ? (value as DishType) : 'other';
}
