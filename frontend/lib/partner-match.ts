import { coversBottom, isWarm, spotOf, type Warmth } from '@/lib/dressing-room';
import type { Outfit } from '@/lib/hooks/use-outfits';
import type { Item } from '@/lib/types';
import { wadaPairing, wadaStrength } from '@/lib/wada';

// "Match with partner": which of your looks go with your partner's, by fixed rules (no AI).
// Each look gets a score; the best three saved looks are offered, then one new look put
// together from your clothes by the same rules.
//
//   1. Occasion   the same occasion scores most, the same kind of day (dressed up, work,
//                 casual, sport) a little less; other kinds are left out while any match.
//   2. Colours    after Sanzo Wada's dictionary (lib/wada.ts). "Go with" (default): colours
//                 Wada often combines score high, neutrals go with anything, colours he
//                 never combines lose. "Twin": the same colour family wins.
//   3. Patterns   one patterned and one plain is best; two busy patterns lose points.
//   4. Indian     with a saree, lehenga or the like on one side, Indian wear on the other
//                 is preferred (not required: mixing is still offered).
//   5. Practical  only clothes in this home, clean and right for the weather (lib/today.ts
//                 filters the saved looks the same way).
export type MatchStyle = 'go' | 'twin';

export type MatchReason =
  | { kind: 'pair'; mine: string; theirs: string; wada?: { id: number; hexes: string[] } }
  | { kind: 'neutral'; mine: string }
  | { kind: 'twin'; colour: string }
  | { kind: 'indian' }
  | { kind: 'occasion' };

export interface Match {
  look: Outfit | null; // null for the new look made from your clothes
  itemIds: string[];
  score: number;
  reason: MatchReason;
}

export interface PartnerLook {
  occasion: string;
  items: { id: string; type: string; primary_color: string | null; colors: string[] }[];
  item_patterns?: Record<string, string>;
}

const NEUTRALS = new Set(['white', 'cream', 'beige', 'gray', 'black', 'navy', 'tan', 'silver', 'gold']);
const FAMILY: Record<string, string> = {
  pink: 'pink',
  red: 'red',
  burgundy: 'red',
  orange: 'orange',
  yellow: 'yellow',
  gold: 'yellow',
  green: 'green',
  olive: 'green',
  blue: 'blue',
  'light-blue': 'blue',
  navy: 'blue',
  purple: 'purple',
  brown: 'brown',
  tan: 'brown',
  beige: 'brown',
  cream: 'white',
  white: 'white',
  gray: 'gray',
  silver: 'gray',
  black: 'black',
};
// Colour pairs come from Sanzo Wada's "A Dictionary of Color Combinations" (lib/wada.ts).
const STRONG = 0.15; // Wada pairs these often
const FAIR = 0.08; // …now and then
const NEVER = 0.04; // (almost) never together: two such colours fight

function clashes(a: string, b: string): boolean {
  return !!a && !!b && a !== b && !NEUTRALS.has(a) && !NEUTRALS.has(b) && FAMILY[a] !== FAMILY[b] && wadaStrength(a, b) < NEVER;
}

const OCCASION_KIND: Record<string, string> = {
  wedding: 'dressy', party: 'dressy', formal: 'dressy', dinner: 'dressy', date: 'dressy',
  work: 'work', office: 'work', 'business-casual': 'work', interview: 'work', 'smart-casual': 'work',
  casual: 'casual', weekend: 'casual', brunch: 'casual', lounge: 'casual', beach: 'casual',
  travel: 'casual', outdoor: 'casual',
  gym: 'sport', running: 'sport', sport: 'sport', sporty: 'sport', hiking: 'sport',
};
const kindOf = (occasion: string) => OCCASION_KIND[occasion] ?? 'casual';

const INDIAN = new Set([
  'saree', 'lehenga', 'anarkali', 'half-saree', 'salwar-kameez', 'kurta', 'kurti', 'sherwani', 'dhoti',
  'churidar', 'patiala', 'sharara',
]);

// The colours that matter in a look: each clothing piece's main colour (jewellery and the
// like are left out).
function mainColours(items: { type: string; primary_color?: string | null; colors?: string[] }[]): string[] {
  return Array.from(
    new Set(
      items
        .filter((item) => ['top', 'bottom', 'outer'].includes(spotOf(item.type) ?? ''))
        .map((item) => item.primary_color ?? item.colors?.[0])
        .filter((colour): colour is string => !!colour)
    )
  );
}

interface ColourResult {
  score: number;
  reason: MatchReason | null;
}

export function colourScore(mine: string[], theirs: string[], style: MatchStyle): ColourResult {
  let score = 0;
  let reason: MatchReason | null = null;
  let best = -Infinity;
  for (const a of mine) {
    for (const b of theirs) {
      const strength = wadaStrength(a, b);
      const sameFamily = !!FAMILY[a] && FAMILY[a] === FAMILY[b];
      let points = 0;
      let why: MatchReason | null = null;
      if (clashes(a, b)) points = -3;
      else if (style === 'twin') {
        if (sameFamily) [points, why] = [4, { kind: 'twin', colour: b }];
        else if (strength >= STRONG) points = 1;
      } else if (strength >= STRONG || (strength >= FAIR && !sameFamily)) {
        const combination = wadaPairing(a, b).combination;
        points = strength >= STRONG ? 3 : 2;
        why = { kind: 'pair', mine: a, theirs: b, wada: combination };
      } else if (NEUTRALS.has(a) && !NEUTRALS.has(b)) [points, why] = [1, { kind: 'neutral', mine: a }];
      else if (NEUTRALS.has(a) || NEUTRALS.has(b)) points = 1;
      score += points;
      if (why && points > best) {
        best = points;
        reason = why;
      }
    }
  }
  return { score, reason };
}

