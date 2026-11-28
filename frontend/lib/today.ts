import { isWarm, type Warmth } from '@/lib/dressing-room';
import type { Outfit } from '@/lib/hooks/use-outfits';
import type { Item } from '@/lib/types';

// Which saved looks the Today card offers for a swap: every piece is in this home, none
// waits for a wash or is away being cleaned, nothing warm on a hot day, and on a cold day the
// looks with something warm first. Looks worn least recently come first.
export function lookChoices(
  looks: Outfit[],
  homeItems: Map<string, Item>,
  away: ReadonlySet<string>,
  warmth: Warmth,
  skipId?: string
): Outfit[] {
  const ready = looks.filter((look) => {
    if (look.id === skipId || look.items.length === 0) return false;
    return look.items.every((piece) => {
      const item = homeItems.get(piece.id);
      if (!item || item.needs_wash || away.has(item.id)) return false;
      return !(warmth === 'hot' && isWarm(warmthOf(item)));
    });
  });
  const lastWorn = (look: Outfit) =>
    look.items.reduce((latest, piece) => {
      const worn = homeItems.get(piece.id)?.last_worn_at ?? '';
      return worn > latest ? worn : latest;
    }, '');
  const warm = (look: Outfit) => look.items.some((piece) => isWarm(warmthOf(homeItems.get(piece.id)!)));
  return [...ready].sort((a, b) => {
    if (warmth === 'cold' && warm(a) !== warm(b)) return warm(a) ? -1 : 1;
    return lastWorn(a).localeCompare(lastWorn(b));
  });
}

function warmthOf(item: Item) {
  return { type: item.type, material: item.tags?.material, season: item.tags?.season ?? [] };
}
