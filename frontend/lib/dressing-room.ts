import { ITEM_ROLE } from '@/lib/generated/garment-vocabulary';
import type { DayForecast } from '@/lib/hooks/use-stays';

// The dressing room dresses a figure: each kind of item has its place on it. A saree, lehenga
// or dress goes in the top's place and covers the bottom; a jacket or coat lies over the top.
export type Spot = 'head' | 'neck' | 'top' | 'outer' | 'bottom' | 'feet' | 'dupatta' | 'wrist' | 'bag';

// Drawn in this order, so later places lie over earlier ones.
export const SPOTS: readonly Spot[] = ['bottom', 'top', 'outer', 'neck', 'head', 'feet', 'dupatta', 'wrist', 'bag'];

// Places that are filled only when the person adds something (Shuffle leaves them be unless one
// is worn). The top, bottom and shoes are always dressed.
const ALWAYS: readonly Spot[] = ['top', 'bottom', 'feet'];

const BY_TYPE: Record<string, Spot> = {
  hat: 'head',
  earrings: 'head',
  jhumkas: 'head',
  'maang-tikka': 'head',
  'nose-ring': 'head',
  'hair-jewellery': 'head',
  necklace: 'neck',
  mangalsutra: 'neck',
  tie: 'neck',
  dupatta: 'dupatta',
  stole: 'dupatta',
  scarf: 'dupatta',
  bangles: 'wrist',
  bracelet: 'wrist',
  watch: 'wrist',
  bag: 'bag',
  clutch: 'bag',
  potli: 'bag',
  // Worn long over the trousers, so it reads as the top rather than a coat.
  sherwani: 'top',
  cardigan: 'outer',
  vest: 'outer',
};

const BY_ROLE: Record<string, Spot> = {
  base_top: 'top',
  mid_layer: 'outer',
  outer_layer: 'outer',
  full_body: 'top',
  suit: 'top',
  bottom: 'bottom',
  legwear: 'bottom',
  footwear: 'feet',
};

// Where a kind of item goes on the figure, or null for things it doesn't show (rings, belts,
// socks…).
export function spotOf(type: string): Spot | null {
  return BY_TYPE[type] ?? BY_ROLE[ITEM_ROLE[type] ?? ''] ?? null;
}

// A saree, lehenga or dress fills the top's place and the bottom's.
export function coversBottom(type: string): boolean {
  const role = ITEM_ROLE[type];
  return role === 'full_body' || role === 'suit';
}

// The box a piece is drawn in, in percent of the stage (1 wide by 2 high). The picture fits
// inside it, keeping its shape, against the box's top edge.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BOXES: Record<Spot, Box> = {
  head: { x: 38, y: 14.5, w: 24, h: 5 },
  neck: { x: 40, y: 20.5, w: 20, h: 8 },
  top: { x: 25, y: 22, w: 50, h: 24 },
  outer: { x: 20, y: 21.5, w: 60, h: 27 },
  bottom: { x: 29, y: 43, w: 42, h: 38 },
  feet: { x: 34, y: 80, w: 32, h: 6 },
  dupatta: { x: 22, y: 22, w: 18, h: 38 },
  wrist: { x: 20, y: 43, w: 14, h: 6 },
  bag: { x: 68, y: 40, w: 26, h: 18 },
};

// Kinds drawn bigger or smaller than their place's usual box, so a shirt sits shorter than a
// kurti and a coat longer than a jacket.
const SIZES: Record<string, Partial<Box>> = {
  shirt: { h: 21 },
  't-shirt': { h: 21 },
  top: { h: 21 },
  blouse: { h: 21 },
  polo: { h: 21 },
  'tank-top': { h: 20 },
  camisole: { h: 19 },
  bodysuit: { h: 21 },
  'saree-blouse': { h: 14 },
  kurta: { h: 34 },
  kurti: { h: 33 },
  sherwani: { h: 40 },
  coat: { h: 46 },
  poncho: { h: 30 },
  shorts: { h: 16 },
  skirt: { h: 26 },
  hat: { x: 34, y: 3.5, w: 32, h: 9 },
  'maang-tikka': { x: 44, y: 9.5, w: 12, h: 6 },
  'hair-jewellery': { x: 36, y: 5, w: 28, h: 7 },
  'nose-ring': { x: 46, y: 14.5, w: 8, h: 3 },
  tie: { x: 44, y: 21.5, w: 12, h: 18 },
  watch: { w: 10, h: 5 },
  clutch: { h: 11 },
  potli: { h: 13 },
};

const FULL: Box = { x: 22, y: 22, w: 56, h: 60 };

export function boxOf(spot: Spot, type: string): Box {
  const base = spot === 'top' && coversBottom(type) ? FULL : BOXES[spot];
  return { ...base, ...SIZES[type] };
}

// What the dressing room knows about a piece of clothing.
export interface DressItem {
  id: string;
  type: string;
  image?: string;
  thumb?: string;
  occasions: string[];
  material?: string;
  season: string[];
  lastWorn?: string | null;
}

export type Outfit = Partial<Record<Spot, string | null>>;

// A day's weather, as Shuffle reads it.
export type Warmth = 'hot' | 'cold' | 'mild';

export function warmthOf(day: Pick<DayForecast, 'temp_max'> | null | undefined): Warmth {
  if (!day) return 'mild';
  if (day.temp_max >= 28) return 'hot';
  if (day.temp_max <= 14) return 'cold';
  return 'mild';
}

