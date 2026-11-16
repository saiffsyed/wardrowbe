'use client';

import { AccountBar } from '@/components/wardrobe/account-bar';

// The top bar of wide screens. Phones have none: there the side menu is opened from each
// page's own header, and the account controls sit at the foot of that menu.
export function Header() {
  return (
    <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center justify-end border-b bg-card px-8 lg:flex">
      <AccountBar />
    </header>
  );
}
