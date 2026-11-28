'use client';

import { useId, useState } from 'react';
import { Home as HomeIcon, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api';
import {
  useCreateHome,
  useDeleteHome,
  useHomes,
  useSetCurrentHome,
  useUpdateHome,
  type HomeInput,
} from '@/lib/hooks/use-homes';
import type { Home } from '@/lib/types';

function HomeForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: HomeInput;
  submitLabel: string;
  pending: boolean;
  onSubmit: (home: HomeInput) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('wardrobe.closet.homes');
  const formId = useId();
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState(initial.city);
  const ready = !!name.trim() && !!city.trim();

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit({ name: name.trim(), city: city.trim() });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-name`}>{t('name')}</Label>
        <Input
          id={`${formId}-name`}
          value={name}
          maxLength={60}
          placeholder={t('namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-city`}>{t('city')}</Label>
        <Input
          id={`${formId}-city`}
          value={city}
          maxLength={100}
          placeholder={t('cityPlaceholder')}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t('cancel')}
          </Button>
        )}
        <Button type="submit" disabled={!ready || pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Each person sets up their own homes: a name and the city whose weather applies there.
// `bare` drops the card's own title and explanation, for a screen that already gives them.
export function HomesSettings({ bare = false }: { bare?: boolean } = {}) {
  const t = useTranslations('wardrobe.closet.homes');
  const { data: homes, isLoading } = useHomes();
  const createHome = useCreateHome();
  const updateHome = useUpdateHome();
  const deleteHome = useDeleteHome();
  const setCurrent = useSetCurrentHome();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Home | null>(null);
  const failed = (error: unknown) => toast.error(getErrorMessage(error, t('errors.saveFailed')));

  return (
    <Card id="homes" className="scroll-mt-20">
      {!bare && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HomeIcon className="h-5 w-5" aria-hidden="true" />
            {t('title')}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={`space-y-4 ${bare ? 'pt-6' : ''}`}>
        {!!homes?.length && (
          <ul className="divide-y rounded-lg border">
            {homes.map((home) =>
              editingId === home.id ? (
                <li key={home.id} className="p-3">
                  <HomeForm
                    initial={{ name: home.name, city: home.city }}
                    submitLabel={t('save')}
                    pending={updateHome.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(input) =>
                      updateHome.mutate(
                        { id: home.id, home: input },
                        { onSuccess: () => setEditingId(null), onError: failed }
                      )
                    }
                  />
                </li>
              ) : (
                <li key={home.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{home.name}</span>
                      {home.is_current && <Badge variant="secondary">{t('current')}</Badge>}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {home.city} · {t('itemCount', { count: home.item_count })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!home.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setCurrent.isPending}
                        onClick={() => setCurrent.mutate(home.id, { onError: failed })}
                      >
                        {t('setCurrent')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('editHome', { home: home.name })}
                      onClick={() => setEditingId(home.id)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('deleteHome', { home: home.name })}
                      onClick={() => setDeleting(home)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}

        {adding ? (
          <HomeForm
            initial={{ name: '', city: '' }}
            submitLabel={t('add')}
            pending={createHome.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              createHome.mutate(input, { onSuccess: () => setAdding(false), onError: failed })
            }
          />
        ) : (
          <Button variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('add')}
          </Button>
        )}
      </CardContent>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting ? t('deleteHome', { home: deleting.name }) : ''}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteHome.mutate(deleting.id, { onError: failed });
                setDeleting(null);
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
