// The screens reached from the More tab. On a phone they show a "back to More" button instead
// of the bottom bar's own tab, and the More tab stays lit while one is open.
export const MORE_HREF = '/dashboard/more';

const REACHED_FROM_MORE = [
  MORE_HREF,
  '/dashboard/settings',
  '/dashboard/notifications',
  '/dashboard/family',
  '/dashboard/analytics',
  '/dashboard/history',
];

export function isReachedFromMore(pathname: string): boolean {
  return REACHED_FROM_MORE.some((route) => pathname === route || pathname.startsWith(route + '/'));
}
