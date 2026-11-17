'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { OutfitCard } from '@/components/outfits/outfit-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteOutfits } from '@/lib/hooks/use-outfits';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { WardrobeTabHeading } from './wardrobe-tabs';

// Saved looks: outfits kept to wear again, not tied to a day (upstream's "lookbook" outfits).
export function LookbookTab() {
  const t = useTranslations('wardrobe.closet.lookbook');
  const query = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  const outfits = query.data?.pages.flatMap((page) => page.outfits) ?? [];
  const total = query.data?.pages[0]?.total;

  return (
    <div className="space-y-4">
      <WardrobeTabHeading
        tab="lookbook"
        subtitle={total !== undefined ? t('count', { count: total }) : undefined}
        action={
          <Button asChild className="h-11 shrink-0 rounded-full">
            <Link href="/dashboard/outfits/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('new')}
            </Link>
          </Button>
        }
      />

      {query.isError ? (
        <p className="py-8 text-center text-destructive">{t('loadError')}</p>
      ) : query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4] rounded-lg" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {outfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
