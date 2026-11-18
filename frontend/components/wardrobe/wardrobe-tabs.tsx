'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useHomes } from '@/lib/hooks/use-homes';
import { AppTopBar } from './app-top-bar';

export const WARDROBE_TABS = ['clothes', 'lookbook', 'collections'] as const;
export type WardrobeTab = (typeof WARDROBE_TABS)[number];

export function useWardrobeTab(): WardrobeTab {
  const tab = useSearchParams().get('tab');
  return (WARDROBE_TABS as readonly string[]).includes(tab ?? '') ? (tab as WardrobeTab) : 'clothes';
}

// Each tab is its own link so the phone's back button and a shared link land on the same tab.
// Leaving Clothes drops its filters from the address; they are for the clothes grid only.
export function tabHref(tab: WardrobeTab): string {
  return tab === 'clothes' ? '/dashboard/wardrobe' : `/dashboard/wardrobe?tab=${tab}`;
}

export function WardrobeTabs({ value }: { value: WardrobeTab }) {
  const t = useTranslations('wardrobe.closet.tabs');
  return (
    <nav aria-label={t('label')} className="grid grid-cols-3 rounded-full bg-muted p-1">
      {WARDROBE_TABS.map((tab) => {
        const active = tab === value;
        return (
          <Link
            key={tab}
            href={tabHref(tab)}
            aria-current={active ? 'page' : undefined}
            scroll={false}
            className={`flex h-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(tab)}
          </Link>
        );
      })}
    </nav>
  );
}

// The heading of the Lookbook and Collections tabs, which have no home or filter buttons.
export function WardrobeTabHeading({
  tab,
  action,
}: {
  tab: WardrobeTab;
  action?: React.ReactNode;
}) {
  const t = useTranslations('wardrobe');
  const { data: homes } = useHomes();
  return (
    <div className="space-y-3">
      <AppTopBar homes={homes ?? []}>{action}</AppTopBar>
      <h1 className="sr-only">{t('closet.header.title')}</h1>
      <WardrobeTabs value={tab} />
    </div>
  );
}
