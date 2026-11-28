'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MORE_TIPS = ['flat', 'light', 'whole', 'special'] as const;

// A one-line hint under the photo box, with the full list a tap away. The background is taken
// out by the app, so the tips are about light and getting the whole piece in.
export function PhotoTip() {
  const t = useTranslations('wardrobe.closet.photoTip');
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <p className="flex items-start gap-2">
        <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          {t('short')}{' '}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {open ? t('less') : t('more')}
          </button>
        </span>
      </p>
      {open && (
        <ul className="mt-2 list-disc space-y-1 pl-9">
          {MORE_TIPS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
