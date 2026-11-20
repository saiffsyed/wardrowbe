'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api, getErrorMessage } from '@/lib/api';
import { warmthOf, type Warmth } from '@/lib/dressing-room';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useHomes } from '@/lib/hooks/use-homes';
import { useItems } from '@/lib/hooks/use-items';
import { useLaundryStates } from '@/lib/hooks/use-laundry';
import { useDeleteOutfit, useInfiniteOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { usePlanDayOutfit, type DayForecast } from '@/lib/hooks/use-stays';
import { useCreateStudioOutfit } from '@/lib/hooks/use-studio';
import { useOccasionLabel, useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { lookChoices } from '@/lib/today';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { piecesOf } from './add-outfit-sheet';
import { LookTile } from './look-tile';
import { SHEET_CLASS } from './weather-sheet';

const UNDO_FOR = 5000;
const SWAP_SHOWN = 3;

// "I wore it" is sent after a few seconds, so Undo can simply cancel it. The wait lives
// outside the card, so leaving the screen meanwhile still records the wear.
const pendingWears = new Map<string, ReturnType<typeof setTimeout>>();

// Today in the Planner: the name and occasion of today's look with Swap and I wore it, or,
// with nothing planned, a suggestion for the weather or a look from the Lookbook.
function useSuggestToday(today: string) {
  const t = useTranslations('wardrobe.closet.today');
  const suggest = usePlanDayOutfit();
  const remove = useDeleteOutfit();
  // A fresh suggestion for today's weather; from Swap it takes the place of today's plan.
  const run = (replacing?: Outfit) =>
    suggest.mutate(today, {
      onSuccess: async () => {
        if (replacing) await remove.mutateAsync(replacing.id).catch(() => undefined);
        toast.success(replacing ? t('changed') : t('planned'));
      },
      onError: (error) => toast.error(getErrorMessage(error, t('suggestError'))),
    });
  return { run, pending: suggest.isPending };
}

function useLookbook() {
  const looks = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  return {
    list: looks.data?.pages.flatMap((page) => page.outfits) ?? [],
    count: looks.data?.pages[0]?.total ?? 0,
  };
}

export function TodayActions({
  today,
  look,
  forecast,
  deg,
}: {
  today: string;
  look: Outfit;
  forecast: DayForecast | null;
  deg: (value: number) => string;
}) {
  const t = useTranslations('wardrobe.closet.today');
  const queryClient = useQueryClient();
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const conditionLabel = useWeatherConditionLabel();
  const suggest = useSuggestToday(today);
  const lookbook = useLookbook();
  const [swapping, setSwapping] = useState(false);
  const [pending, setPending] = useState(() => pendingWears.has(look.id));

  useEffect(() => setPending(pendingWears.has(look.id)), [look]);

  const worn = !!look.feedback?.worn_at || pending;
  const wore = () => {
    const id = look.id;
    setPending(true);
    pendingWears.set(
      id,
      setTimeout(async () => {
        pendingWears.delete(id);
        try {
          await api.post(`/outfits/${id}/feedback`, { worn: true });
        } catch (error) {
          toast.error(getErrorMessage(error, t('woreError')));
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.everyLaundry });
        setPending(false);
      }, UNDO_FOR)
    );
  };
  const undo = () => {
    clearTimeout(pendingWears.get(look.id));
    pendingWears.delete(look.id);
    setPending(false);
  };

  return (
    <div className="space-y-2.5">
      <LookName title={outfitTitle(look)} occasion={occasionLabel(look.occasion)} />
      {worn ? (
        <div className="flex h-12 items-center justify-between rounded-full bg-primary/10 px-5 text-sm font-bold text-primary">
          <span className="flex items-center gap-1.5">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t('wornToday')}
          </span>
          {pending && (
            <button type="button" onClick={undo} className="font-extrabold">
              {t('undo')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSwapping(true)} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-muted font-extrabold hover:bg-accent">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('swap')}
          </button>
          <button type="button" onClick={wore} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-primary font-extrabold text-primary-foreground hover:opacity-90">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t('wore')}
          </button>
        </div>
      )}
      <SwapSheet
        mode={swapping ? 'swap' : null}
        today={today}
        current={look}
        warmth={warmthOf(forecast)}
        weatherText={forecast ? t('swapFor', { temp: deg(forecast.temp_max), sky: conditionLabel(forecast.condition) }) : undefined}
        lookbook={lookbook.list}
        onSuggest={() => suggest.run(look)}
        suggesting={suggest.pending}
        onClose={() => setSwapping(false)}
      />
    </div>
  );
}

// The name and occasion under a day's look.
export function LookName({ title, occasion }: { title: string; occasion: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <b className="truncate text-[17px]">{title}</b>
      <span className="shrink-0 text-sm text-muted-foreground">{occasion}</span>
    </div>
  );
}

export function TodayEmpty({
  today,
  forecast,
  deg,
}: {
  today: string;
  forecast: DayForecast | null;
  deg: (value: number) => string;
}) {
  const t = useTranslations('wardrobe.closet.today');
  const conditionLabel = useWeatherConditionLabel();
  const suggest = useSuggestToday(today);
  const lookbook = useLookbook();
  const [picking, setPicking] = useState(false);
  const tempText = forecast ? deg(forecast.temp_max) : '';

  return (
    <div className="w-full max-w-sm space-y-2.5">
      <p className="text-center text-sm text-muted-foreground">{t('nothing')}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={suggest.pending || !forecast}
          onClick={() => suggest.run()}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-muted/60 p-3 text-center hover:bg-accent disabled:opacity-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
            {suggest.pending ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            )}
          </span>
          <b className="text-sm leading-tight">{t('suggest')}</b>
          {forecast && (
            <span className="text-xs text-muted-foreground">{t('suggestFor', { temp: tempText, sky: conditionLabel(forecast.condition) })}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-muted/60 p-3 text-center hover:bg-accent"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <b className="text-sm leading-tight">{t('pick')}</b>
          <span className="text-xs text-muted-foreground">{t('savedLooks', { count: lookbook.count })}</span>
        </button>
      </div>
      <Link href={`/dashboard/outfits/make?date=${today}`} className="mx-auto flex w-fit items-center gap-1 px-3 py-1.5 text-sm font-bold text-primary hover:underline">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('makeNew')}
      </Link>
      <SwapSheet
        mode={picking ? 'pick' : null}
        today={today}
        current={undefined}
        warmth={warmthOf(forecast)}
        weatherText={forecast ? t('swapFor', { temp: tempText, sky: conditionLabel(forecast.condition) }) : undefined}
        lookbook={lookbook.list}
        onSuggest={() => suggest.run()}
        suggesting={suggest.pending}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}

// Looks to wear today instead: three that suit the weather (all of them when picking for an
// empty day), a fresh suggestion, and the outfit maker.
function SwapSheet({
  mode,
  today,
  current,
  warmth,
  weatherText,
  lookbook,
  onSuggest,
  suggesting,
  onClose,
}: {
  mode: 'swap' | 'pick' | null;
  today: string;
  current: Outfit | undefined;
  warmth: Warmth;
  weatherText?: string;
  lookbook: Outfit[];
  onSuggest: () => void;
  suggesting: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('wardrobe.closet.today');
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const create = useCreateStudioOutfit();
  const remove = useDeleteOutfit();
  const { data: homes } = useHomes();
  const homeId = homes?.find((home) => home.is_current)?.id;
  const { data: items } = useItems({ home_id: homeId, is_archived: false }, 1, 100);
  const { data: away } = useLaundryStates();
  const [all, setAll] = useState(false);
  const busy = useRef(false);

  const choices = useMemo(
    () =>
      lookChoices(
        lookbook,
        new Map((items?.items ?? []).map((item) => [item.id, item])),
        new Set(away?.keys() ?? []),
        warmth
      ),
    [lookbook, items, away, warmth]
  );
  const shown = mode === 'pick' || all ? choices : choices.slice(0, SWAP_SHOWN);

  const wear = async (look: Outfit) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await create.mutateAsync({
        items: look.items.map((item) => item.id),
        occasion: look.occasion,
        name: look.name ?? undefined,
        scheduled_for: today,
      });
      // The plan it replaces was made for today only, so it goes.
      if (current) await remove.mutateAsync(current.id);
      toast.success(t('changed'));
      close();
    } catch (error) {
      toast.error(getErrorMessage(error, t('swapError')));
    } finally {
      busy.current = false;
    }
  };
  const close = () => {
    setAll(false);
    onClose();
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className={`${SHEET_CLASS} max-h-[85dvh] overflow-y-auto`}>
        <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <DialogTitle className="text-base">{mode === 'pick' ? t('pickTitle') : t('swapTitle')}</DialogTitle>
        <DialogDescription className="-mt-1 text-xs">{weatherText ?? t('swapHint')}</DialogDescription>
        {choices.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('noChoices')}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {shown.map((look) => (
              <li key={look.id}>
                <button
                  type="button"
                  disabled={create.isPending || remove.isPending}
                  onClick={() => wear(look)}
                  className="block w-full rounded-xl border bg-background p-1.5 text-left disabled:opacity-50"
                >
                  <LookTile pieces={piecesOf(look)} />
                  <span className="mt-1 block truncate text-xs font-bold">{outfitTitle(look)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{occasionLabel(look.occasion)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          {mode === 'swap' && choices.length > SWAP_SHOWN && !all ? (
            <button type="button" onClick={() => setAll(true)} className="h-10 rounded-full border text-sm font-bold text-primary hover:bg-accent">
              {t('more')}
            </button>
          ) : (
            <button
              type="button"
              disabled={suggesting}
              onClick={() => {
                onSuggest();
                close();
              }}
              className="h-10 rounded-full border text-sm font-bold text-primary hover:bg-accent disabled:opacity-50"
            >
              {t('newSuggestion')}
            </button>
          )}
          <Link href={`/dashboard/outfits/make?date=${today}`} className="flex h-10 items-center justify-center rounded-full border text-sm font-bold text-primary hover:bg-accent">
            {t('makeNew')}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
