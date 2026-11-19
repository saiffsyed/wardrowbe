'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteOutfits } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { LookCard } from './look-tile';
import { piecesOf } from './add-outfit-sheet';
import { useOutfitLayouts } from '@/lib/hooks/use-outfit-layouts';
import { WardrobeTabHeading } from './wardrobe-tabs';

// Saved looks: outfits kept to wear again, not tied to a day (upstream's "lookbook" outfits).
export function LookbookTab() {
  const t = useTranslations('wardrobe.closet.lookbook');
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const query = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  const outfits = query.data?.pages.flatMap((page) => page.outfits) ?? [];
  const { data: layouts } = useOutfitLayouts(outfits.map((outfit) => outfit.id));

  return (
    <div className="space-y-4">
      <WardrobeTabHeading
        tab="lookbook"
        action={
          <Link href="/dashboard/outfits/make" aria-label={t('new')} title={t('new')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />

      {query.isError ? (
        <p className="py-8 text-center text-destructive">{t('loadError')}</p>
      ) : query.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/5] rounded-2xl" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 xl:grid-cols-4">
            {outfits.map((outfit) => (
              <LookCard
                key={outfit.id}
                href={`/dashboard/outfits/${outfit.id}`}
                name={outfitTitle(outfit)}
                occasion={occasionLabel(outfit.occasion)}
                pieces={piecesOf(outfit)}
                arranged={layouts?.get(outfit.id)}
              />
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
