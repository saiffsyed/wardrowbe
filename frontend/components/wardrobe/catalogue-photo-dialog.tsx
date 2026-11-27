'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api';
import {
  useDropCataloguePhoto,
  useMakeCataloguePhoto,
  useUseCataloguePhoto,
  type CatalogueDraft,
} from '@/lib/hooks/use-catalogue-photo';
import type { Item } from '@/lib/types';

interface CataloguePhotoDialogProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function euros(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// Makes a clean shop-style picture of the item and shows it beside the own photo. Nothing changes
// until "Use the new photo"; "Keep mine" drops the draft.
export function CataloguePhotoDialog({ item, open, onOpenChange }: CataloguePhotoDialogProps) {
  const t = useTranslations('wardrobe.closet.cataloguePhoto');
  const locale = useLocale();
  const make = useMakeCataloguePhoto();
  const use = useUseCataloguePhoto();
  const drop = useDropCataloguePhoto();
  const [draft, setDraft] = useState<CatalogueDraft | null>(null);
  const draftRef = useRef<CatalogueDraft | null>(null);
  draftRef.current = draft;

  const start = () => {
    setDraft(null);
    make.mutate(item.id, {
      onSuccess: setDraft,
      onError: (error) => {
        toast.error(getErrorMessage(error, t('failed')));
        onOpenChange(false);
      },
    });
  };

  useEffect(() => {
    if (open) start();
    // One picture per opening; Try again makes the next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dropDraft = () => {
    const id = draftRef.current?.draft_id;
    if (id) drop.mutate({ itemId: item.id, draftId: id });
  };

  const close = () => {
    dropDraft();
    onOpenChange(false);
  };

  const tryAgain = () => {
    dropDraft();
    start();
  };

  const useIt = () => {
    if (!draft?.draft_id) return;
    use.mutate(
      { itemId: item.id, draftId: draft.draft_id },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onOpenChange(false);
        },
        onError: (error) => {
          const message = getErrorMessage(error, t('failed'));
          toast.error(message === 'TOO_MANY_PHOTOS' ? t('tooManyPhotos') : message);
        },
      }
    );
  };

  const working = make.isPending || (open && !draft);
  const message =
    draft && draft.status !== 'ready'
      ? { ai_disabled: t('aiDisabled'), over_limit: t('overLimit'), failed: t('failed') }[draft.status]
      : null;
  const before = item.medium_url || item.image_url || item.thumbnail_url;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : !use.isPending && close())}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        {working && (
          <div className="flex flex-col items-center gap-3 py-10" role="status">
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{t('working')}</p>
          </div>
        )}

        {!working && message && (
          <div className="space-y-4 py-2">
            <p className="text-sm">{message}</p>
            <div className="flex justify-end gap-2">
              {draft?.status === 'failed' && (
                <Button type="button" variant="ghost" onClick={tryAgain}>
                  {t('tryAgain')}
                </Button>
              )}
              <Button type="button" onClick={close}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}

        {!working && draft?.status === 'ready' && draft.preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('before'), src: before, after: false },
                { label: t('after'), src: draft.preview, after: true },
              ].map((side) => (
                <figure key={side.label} className="photo-ground relative aspect-[3/4] overflow-hidden rounded-xl border">
                  {side.src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={side.src} alt="" className="h-full w-full object-contain" />
                  )}
                  <figcaption
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      side.after ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {side.label}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t('spent', { spent: euros(draft.spent_cents, locale), limit: euros(draft.limit_cents, locale) })}
            </p>
            <Button type="button" className="w-full" disabled={use.isPending} onClick={useIt}>
              {use.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('useNew')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={use.isPending} onClick={tryAgain}>
                {t('tryAgain')}
              </Button>
              <Button type="button" variant="outline" disabled={use.isPending} onClick={close}>
                {t('keepMine')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
