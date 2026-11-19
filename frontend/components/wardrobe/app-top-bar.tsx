'use client';

import type { Home } from '@/lib/types';
import { APP_NAME } from '@/lib/app-name';
import { HomePill } from './home-bar';

// A stand-in logo: a clothes hanger, until the real one is chosen.
function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0 text-primary" aria-hidden="true">
      <path
        d="M16 7.5a2.5 2.5 0 1 1 2.5 2.5c-1.2 0-2.5.8-2.5 2.2v1.3m0 0L4.6 21.4c-1 .7-.5 2.3.8 2.3h21.2c1.3 0 1.8-1.6.8-2.3L16 13.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The top row of the wardrobe screens, like the Fits app's: logo and name on the left, the home
// you are in with its weather in the middle (tap to switch home), and the screen's own round
// buttons on the right.
export function AppTopBar({ homes, children }: { homes: Home[]; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <div className="flex shrink-0 items-center gap-1">
        <LogoMark />
        <span className="text-[17px] font-extrabold tracking-tight">{APP_NAME}</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <HomePill homes={homes} compact />
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
