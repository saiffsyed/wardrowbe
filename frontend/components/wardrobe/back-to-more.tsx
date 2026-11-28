'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MORE_HREF } from '@/lib/more-routes';

// The way back from a screen opened from the More tab. Phones only: wide screens keep the side
// menu, which is always in view.
export function BackToMore() {
  const t = useTranslations('wardrobe.closet.more');
  return (
    <Link
      href={MORE_HREF}
      className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-semibold text-foreground hover:bg-accent lg:hidden"
    >
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      {t('back')}
    </Link>
  );
}
