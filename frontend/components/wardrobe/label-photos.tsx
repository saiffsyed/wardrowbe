'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api';
import { useDeleteLabelPhoto, useLabelPhotos } from '@/lib/hooks/use-label-scan';

// The photos kept of an item's labels. Tapping one opens it large enough to read, with the
// option to remove it.
export function LabelPhotos({ itemId }: { itemId: string }) {
  const t = useTranslations('wardrobe.closet.labelScan');
  const { data: photos } = useLabelPhotos(itemId);
  const remove = useDeleteLabelPhoto();
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = photos?.findIndex((photo) => photo.id === openId) ?? -1;
  const openPhoto = openIndex >= 0 ? photos![openIndex] : null;

  if (!photos?.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{t('photos')}</p>
      <ul className="flex gap-2 overflow-x-auto">
        {photos.map((photo, index) => (
          <li key={photo.id} className="shrink-0">
            <button
              type="button"
              aria-label={t('openPhoto', { number: index + 1 })}
              className="relative block h-16 w-16 overflow-hidden rounded-md border bg-muted"
              onClick={() => setOpenId(photo.id)}
            >
              <Image src={photo.thumbnail_url} alt="" fill className="object-cover" sizes="64px" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!openPhoto} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('photoNumber', { number: openIndex + 1 })}</DialogTitle>
            <DialogDescription className="sr-only">{t('photos')}</DialogDescription>
          </DialogHeader>
          {openPhoto && (
            <>
              {/* Shown at its own proportions, which next/image would need told in advance. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={openPhoto.image_url}
                alt={t('photoNumber', { number: openIndex + 1 })}
                className="w-full rounded-md"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(
                      { itemId, photoId: openPhoto.id },
                      {
                        onSuccess: () => setOpenId(null),
                        onError: (error) => toast.error(getErrorMessage(error, t('removeFailed'))),
                      }
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t('deletePhoto')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
