// The wardrobe's category chips, in the order they are shown. The server owns which garment
// types each one holds (backend/app/utils/wardrobe_categories.py); the keys must match.
export const WARDROBE_CATEGORIES = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'traditional',
  'shoes',
  'jewellery',
  'accessories',
] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export function isWardrobeCategory(value: string | null | undefined): value is WardrobeCategory {
  return !!value && (WARDROBE_CATEGORIES as readonly string[]).includes(value);
}
