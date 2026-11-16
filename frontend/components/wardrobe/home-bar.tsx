'use client';

import Link from 'next/link';
import { Check, ChevronDown, MapPin, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/api';
import { useSetCurrentHome } from '@/lib/hooks/use-homes';
import type { Home } from '@/lib/types';

export type HomeScope = 'here' | 'all';

export const HOMES_SETTINGS_HREF = '/dashboard/settings#homes';

// Says which home the person is in, lets them say they have moved, and chooses between the
// clothes that are on hand and the whole wardrobe.
export function HomeBar({
  homes,
  scope,
  onScopeChange,
}: {
  homes: Home[];
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
}) {
  const t = useTranslations('wardrobe.closet.homes');
  const setCurrent = useSetCurrentHome();
  const current = homes.find((home) => home.is_current);

  if (homes.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">{t('setUpHint')}</span>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={HOMES_SETTINGS_HREF}>{t('setUp')}</Link>
        </Button>
      </div>
    );
  }

  const switchTo = (home: Home) => {
    if (home.is_current) return;
    setCurrent.mutate(home.id, {
      onError: (error) => toast.error(getErrorMessage(error, t('errors.saveFailed'))),
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" disabled={setCurrent.isPending}>
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="max-w-[12rem] truncate">
              {current ? t('youAreIn', { home: current.name }) : t('noHome')}
            </span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[14rem]">
          {homes.map((home) => (
            <DropdownMenuItem key={home.id} onSelect={() => switchTo(home)} className="gap-2">
              <Check
                className={`h-4 w-4 ${home.is_current ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden="true"
              />
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

      {current && (
        <div role="group" aria-label={t('scopeLabel')} className="flex rounded-full bg-muted p-0.5">
          {(['here', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => onScopeChange(value)}
              className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${
                scope === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {value === 'here' ? t('here') : t('everywhere')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
