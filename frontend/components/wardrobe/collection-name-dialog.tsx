'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const MAX_COLLECTION_NAME = 60;

// Asks for a collection's name, for a new one or a rename.
export function CollectionNameDialog({
  open,
  onOpenChange,
  title,
  initialName = '',
  submitLabel,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (name: string) => void;
}) {
  const t = useTranslations('wardrobe.closet.collections');
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);
  const trimmed = name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            aria-label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            maxLength={MAX_COLLECTION_NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="submit" disabled={!trimmed || pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
