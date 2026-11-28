import type { Outfit } from '@/lib/hooks/use-outfits';

// The stage a look is in, from fields that are stored separately:
//   template  a saved Lookbook look (no day)          scheduled_for = null
//   planned   put on a day, not worn yet              scheduled_for = day
//   worn      worn (on its day)                       feedback.worn_at set
//   declined  a suggestion turned down                status = rejected
// The server refuses to mark a template worn (it is worn through a dated copy) and to
// change a worn look.
export type LookPhase = 'template' | 'planned' | 'worn' | 'declined';

export function lookPhase(outfit: Pick<Outfit, 'scheduled_for' | 'status' | 'feedback'>): LookPhase {
  if (outfit.feedback?.worn_at) return 'worn';
  if (outfit.status === 'rejected') return 'declined';
  return outfit.scheduled_for ? 'planned' : 'template';
}

// The look to show for a day: the one worn, then one chosen (not a waiting suggestion),
// then the newest.
export function lookForDay(outfits: Outfit[] | undefined, day: string): Outfit | undefined {
  const onDay = (outfits ?? []).filter((outfit) => outfit.scheduled_for === day && lookPhase(outfit) !== 'declined');
  return (
    onDay.find((outfit) => lookPhase(outfit) === 'worn') ??
    onDay.find((outfit) => outfit.status !== 'pending') ??
    onDay[0]
  );
}
