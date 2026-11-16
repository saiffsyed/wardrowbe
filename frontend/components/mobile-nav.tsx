'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Layers, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAiRoute } from '@/lib/ai-routes';
import { useAiUiEnabled } from '@/lib/hooks/use-features';
import { useTranslations } from 'next-intl';

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const aiUiEnabled = useAiUiEnabled();

  // Three places, as in the agreed design. Everything else (settings, history, analytics and
  // the rest) is in the side menu behind the top-left button.
  const navigation = [
    { name: t('wardrobe'), href: '/dashboard/wardrobe', icon: Shirt },
    { name: t('outfits'), href: '/dashboard/outfits', icon: Layers },
    { name: t('plan'), href: '/dashboard', icon: CalendarDays },
  ].filter((item) => aiUiEnabled || !isAiRoute(item.href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
      <div className="grid h-[4.5rem] grid-cols-3">
        {navigation.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs',
                isActive
                  ? 'font-bold text-primary'
                  : 'font-semibold text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-6 w-6" aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
