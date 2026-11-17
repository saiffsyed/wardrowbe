'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/api';
import { useCollections, useCreateCollection } from '@/lib/hooks/use-collections';
import { CollectionCover } from './collection-cover';
import { CollectionNameDialog } from './collection-name-dialog';
import { WardrobeTabHeading } from './wardrobe-tabs';

export function CollectionsTab() {
  const t = useTranslations('wardrobe.closet.collections');
  const { data: collections, isLoading, isError } = useCollections();
  const create = useCreateCollection();
  const [creating, setCreating] = useState(false);

  const handleCreate = (name: string) =>
    create.mutate(name, {
      onSuccess: () => {
        setCreating(false);
        toast.success(t('created', { name }));
      },
      onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
    });

  return (
    <div className="space-y-4">
      <WardrobeTabHeading
        tab="collections"
        subtitle={collections ? t('count', { count: collections.length }) : undefined}
        action={
          <Button className="h-11 shrink-0 rounded-full" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('new')}
          </Button>
        }
      />

      {isError ? (
        <p className="py-8 text-center text-destructive">{t('loadError')}</p>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : !collections?.length ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('emptyHint')}</p>
          <Button className="mt-5 rounded-full" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('new')}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={`/dashboard/wardrobe/collections/${collection.id}`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CollectionCover urls={collection.cover_urls} />
                <p className="mt-2 truncate font-semibold">{collection.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t('entryCount', { count: collection.entry_count })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CollectionNameDialog
        open={creating}
        onOpenChange={setCreating}
        title={t('newTitle')}
        submitLabel={t('create')}
        pending={create.isPending}
        onSubmit={handleCreate}
      />
    </div>
  );
}
