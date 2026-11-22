// When the wardrobe is switched to another home for a stay, remember the home it came from,
// so the morning after the stay the app can offer to switch back. Kept on this phone.
const KEY = 'trip-return';

export interface TripReturn {
  from: string; // the home before the trip
  to: string; // the home switched to for the stay
  stayId: string;
}

export function rememberTrip(trip: TripReturn): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    // Without storage the app simply does not offer the way back.
  }
}

export function tripToReturnFrom(): TripReturn | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TripReturn) : null;
  } catch {
    return null;
  }
}

export function forgetTrip(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

// The trip is over (its last day has passed, or it was removed) while the wardrobe still
// shows the home switched to for it.
export function isBackFrom(
  trip: TripReturn | null,
  today: string,
  stays: { id: string; end_date: string }[] | undefined,
  currentHomeId: string | undefined
): boolean {
  if (!trip || !stays || currentHomeId !== trip.to) return false;
  const stay = stays.find((entry) => entry.id === trip.stayId);
  return !stay || stay.end_date < today;
}
