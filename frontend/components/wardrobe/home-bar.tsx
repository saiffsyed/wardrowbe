'use client';

import Link from 'next/link';
import { Check, ChevronDown, MapPin, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/api';
import { useSetCurrentHome } from '@/lib/hooks/use-homes';
import type { Home } from '@/lib/types';
import { HomeWeather } from './home-weather';

export type HomeScope = 'here' | 'all';

export const HOMES_SETTINGS_HREF = '/dashboard/settings#homes';

// Says which home the person is in and lets them say they have moved. With no homes yet it is
// the way in to setting them up.
// compact: the version in the top bar, without the pin and arrow, so it fits between the name
// and the buttons on a phone.
export function HomePill({ homes, compact = false }: { homes: Home[]; compact?: boolean }) {
  const t = useTranslations('wardrobe.closet.homes');
  const setCurrent = useSetCurrentHome();
  const current = homes.find((home) => home.is_current);
  const pill = `flex min-w-0 items-center gap-1.5 rounded-full border bg-card font-semibold transition-colors hover:bg-accent hover:text-accent-foreground ${
    compact ? 'h-9 gap-1 px-2.5 text-sm' : 'h-11 pl-2.5 pr-3.5 text-[15px]'
  }`;

  if (homes.length === 0) {
    return (
      <Link href={HOMES_SETTINGS_HREF} className={pill}>
        <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">{t('setUp')}</span>
      </Link>
    );
  }

  const switchTo = (home: Home) => {
    if (home.is_current) return;
    setCurrent.mutate(home.id, {
      onError: (error) => toast.error(getErrorMessage(error, t('errors.saveFailed'))),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={pill}
          disabled={setCurrent.isPending}
          aria-label={current ? t('youAreIn', { home: current.name }) : t('noHome')}
        >
          {!compact && <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
          <span className="truncate">{current ? current.name : t('noHome')}</span>
          {current && <HomeWeather />}
          {!compact && <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        {homes.map((home) => (
          <DropdownMenuItem key={home.id} onSelect={() => switchTo(home)} className="gap-2">
            <Check className={`h-4 w-4 ${home.is_current ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
            <span className="flex-1 truncate">{home.name}</span>
            <span className="text-xs text-muted-foreground">{home.city}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild className="gap-2">
          <Link href={HOMES_SETTINGS_HREF}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            {t('manage')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Chooses between the clothes that are on hand and the whole wardrobe. Only there once the
// person has said which home they are in.
export function HomeScopeToggle({
  homes,
  scope,
  onScopeChange,
}: {
  homes: Home[];
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
}) {
  const t = useTranslations('wardrobe.closet.homes');
  if (!homes.some((home) => home.is_current)) return null;

  return (
    <div role="group" aria-label={t('scopeLabel')} className="flex shrink-0 rounded-full bg-muted p-[3px]">
      {(['here', 'all'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={scope === value}
          onClick={() => onScopeChange(value)}
          className={`h-[38px] rounded-full px-3.5 text-sm font-semibold transition-colors ${
            scope === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {value === 'here' ? t('here') : t('everywhere')}
        </button>
      ))}
    </div>
  );
}

// This home / All homes, as the first choice in the wardrobe's filter panel.
export function HomesFilter(props: {
  homes: Home[];
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
}) {
  const t = useTranslations('wardrobe.closet.homes');
  if (!props.homes.some((home) => home.is_current)) return null;
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-sm font-medium">{t('filterLabel')}</span>
      <HomeScopeToggle {...props} />
    </div>
  );
}
