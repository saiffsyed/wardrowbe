'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ScanLine, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { MAX_LABEL_PHOTOS_PER_SCAN } from '@/lib/hooks/use-label-scan';
import { ACCEPTED_IMAGE_INPUT } from '@/lib/image-types';

// The optional label step of adding an item: choose up to three photos of its labels now, and
// they are read as soon as the item exists.
export function LabelPhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const t = useTranslations('wardrobe.closet.labelScan');
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{t('optionalStep')}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_INPUT}
        multiple
        className="hidden"
        aria-label={t('addPhoto')}
        onChange={(event) => {
          const added = Array.from(event.target.files ?? []);
          onChange([...files, ...added].slice(0, MAX_LABEL_PHOTOS_PER_SCAN));
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {previews.map((preview, index) => (
          <div key={preview} className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
            {/* A local preview of a file not uploaded yet; next/image has nothing to fetch. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={t('photoNumber', { number: index + 1 })} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t('removePhoto', { number: index + 1 })}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {files.length < MAX_LABEL_PHOTOS_PER_SCAN && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()}>
            <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
            {files.length ? t('addAnother') : t('addPhoto')}
          </Button>
        )}
      </div>
    </div>
  );
}
