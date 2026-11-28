'use client';

import type { Home } from '@/lib/types';
import { APP_NAME } from '@/lib/app-name';
import { AinaMark } from './aina-logo';
import { HomePill } from './home-bar';

// The top row of the wardrobe screens, like the Fits app's: the logo on the left (no name beside
// it: Saiff's choice, since "Wardrobe" is already on the bottom bar), the home
// you are in with its weather in the middle (tap to switch home), and the screen's own round
// buttons on the right.
export function AppTopBar({ homes, children }: { homes: Home[]; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <div className="flex shrink-0 items-center">
        <AinaMark className="h-[22px] w-[19px]" />
        <span className="sr-only">{APP_NAME}</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <HomePill homes={homes} compact />
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