const WARM_TYPES = new Set(['coat', 'sweater', 'hoodie', 'sweatshirt', 'cardigan', 'poncho', 'boots']);
const WARM_MATERIALS = ['wool', 'cashmere', 'fleece', 'velvet', 'tweed', 'corduroy'];

// Clothes for cold days: warm kinds, warm materials, or tagged for winter only.
export function isWarm(item: Pick<DressItem, 'type' | 'material' | 'season'>): boolean {
  if (WARM_TYPES.has(item.type)) return true;
  const material = (item.material ?? '').toLowerCase();
  if (WARM_MATERIALS.some((word) => material.includes(word))) return true;
  return item.season.length > 0 && item.season.every((season) => season === 'winter');
}

export function piecesFor(items: DressItem[], spot: Spot): DressItem[] {
  return items.filter((item) => spotOf(item.type) === spot);
}

// The pieces Shuffle may choose for a place: the occasion's if it has any, nothing warm on a hot
// day, and on a cold day the warm layers first. The ones not worn for longest come first.
export function choices(items: DressItem[], spot: Spot, occasion: string | null, warmth: Warmth): DressItem[] {
  let list = piecesFor(items, spot);
  if (occasion) {
    const matching = list.filter((item) => item.occasions.includes(occasion));
    if (matching.length) list = matching;
  }
  if (warmth === 'hot') {
    const light = list.filter((item) => !isWarm(item));
    if (light.length) list = light;
  }
  if (warmth === 'cold' && spot === 'outer') {
    const warm = list.filter(isWarm);
    if (warm.length) list = warm;
  }
  return [...list].sort((a, b) => (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''));
}

// One of the least recently worn half, so the whole wardrobe gets its turn.
export function pickOne(list: DressItem[], random: () => number = Math.random): DressItem | null {
  if (!list.length) return null;
  const pool = list.slice(0, Math.max(1, Math.ceil(list.length / 2)));
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}

// Shuffle: new pieces for every unlocked place. A coat goes on only when it's cold and comes
// off when it's hot; jewellery and accessories change only where one is worn.
export function shuffleOutfit(
  outfit: Outfit,
  items: DressItem[],
  {
    locked,
    occasion,
    warmth,
    random = Math.random,
  }: { locked: ReadonlySet<Spot>; occasion: string | null; warmth: Warmth; random?: () => number }
): Outfit {
  const next: Outfit = { ...outfit };
  const typeOf = (id: string | null | undefined) => items.find((item) => item.id === id)?.type;
  for (const spot of SPOTS) {
    if (locked.has(spot)) continue;
    if (spot === 'outer') {
      if (warmth === 'hot') next.outer = null;
      else if (warmth === 'cold' || outfit.outer) next.outer = pickOne(choices(items, spot, occasion, warmth), random)?.id ?? null;
      continue;
    }
    if (spot === 'bottom') continue;
    if (!ALWAYS.includes(spot) && !outfit[spot]) continue;
    next[spot] = pickOne(choices(items, spot, occasion, warmth), random)?.id ?? outfit[spot] ?? null;
  }
  // The bottom follows the top: none under a saree or dress, one again under a shirt or kurti.
  const top = typeOf(next.top);
  if (!locked.has('bottom')) {
    next.bottom = top && coversBottom(top) ? null : (pickOne(choices(items, 'bottom', occasion, warmth), random)?.id ?? null);
  }
  return next;
}

// The outfit the dressing room starts with: the pieces already chosen, one per place.
export function dressWith(items: Pick<DressItem, 'id' | 'type'>[]): Outfit {
  const outfit: Outfit = {};
  for (const item of items) {
    const spot = spotOf(item.type);
    if (spot && !outfit[spot]) outfit[spot] = item.id;
  }
  return outfit;
}

// The pieces on the figure, in the order they are drawn, leaving out a bottom under a long piece.
export function worn(outfit: Outfit, items: DressItem[]): { spot: Spot; item: DressItem }[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const top = outfit.top ? byId.get(outfit.top) : undefined;
  const full = !!top && coversBottom(top.type);
  return SPOTS.flatMap((spot) => {
    if (spot === 'bottom' && full) return [];
    const item = outfit[spot] ? byId.get(outfit[spot]!) : undefined;
    return item ? [{ spot, item }] : [];
  });
}

// The settings each person picks for the room. "auto" follows the app's light or dark mode.
export const ROOM_BACKGROUNDS = ['auto', '#ffffff', '#f6f1e7', '#e9ecea', '#dfe7e2', '#111316'] as const;
export const FIGURE_COLOURS = ['auto', '#e3e6e5', '#eddcc8', '#a47e5f', '#5f6664', '#ffffff'] as const;

export const COLOUR_NAMES: Record<string, string> = {
  auto: 'sameAsApp',
  '#ffffff': 'white',
  '#f6f1e7': 'cream',
  '#e9ecea': 'lightGrey',
  '#dfe7e2': 'sage',
  '#111316': 'black',
  '#e3e6e5': 'lightGrey',
  '#eddcc8': 'beige',
  '#a47e5f': 'brown',
  '#5f6664': 'darkGrey',
};

export function resolveColours(
  background: string,
  figureColour: string,
  dark: boolean
): { background: string; figure: string; darkGround: boolean } {
  const ground = background === 'auto' ? (dark ? '#121417' : '#ffffff') : background;
  const figure = figureColour === 'auto' ? (dark ? '#2c3236' : '#e3e6e5') : figureColour;
  return { background: ground, figure, darkGround: isDark(ground) };
}

export function isDark(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}
