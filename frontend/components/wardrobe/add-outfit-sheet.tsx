'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, CloudSun, Loader2, Shirt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api';
import { useInfiniteOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { usePlanDayOutfit } from '@/lib/hooks/use-stays';
import { useCreateStudioOutfit } from '@/lib/hooks/use-studio';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { LookTile } from './look-tile';
import { SHEET_CLASS } from './weather-sheet';

export function piecesOf(outfit: Outfit) {
  return [...outfit.items]
    .sort((a, b) => a.position - b.position)
    .flatMap((item) => {
      const url = item.thumbnail_url ?? item.image_url;
      return url ? [{ type: item.type, url }] : [];
    });
}

const CHOICE =
  'flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-50';

// "+ Add outfit" on a day: one suggested for that day's weather, one from the Lookbook, or a new one.
export function AddOutfitSheet({
  day,
  dayLabel,
  canSuggest,
  open,
  onOpenChange,
}: {
  day: string;
  dayLabel: string;
  canSuggest: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('wardrobe.closet.planner');
  const suggest = usePlanDayOutfit();
  const create = useCreateStudioOutfit();
  const outfitTitle = useOutfitTitle();
  const [picking, setPicking] = useState(false);
  const looks = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  const lookbook = looks.data?.pages.flatMap((page) => page.outfits) ?? [];

  const close = () => {
    setPicking(false);
    onOpenChange(false);
  };
  const done = () => {
    toast.success(t('added', { day: dayLabel }));
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className={SHEET_CLASS}>
        <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <DialogTitle className="flex items-center gap-1 text-base">
          {picking && (
            <button type="button" aria-label={t('back')} onClick={() => setPicking(false)} className="-ml-1 rounded-full p-1 hover:bg-accent">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {picking ? t('pickTitle') : t('addTitle', { day: dayLabel })}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('addHint')}</DialogDescription>

        {!picking ? (
          <div className="grid gap-2">
            {canSuggest && (
              <button
                type="button"
                className={CHOICE}
                disabled={suggest.isPending}
                onClick={() =>
                  suggest.mutate(day, {
                    onSuccess: done,
                    onError: (error) => toast.error(getErrorMessage(error, t('addError'))),
                  })
                }
              >
                {suggest.isPending ? (
                  <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <CloudSun className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                )}
                <span>
                  <b className="block">{t('suggestForWeather')}</b>
                  <span className="text-xs text-muted-foreground">{t('suggestHint')}</span>
                </span>
              </button>
            )}
            <button type="button" className={CHOICE} onClick={() => setPicking(true)}>
              <BookOpen className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <b className="block">{t('fromLookbook')}</b>
                <span className="text-xs text-muted-foreground">{t('fromLookbookHint')}</span>
              </span>
            </button>
            <Link href="/dashboard/outfits/new" className={CHOICE}>
              <Shirt className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <b className="block">{t('makeNew')}</b>
                <span className="text-xs text-muted-foreground">{t('makeNewHint')}</span>
              </span>
            </Link>
          </div>
        ) : lookbook.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {looks.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('noLooks')}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {lookbook.map((look) => (
              <li key={look.id}>
                <button
                  type="button"
                  disabled={create.isPending}
                  className="block w-full text-left"
                  onClick={() =>
                    create.mutate(
                      {
                        items: look.items.map((item) => item.id),
                        occasion: look.occasion,
                        name: look.name ?? undefined,
                        scheduled_for: day,
                      },
                      { onSuccess: done, onError: (error) => toast.error(getErrorMessage(error, t('addError'))) }
                    )
                  }
                >
                  <LookTile pieces={piecesOf(look)} />
                  <span className="mt-1 block truncate text-xs font-semibold">{outfitTitle(look)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
