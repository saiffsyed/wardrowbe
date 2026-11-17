'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  ChevronRight,
  History,
  Home as HomeIcon,
  LayoutList,
  MonitorSmartphone,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/hooks/use-auth';
import { MORE_HREF } from '@/lib/more-routes';

interface Entry {
  key: string;
  href: string;
  icon: LucideIcon;
}

// Shown as tiles: places to look at the wardrobe from another side.
const FEATURES: Entry[] = [
  { key: 'insights', href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'history', href: '/dashboard/history', icon: History },
  { key: 'family', href: '/dashboard/family', icon: Users },
];

// Shown as a list: things set once and rarely changed.
const SETTINGS: Entry[] = [
  { key: 'homes', href: `${MORE_HREF}/homes`, icon: HomeIcon },
  { key: 'categories', href: `${MORE_HREF}/categories`, icon: LayoutList },
  { key: 'display', href: `${MORE_HREF}/display`, icon: MonitorSmartphone },
  { key: 'preferences', href: '/dashboard/settings', icon: SlidersHorizontal },
  { key: 'notifications', href: '/dashboard/notifications', icon: Bell },
  { key: 'account', href: `${MORE_HREF}/account`, icon: UserRound },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Everything that is not the wardrobe, outfits or the plan: who you are, a few other views of
// the wardrobe, and settings, each opening a screen of its own.
export function MoreScreen() {
  const t = useTranslations('wardrobe.closet.more');
  const tNav = useTranslations('nav');
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{t('title')}</h1>

      <Link
        href={`${MORE_HREF}/account`}
        className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/50"
      >
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarImage src={user?.avatar_url || ''} alt="" />
          <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
            {initialsOf(user?.display_name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{user?.display_name || tNav('userFallback')}</span>
          {user?.email && <span className="block truncate text-sm text-muted-foreground">{user.email}</span>}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('features')}</h2>
        <ul className="grid grid-cols-2 gap-3">
          {FEATURES.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex h-full min-h-[7.5rem] flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{t(`items.${key}.title`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`items.${key}.hint`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('settings')}</h2>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {SETTINGS.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-[3.5rem] items-center gap-4 px-4 py-2 transition-colors hover:bg-accent/50"
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{t(`items.${key}.title`)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
