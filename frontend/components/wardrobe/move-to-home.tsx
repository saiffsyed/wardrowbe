'use client';

import { Loader2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHomes, useMoveSelectionToHome } from '@/lib/hooks/use-homes';
import type { BulkOperationParams } from '@/lib/hooks/use-items';

// The multi-select toolbar's "Move to home": pick one of your homes and every selected item
// goes there. Not offered until you have at least two homes, since there is nowhere to move to.
export function MoveToHomeButton({
  getSelection,
  onDone,
}: {
  getSelection: () => BulkOperationParams;
  onDone: () => void;
}) {
  const t = useTranslations('wardrobe.closet.homes');
  const { data: homes } = useHomes();
  const move = useMoveSelectionToHome();

  if (!homes || homes.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // Icon only on a phone, where the toolbar is full; the word appears on wider screens.
          className="h-8 w-8 shrink-0 gap-1.5 p-0 sm:w-auto sm:px-2.5"
          disabled={move.isPending}
          aria-label={t('moveSelected')}
        >
          {move.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MapPin className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{t('moveShort')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {homes.map((home) => (
          <DropdownMenuItem
            key={home.id}
            onSelect={() =>
              move.mutate(
                { homeId: home.id, selection: getSelection() },
                {
                  onSuccess: (result) => {
                    toast.success(t('moved', { count: result.moved, home: home.name }));
                    onDone();
                  },
                  onError: () => toast.error(t('errors.moveFailed')),
                }
              )
            }
          >
            {t('moveTo', { home: home.name })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
