'use client';

import { Check, Loader2, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api';
import { normalizeColor } from '@/lib/colors';
import {
  useFindProduct,
  useUseProduct,
  type FindProductResult,
  type ProductMatch,
  type UseProductBody,
} from '@/lib/hooks/use-product-finder';
import { useColorLabel } from '@/lib/hooks/use-translated-constants';
import type { Item } from '@/lib/types';

interface ProductFinderDialogProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // "None of these" / nothing found: offer a catalogue photo of the own picture instead.
  onCataloguePhoto?: () => void;
}

type Field = 'name' | 'colour' | 'price';

function money(amount: number | null | undefined, currency: string | null | undefined, locale: string) {
  if (amount == null) return null;
  try {
    return currency
      ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
      : new Intl.NumberFormat(locale).format(amount);
  } catch {
    return `${amount} ${currency ?? ''}`.trim();
  }
}

interface Row {
  field: Field;
  value: string;
  current: string | null;
}

// What a match would change on the item: only details the shop gives and the item lacks or has
// differently. Each starts ticked; the person can untick any.
export function changeRows(item: Item, match: ProductMatch, labels: { colour: (c: string) => string; money: (a: number | null | undefined, c: string | null | undefined) => string | null }): Row[] {
  const rows: Row[] = [];
  const title = match.title?.trim();
  if (title && title !== item.name) rows.push({ field: 'name', value: title, current: item.name ?? null });
  const colour = match.colour ? normalizeColor(match.colour) : null;
  if (colour && colour !== item.primary_color) {
    rows.push({ field: 'colour', value: labels.colour(colour), current: item.primary_color ? labels.colour(item.primary_color) : null });
  }
  const price = labels.money(match.price, match.currency);
  if (price && Number(item.purchase_price ?? NaN) !== match.price) {
    rows.push({ field: 'price', value: price, current: labels.money(item.purchase_price, item.tags?.currency) });
  }
  return rows;
}

export function ProductFinderDialog({ item, open, onOpenChange, onCataloguePhoto }: ProductFinderDialogProps) {
  const t = useTranslations('wardrobe.closet.productFinder');
  const locale = useLocale();
  const colourLabel = useColorLabel();
  const find = useFindProduct();
  const use = useUseProduct();
  const [result, setResult] = useState<FindProductResult | null>(null);
  const [picked, setPicked] = useState<ProductMatch | null>(null);
  const [ticked, setTicked] = useState<Set<Field>>(new Set());

  const labels = { colour: colourLabel, money: (a: number | null | undefined, c: string | null | undefined) => money(a, c, locale) };

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setPicked(null);
    find.mutate(item.id, {
      onSuccess: setResult,
      onError: (error) => {
        toast.error(getErrorMessage(error, t('unreachable')));
        onOpenChange(false);
      },
    });
    // One search per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toCatalogue = () => {
    onOpenChange(false);
    onCataloguePhoto?.();
  };

  const choose = (match: ProductMatch) => {
    setPicked(match);
    setTicked(new Set(changeRows(item, match, labels).map((row) => row.field)));
  };

  const save = () => {
    if (!picked) return;
    const body: UseProductBody = { page_url: picked.page_url, image_url: picked.image_url };
    if (ticked.has('name') && picked.title) body.name = picked.title.slice(0, 100);
    if (ticked.has('colour') && picked.colour) body.colour = normalizeColor(picked.colour) ?? undefined;
    if (ticked.has('price') && picked.price != null) {
      body.price = picked.price;
      if (picked.currency) body.currency = picked.currency;
    }
    use.mutate(
      { itemId: item.id, body },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(
            getErrorMessage(error, t('failed')) === 'TOO_MANY_PHOTOS' ? t('tooManyPhotos') : getErrorMessage(error, t('failed'))
          ),
      }
    );
  };

  const searching = find.isPending || (!result && open);
  const message =
    result && result.status !== 'found'
      ? {
          nothing: t('nothing'),
          no_brand: t('noBrand'),
          ai_disabled: t('aiDisabled'),
          over_limit: t('overLimit'),
          unreachable: t('unreachable'),
        }[result.status]
      : null;
  const rows = picked ? changeRows(item, picked, labels) : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !use.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" aria-hidden="true" />
            {picked ? t('confirmTitle') : result?.status === 'found' ? t('pickTitle') : t('title')}
          </DialogTitle>
        </DialogHeader>

        {searching && (
          <div className="flex flex-col items-center gap-3 py-10" role="status">
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{t('searching')}</p>
          </div>
        )}

        {!searching && message && (
          <div className="space-y-4 py-2">
            <p className="text-sm">{message}</p>
            <div className="flex justify-end gap-2">
              {result?.status === 'nothing' && onCataloguePhoto && (
                <Button type="button" variant="ghost" onClick={toCatalogue}>
                  {t('cataloguePhoto')}
                </Button>
              )}
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}

        {!searching && result?.status === 'found' && !picked && (
          <div className="space-y-3">
            <ul className="space-y-2">
              {result.matches.map((match) => (
                <li key={match.page_url}>
                  <button
                    type="button"
                    onClick={() => choose(match)}
                    className="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="photo-ground flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={match.thumb} alt="" className="h-full w-full object-contain" />
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="line-clamp-2 block text-sm font-semibold">{match.title ?? new URL(match.page_url).hostname}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[new URL(match.page_url).hostname.replace(/^www\./, ''), money(match.price, match.currency, locale)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {match.article_match && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('sameArticle')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={onCataloguePhoto ? toCatalogue : () => onOpenChange(false)}>
                {t('noneOfThese')}
              </Button>
            </div>
          </div>
        )}

        {picked && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="photo-ground relative mx-auto flex h-56 w-44 items-center justify-center overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picked.thumb} alt="" className="h-full w-full object-contain" />
              <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                {t('shopPhoto')}
              </span>
            </div>
            {rows.length > 0 && (
              <ul className="divide-y rounded-xl border">
                {rows.map((row) => (
                  <li key={row.field}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                        checked={ticked.has(row.field)}
                        onChange={(event) =>
                          setTicked((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) next.add(row.field);
                            else next.delete(row.field);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-muted-foreground">{t(row.field)}</span>{' '}
                        <span className="font-semibold">{row.value}</span>
                        {row.current && <span className="block text-xs text-muted-foreground line-through">{row.current}</span>}
                      </span>
                      <span className="text-[11px] font-semibold text-primary">{row.current ? t('changed') : t('new')}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={use.isPending} onClick={() => setPicked(null)}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={use.isPending}>
                {use.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                {t('save')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
