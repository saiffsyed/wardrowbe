import WADA from '@/lib/data/wada-colors.json';

// Colour pairing after Sanzo Wada's "A Dictionary of Color Combinations" (data and licence in
// lib/data). Clothes are tagged with one of the app's colour names; each name stands for a
// few nearby Wada shades, and two names go together as often as Wada put those shades in the
// same combination.
interface WadaColour {
  name: string;
  hex: string;
  lab: number[];
  combinations: number[];
}

const COLOURS = WADA as WadaColour[];

// A typical shade for each colour name the app uses.
export const APP_COLOUR_HEX: Record<string, string> = {
  beige: '#d8c3a5',
  black: '#1c1c1c',
  blue: '#2f6db5',
  brown: '#7b4a2a',
  burgundy: '#7a1f35',
  cream: '#efe6cf',
  gold: '#c9a227',
  gray: '#9a9b9c',
  green: '#2e7d4f',
  'light-blue': '#9cc7e8',
  navy: '#1b2a4a',
  olive: '#6b6b2e',
  orange: '#e07a2b',
  pink: '#e88aa8',
  purple: '#6c3f99',
  red: '#c62a2f',
  silver: '#c0c4c8',
  tan: '#c9a27a',
  white: '#ffffff',
  yellow: '#e9c93a',
};

function toLab(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  const linear = [n >> 16, (n >> 8) & 255, n & 255].map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = linear;
  const xyz = [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const NEAR = 6; // Wada shades that stand for one colour name
const NEAR_LIMIT = 22; // …as long as they are this close (colour difference)

const nearCache = new Map<string, WadaColour[]>();
export function wadaShades(colour: string): WadaColour[] {
  const hex = APP_COLOUR_HEX[colour];
  if (!hex) return [];
  const cached = nearCache.get(colour);
  if (cached) return cached;
  const lab = toLab(hex);
  const ranked = COLOURS.map((entry) => ({ entry, d: distance(lab, entry.lab) })).sort((a, b) => a.d - b.d);
  const near = ranked.filter((r, i) => i === 0 || (i < NEAR && r.d < NEAR_LIMIT)).map((r) => r.entry);
  nearCache.set(colour, near);
  return near;
}

export interface WadaPairing {
  // How many of Wada's combinations hold a shade of each colour.
  count: number;
  // The first such combination, to show: its number and colours.
  combination?: { id: number; hexes: string[] };
}

const pairCache = new Map<string, WadaPairing>();
export function wadaPairing(a: string, b: string): WadaPairing {
  const key = [a, b].sort().join('+');
  const cached = pairCache.get(key);
  if (cached) return cached;
  const shared = new Set<number>();
  const inA = new Set(wadaShades(a).flatMap((shade) => shade.combinations));
  for (const shade of wadaShades(b)) for (const id of shade.combinations) if (inA.has(id)) shared.add(id);
  const first = Array.from(shared).sort((x, y) => x - y)[0];
  const result: WadaPairing = {
    count: shared.size,
    combination: first === undefined ? undefined : { id: first, hexes: combinationHexes(first) },
  };
  pairCache.set(key, result);
  return result;
}

export function combinationHexes(id: number): string[] {
  return COLOURS.filter((entry) => entry.combinations.includes(id)).map((entry) => entry.hex);
}

// How strongly Wada pairs two colours, fairly for colours he used often or rarely: the shared
// combinations against how often each appears at all (0 = never together, 1 = always).
export function wadaStrength(a: string, b: string): number {
  if (a === b) return 1;
  const own = (c: string) => wadaPairing(c, c).count;
  const total = Math.sqrt(own(a) * own(b));
  return total ? wadaPairing(a, b).count / total : 0;
}
