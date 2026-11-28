'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MobileMenuContext = createContext<() => void>(() => {});

// Phones have no top bar, so the button that opens the side menu lives inside each page's own
// header. This hands those buttons the way to open it.
export function MobileMenuProvider({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return <MobileMenuContext.Provider value={onOpen}>{children}</MobileMenuContext.Provider>;
}

export function MobileMenuButton() {
  const open = useContext(MobileMenuContext);
  const t = useTranslations('nav');

  return (
    <button
      type="button"
      aria-label={t('openSidebar')}
      onClick={open}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
