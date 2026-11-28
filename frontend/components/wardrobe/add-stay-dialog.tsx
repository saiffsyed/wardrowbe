'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { ApiError, getErrorMessage } from '@/lib/api';
import { useHomes } from '@/lib/hooks/use-homes';
import { useCreateStay } from '@/lib/hooks/use-stays';

// "Where will you be?": one of your homes, or any city by name, from one day to another.
export function AddStayDialog({
  open,
  onOpenChange,
  startDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
}) {
  const t = useTranslations('wardrobe.closet.stays');
  const { data: homes } = useHomes();
  const create = useCreateStay();
  const [homeId, setHomeId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(startDate);

  useEffect(() => {
    if (!open) return;
    setHomeId(null);
    setCity('');
    setFrom(startDate);
    setTo(startDate);
  }, [open, startDate]);

  const place = homeId ? homes?.find((home) => home.id === homeId)?.name ?? '' : city.trim();
  const valid = !!place && !!from && !!to && to >= from;

  const save = () =>
    create.mutate(
      { city: place, home_id: homeId, start_date: from, end_date: to },
      {
        onSuccess: (stay) => {
          toast.success(t('saved', { city: stay.city }));
          onOpenChange(false);
        },
        onError: (error) => {
          const notFound = error instanceof ApiError && error.status === 422;
          toast.error(notFound ? t('cityNotFound', { city: place }) : getErrorMessage(error, t('saveError')));
        },
      }
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('hint')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save();
          }}
        >
          {!!homes?.length && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('yourHomes')}</p>
              <div className="flex flex-wrap gap-2">
                {homes.map((home) => (
                  <button
                    key={home.id}
                    type="button"
                    aria-pressed={homeId === home.id}
                    onClick={() => {
                      setHomeId(homeId === home.id ? null : home.id);
                      setCity('');
                    }}
                    className={`h-9 rounded-full border px-3.5 text-sm transition-colors ${
                      homeId === home.id
                        ? 'border-primary bg-accent font-semibold text-accent-foreground'
                        : 'bg-card hover:bg-accent'
                    }`}
                  >
                    {home.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="stay-city">{t('otherCity')}</Label>
            <Input
              id="stay-city"
              placeholder={t('cityPlaceholder')}
              value={city}
              maxLength={100}
              onChange={(event) => {
                setCity(event.target.value);
                setHomeId(null);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="stay-from">{t('from')}</Label>
              <Input
                id="stay-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  if (to < event.target.value) setTo(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stay-to">{t('to')}</Label>
              <Input id="stay-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={!valid || create.isPending}>
            {t('save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
