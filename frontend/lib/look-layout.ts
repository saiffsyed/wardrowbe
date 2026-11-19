import { ITEM_ROLE } from '@/lib/generated/garment-vocabulary';

// Where a piece goes when a look is laid out the way it is worn: jewellery for the head at the
// top, then the top, the bottom and the shoes; a saree, lehenga or dress fills the top and the
// bottom together; a dupatta, bag or bangles go in a column beside it.
export type LookZone = 'head' | 'top' | 'bottom' | 'full' | 'feet' | 'side';

const HEAD_TYPES = new Set([
  'hat',
  'earrings',
  'jhumkas',
  'maang-tikka',
  'nose-ring',
  'hair-jewellery',
]);

const ZONE_BY_ROLE: Record<string, LookZone> = {
  base_top: 'top',
  mid_layer: 'top',
  outer_layer: 'top',
  neckwear: 'top',
  bottom: 'bottom',
  legwear: 'bottom',
  full_body: 'full',
  suit: 'full',
  footwear: 'feet',
  socks: 'feet',
};

export function lookZone(type: string): LookZone {
  if (HEAD_TYPES.has(type)) return 'head';
  // A sherwani is worn knee-length over the trousers, so it reads as the top.
  return ZONE_BY_ROLE[ITEM_ROLE[type] ?? ''] ?? 'side';
}

// Tops worn long, down to the knee or below, so the bottoms show only from under the hem.
const LONG_TOPS = new Set(['kurta', 'kurti', 'sherwani']);

export interface LookPiece {
  // The item, so a saved arrangement can find its picture.
  id?: string;
  type: string;
  url: string;
}

export type LookLayout = Record<LookZone, LookPiece[]> & {
  // A long top lies over the upper part of the bottoms instead of sitting above them.
  layered: boolean;
};

export function layoutLook(pieces: LookPiece[]): LookLayout {
  const layout: LookLayout = {
    head: [],
    top: [],
    bottom: [],
    full: [],
    feet: [],
    side: [],
    layered: false,
  };
  for (const piece of pieces) layout[lookZone(piece.type)].push(piece);
  // Under a saree or lehenga, a blouse or petticoat would only crowd the long piece; they
  // move to the side column, and so does a second long piece.
  if (layout.full.length > 0) {
    layout.side.unshift(...layout.full.slice(1), ...layout.top, ...layout.bottom);
    layout.full = layout.full.slice(0, 1);
    layout.top = [];
    layout.bottom = [];
  }
  layout.layered =
    layout.bottom.length > 0 && layout.top.some((piece) => LONG_TOPS.has(piece.type));
  return layout;
}
