'use client';

import { useState } from 'react';
import { Check, FolderPlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/api';
import {
  useAddToCollection,
  useCollections,
  useCreateCollection,
  type CollectionAdditions,
  type Holder,
} from '@/lib/hooks/use-collections';
import { CollectionCover } from './collection-cover';
import { MAX_COLLECTION_NAME } from './collection-name-dialog';

// Tap a collection to put the item or outfit in it. A tick marks the ones already holding it;
// taking something out is done from the collection itself.
export function AddToCollectionDialog({
  open,
  onOpenChange,
  additions,
  holder = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  additions: CollectionAdditions;
  holder?: Holder;
}) {
  const t = useTranslations('wardrobe.closet.collections');
  const { data: collections, isLoading } = useCollections({}, open);
  const single = !!(holder.itemId || holder.outfitId);
  const { data: holding } = useCollections(holder, open && single);
  const add = useAddToCollection();
  const create = useCreateCollection();
  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const holdingIds = new Set(single ? (holding ?? []).map((c) => c.id) : []);

  const addTo = (id: string, name: string) => {
    setBusyId(id);
    add.mutate(
      { id, additions },
      {
        onSuccess: (result) =>
          toast.success(
            result.added > 0 ? t('addedTo', { name }) : t('alreadyIn', { name })
          ),
        onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
        onSettled: () => setBusyId(null),
      }
    );
  };

  const createAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    create.mutate(name, {
      onSuccess: (collection) => {
        setNewName('');
        addTo(collection.id, collection.name);
      },
      onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
          <DialogDescription>{t('addHint')}</DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            createAndAdd();
          }}
        >
          <Input
            aria-label={t('nameLabel')}
            placeholder={t('newPlaceholder')}
            maxLength={MAX_COLLECTION_NAME}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Button type="submit" disabled={!newName.trim() || create.isPending} className="shrink-0">
            <FolderPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('create')}
          </Button>
        </form>

        {isLoading ? (
          <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-1">
            {(collections ?? []).map((collection) => {
              const inIt = holdingIds.has(collection.id);
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    disabled={inIt || busyId !== null}
                    onClick={() => addTo(collection.id, collection.name)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="w-12 shrink-0">
                      <CollectionCover urls={collection.cover_urls} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{collection.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {inIt ? t('inThis') : t('entryCount', { count: collection.entry_count })}
                      </p>
                    </div>
                    {busyId === collection.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      inIt && <Check className="h-5 w-5 text-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// A button that opens the dialog, for screens that show one outfit or item.
export function AddToCollectionButton({ holder }: { holder: Holder }) {
  const t = useTranslations('wardrobe.closet.collections');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('addTitle')}
      </Button>
      <AddToCollectionDialog
        open={open}
        onOpenChange={setOpen}
        holder={holder}
        additions={{
          item_ids: holder.itemId ? [holder.itemId] : [],
          outfit_ids: holder.outfitId ? [holder.outfitId] : [],
        }}
      />
    </>
  );
}
