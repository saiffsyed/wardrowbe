// Where a piece is in the laundry: one of four states, mirroring
// backend/app/services/laundry_service.py. "dirty" is the item's own needs_wash flag;
// "washing" and "dry_cleaning" come from /laundry/states.
export type Laundry = 'clean' | 'dirty' | 'washing' | 'dry_cleaning';
export type LaundryMove = 'wash' | 'dry' | 'back';

const ROW_STATE: Record<string, Laundry> = { wash: 'washing', dry: 'dry_cleaning' };

export function laundryOf(needsWash: boolean, rowState: string | undefined | null): Laundry {
  if (rowState && ROW_STATE[rowState]) return ROW_STATE[rowState];
  return needsWash ? 'dirty' : 'clean';
}

// The moves each state allows; the server applies the same table.
export const ALLOWED: Record<LaundryMove, readonly Laundry[]> = {
  wash: ['clean', 'dirty', 'dry_cleaning'],
  dry: ['clean', 'dirty', 'washing'],
  back: ['washing', 'dry_cleaning'],
};

export function canMove(state: Laundry, to: LaundryMove): boolean {
  return ALLOWED[to].includes(state);
}

export function isAway(state: Laundry): boolean {
  return state === 'washing' || state === 'dry_cleaning';
}
