'use client';

import { Check, Droplets, Shirt, WashingMachine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/api';
import { useHomes } from '@/lib/hooks/use-homes';
import { useLaundry, useLaundryStates, useMoveLaundry } from '@/lib/hooks/use-laundry';
import { canMove, laundryOf, type Laundry, type LaundryMove } from '@/lib/laundry';
import type { Item } from '@/lib/types';

type Shown = Exclude<Laundry, 'clean'>;
const STYLE: Record<Shown, string> = {
  dirty: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  washing: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  dry_cleaning: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
};
const ICON = { dirty: Droplets, washing: WashingMachine, dry_cleaning: Shirt };
const BADGE_KEY = { dirty: 'need', washing: 'wash', dry_cleaning: 'dry' } as const;

// Where an item is in the laundry (lib/laundry.ts has the states and allowed moves).
export function useLaundryOf(item: Pick<Item, 'id' | 'needs_wash'>): Laundry {
  const { data } = useLaundryStates();
  return laundryOf(item.needs_wash, data?.get(item.id));
}

export function LaundryBadge({ state, small = false }: { state: Shown; small?: boolean }) {
  const t = useTranslations('wardrobe.closet.laundry');
  const Icon = ICON[state];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold ${STYLE[state]} ${
        small ? 'h-5 px-1.5 text-[10.5px]' : 'h-6 px-2 text-xs'
      }`}
    >
      <Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {t(`badge.${BADGE_KEY[state]}`)}
    </span>
  );
}

export function useMoveWithToast() {
  const t = useTranslations('wardrobe.closet.laundry');
  const move = useMoveLaundry();
  const run = (itemIds: string[], to: LaundryMove, onDone?: () => void) =>
    move.mutate(
      { itemIds, to },
      {
        onSuccess: ({ moved }) => {
          toast.success(t(`moved.${to}`, { count: moved || itemIds.length }));
          onDone?.();
        },
        onError: (error) => toast.error(getErrorMessage(error, t('moveError'))),
      }
    );
  return { run, pending: move.isPending };
}

// The laundry part of an item's ⋯ menu.
export function LaundryMenuItems({ item }: { item: Pick<Item, 'id' | 'needs_wash'> }) {
  const t = useTranslations('wardrobe.closet.laundry');
  const state = useLaundryOf(item);
  const { run, pending } = useMoveWithToast();
  return (
    <>
      {canMove(state, 'wash') && (
        <DropdownMenuItem disabled={pending} onSelect={() => run([item.id], 'wash')}>
          <WashingMachine className="mr-2 h-4 w-4" />
          {t('menu.wash')}
        </DropdownMenuItem>
      )}
      {canMove(state, 'dry') && (
        <DropdownMenuItem disabled={pending} onSelect={() => run([item.id], 'dry')}>
          <Shirt className="mr-2 h-4 w-4" />
          {t('menu.dry')}
        </DropdownMenuItem>
      )}
      {canMove(state, 'back') && (
        <DropdownMenuItem disabled={pending} onSelect={() => run([item.id], 'back')}>
          <Check className="mr-2 h-4 w-4" />
          {t('menu.back')}
        </DropdownMenuItem>
      )}
      <div role="separator" className="-mx-1 my-1 h-px bg-border" />
    </>
  );
}

// The number on the More screen's Laundry tile: clothes to wash plus clothes away.
export function LaundryCount() {
  const t = useTranslations('wardrobe.closet.laundry');
  const { data: homes } = useHomes();
  const { data } = useLaundry(homes?.find((home) => home.is_current)?.id);
  const count = data ? data.to_wash.length + data.wash.length + data.dry.length : 0;
  if (!count) return null;
  return (
    <span
      aria-label={t('count', { count })}
      className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-extrabold text-primary-foreground"
    >
      {count}
    </span>
  );
}