const busy = (pattern: string | undefined | null) => !!pattern && pattern !== 'solid';

function patternScore(myPatterns: (string | undefined)[], theirPatterns: string[]): number {
  const mineBusy = myPatterns.some(busy);
  const theirsBusy = theirPatterns.some(busy);
  if (mineBusy && theirsBusy) return -2;
  return mineBusy !== theirsBusy ? 1 : 0;
}

function scoreLook(
  items: { id: string; type: string; primary_color?: string | null; colors?: string[] }[],
  occasion: string,
  partner: PartnerLook,
  style: MatchStyle,
  patternOf: (id: string) => string | undefined
): { score: number; reason: MatchReason; clash: boolean } {
  let score = 0;
  if (occasion === partner.occasion) score += 5;
  else if (kindOf(occasion) === kindOf(partner.occasion)) score += 3;
  const colours = colourScore(mainColours(items), mainColours(partner.items), style);
  score += colours.score;
  score += patternScore(
    items.map((item) => patternOf(item.id)),
    Object.values(partner.item_patterns ?? {})
  );
  const indianBoth = items.some((item) => INDIAN.has(item.type)) && partner.items.some((item) => INDIAN.has(item.type));
  if (indianBoth) score += 3;
  const reason: MatchReason = colours.reason ?? (indianBoth ? { kind: 'indian' } : { kind: 'occasion' });
  return { score, reason, clash: colours.score < 0 };
}

// The saved looks that go best with the partner's, from looks already checked as practical
// (lib/today.ts lookChoices).
export function matchSavedLooks(
  looks: Outfit[],
  partner: PartnerLook,
  style: MatchStyle,
  myItems: Map<string, Item>,
  limit = 3
): Match[] {
  const sameKind = looks.filter((look) => kindOf(look.occasion) === kindOf(partner.occasion));
  const pool = sameKind.length ? sameKind : looks;
  return pool
    .map((look) => {
      const items = look.items.map((piece) => ({ ...piece, colors: piece.colors ?? [] }));
      const { score, reason, clash } = scoreLook(items, look.occasion, partner, style, (id) => myItems.get(id)?.tags?.pattern);
      return { look, itemIds: look.items.map((piece) => piece.id), score, reason, clash };
    })
    // Colours that fight theirs are never offered, however well the rest fits.
    .filter((match) => !match.clash && match.score > 0)
    .map(({ clash: _clash, ...match }) => match)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// One new look from your clothes: the best top for the partner's look, a bottom that goes
// with both (none under a saree or dress) and shoes, all clean, in this home and fit for the
// weather.
export function makeMatchingLook(
  items: Item[],
  away: ReadonlySet<string>,
  partner: PartnerLook,
  style: MatchStyle,
  warmth: Warmth
): Match | null {
  const ready = items.filter((item) => {
    if (item.needs_wash || away.has(item.id) || item.is_archived) return false;
    const warm = isWarm({ type: item.type, material: item.tags?.material, season: item.tags?.season ?? [] });
    return !(warmth === 'hot' && warm);
  });
  const theirKind = kindOf(partner.occasion);
  const fits = (item: Item) => {
    const occasions = item.tags?.occasions ?? [];
    return !occasions.length || occasions.some((occasion) => kindOf(occasion) === theirKind);
  };
  const of = (spot: string) => ready.filter((item) => spotOf(item.type) === spot && fits(item));
  const best = (candidates: Item[], alongside: Item[]) =>
    candidates
      .map((item) => ({
        item,
        ...scoreLook([...alongside, item], partner.occasion, partner, style, (id) => ready.find((entry) => entry.id === id)?.tags?.pattern),
      }))
      .sort((a, b) => b.score - a.score)[0];

  const top = best(of('top'), []);
  if (!top) return null;
  const chosen = [top.item];
  if (!coversBottom(top.item.type)) {
    const bottom = best(
      of('bottom').filter((item) => !clashes(item.primary_color ?? '', top.item.primary_color ?? '')),
      chosen
    );
    if (!bottom) return null;
    chosen.push(bottom.item);
  }
  const shoes = of('feet').sort((a, b) => Number(NEUTRALS.has(b.primary_color ?? '')) - Number(NEUTRALS.has(a.primary_color ?? '')))[0];
  if (shoes) chosen.push(shoes);
  const final = scoreLook(chosen, partner.occasion, partner, style, (id) => ready.find((entry) => entry.id === id)?.tags?.pattern);
  return { look: null, itemIds: chosen.map((item) => item.id), score: final.score, reason: final.reason };
}
