// The screen the app opens on, chosen in More → Display. The installed app and a fresh sign-in
// both go to START_PATH, which sends the person on to their choice.
export const START_PATH = '/dashboard/start';

export const START_SCREENS = ['wardrobe', 'lookbook', 'outfits', 'plan'] as const;
export type StartScreen = (typeof START_SCREENS)[number];

const HREF: Record<StartScreen, string> = {
  wardrobe: '/dashboard/wardrobe',
  lookbook: '/dashboard/wardrobe?tab=lookbook',
  outfits: '/dashboard/outfits',
  plan: '/dashboard',
};

export function startHref(screen: string | undefined | null): string {
  return HREF[(START_SCREENS as readonly string[]).includes(screen ?? '') ? (screen as StartScreen) : 'wardrobe'];
}
