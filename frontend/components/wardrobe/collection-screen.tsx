'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/api';
import {
  useCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useRenameCollection,
  type CollectionEntry,
} from '@/lib/hooks/use-collections';
import { useOccasionLabel, useTypeLabel } from '@/lib/hooks/use-translated-constants';
import { LookCard } from './look-tile';
import { useOutfitLayouts } from '@/lib/hooks/use-outfit-layouts';
import { CollectionNameDialog } from './collection-name-dialog';
import { tabHref } from './wardrobe-tabs';

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function CollectionScreen({ collectionId }: { collectionId: string }) {
  const t = useTranslations('wardrobe.closet.collections');
  const typeLabel = useTypeLabel();
  const occasionLabel = useOccasionLabel();
  const router = useRouter();
  const { data: collection, isLoading, isError } = useCollection(collectionId);
  const { data: layouts } = useOutfitLayouts(
    (collection?.entries ?? []).flatMap((entry) => (entry.outfit ? [entry.outfit.id] : []))
  );
  const rename = useRenameCollection();
  const remove = useDeleteCollection();
  const removeEntry = useRemoveFromCollection();
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = (
    <Link
      href={tabHref('collections')}
      className="-ml-2 inline-flex h-10 items-center rounded-full pr-3 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (isError) {
    return (
      <div className="space-y-4">
        {back}
        <p className="py-8 text-center text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }
  if (isLoading || !collection) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const items = collection.entries.filter((e) => e.kind === 'item' && e.item);
  const outfits = collection.entries.filter((e) => e.kind === 'outfit' && e.outfit);
  const takeOut = (entry: CollectionEntry, name: string) =>
    removeEntry.mutate(
      { id: collection.id, entryId: entry.id },
      {
        onSuccess: () => toast.success(t('removed', { name })),
        onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
      }
    );

  return (
    <div className="space-y-5">
      <div>
        {back}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{collection.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t('entryCount', { count: collection.entries.length })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {collection.entries.length > 0 && (
              <Button
                variant={editing ? 'default' : 'outline'}
                className="h-10 rounded-full"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? t('done') : t('edit')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label={t('more')}>
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('rename')}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {collection.entries.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="font-medium">{t('emptyCollection')}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{t('emptyCollectionHint')}</p>
        </div>
      )}

      {items.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('clothesHeading', { count: items.length })}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((entry) => {
              const item = entry.item!;
              const name = item.name || typeLabel(item.type);
              return (
                <li key={entry.id} className="relative">
                  {editing && <RemoveButton label={t('remove', { name })} onClick={() => takeOut(entry, name)} />}
                  <Link
                    href={`/dashboard/wardrobe?item=${item.id}`}
                    aria-label={name}
                    className="photo-ground relative block aspect-square overflow-hidden rounded-lg"
                  >
                    {item.thumbnail_url ? (
                      <Image src={item.thumbnail_url} alt="" fill className="object-contain p-1" sizes="33vw" />
                    ) : (
                      <span className="flex h-full items-center justify-center bg-muted px-1 text-center text-xs text-muted-foreground">
                        {name}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {outfits.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('outfitsHeading', { count: outfits.length })}
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {outfits.map((entry) => {
              const outfit = entry.outfit!;
              const name = outfit.name || occasionLabel(outfit.occasion);
              return (
                <li key={entry.id} className="relative">
                  {editing && <RemoveButton label={t('remove', { name })} onClick={() => takeOut(entry, name)} />}
                  <LookCard
                    href={`/dashboard/outfits/${outfit.id}`}
                    name={name}
                    occasion={occasionLabel(outfit.occasion)}
                    pieces={(outfit.pieces ?? []).map((p) => ({ id: p.item_id, type: p.type, url: p.thumbnail_url }))}
                    arranged={layouts?.get(outfit.id)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CollectionNameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={t('renameTitle')}
        initialName={collection.name}
        submitLabel={t('save')}
        pending={rename.isPending}
        onSubmit={(name) =>
          rename.mutate(
            { id: collection.id, name },
            {
              onSuccess: () => setRenaming(false),
              onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
            }
          )
        }
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle', { name: collection.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                remove.mutate(collection.id, {
                  onSuccess: () => {
                    toast.success(t('deleted', { name: collection.name }));
                    router.push(tabHref('collections'));
                  },
                  onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
                })
              }
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
