'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, Check, Loader2, ScanLine, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api';
import { useUpdateClosetDetails } from '@/lib/hooks/use-homes';
import { MAX_LABEL_PHOTOS_PER_SCAN, useScanLabel } from '@/lib/hooks/use-label-scan';
import { useMaterialLabel } from '@/lib/hooks/use-translated-constants';
import { ACCEPTED_IMAGE_INPUT } from '@/lib/image-types';
import {
  editsFromChoices,
  initialChoices,
  labelRows,
  type LabelChoice,
  type LabelChoices,
  type LabelField,
  type LabelRow,
} from '@/lib/label-scan';
import type { Item, LabelScanResult, MaterialShare } from '@/lib/types';

interface LabelScanDialogProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Photos already chosen elsewhere (the add-item form): reading starts at once.
  initialFiles?: File[];
}

interface Picked {
  file: File;
  preview: string;
}

const FIELD_KEYS: Record<LabelField, string> = {
  brand: 'brand',
  article_number: 'articleNumber',
  size: 'size',
  size_system: 'sizeSystem',
  composition: 'materials',
  care_instructions: 'care',
};

function useCompositionSummary() {
  const materialLabel = useMaterialLabel();
  return (shares: MaterialShare[]) =>
    [...shares]
      .sort((a, b) => b.percent - a.percent)
      .map((share) => `${share.percent}% ${materialLabel(share.material)}`)
      .join(', ');
}

function ReviewRow({
  row,
  choice,
  onChange,
}: {
  row: LabelRow;
  choice: LabelChoice | undefined;
  onChange: (choice: LabelChoice) => void;
}) {
  const t = useTranslations('wardrobe.closet.labelScan');
  const td = useTranslations('wardrobe.closet.details');
  const summary = useCompositionSummary();
  const id = useId();
  const label = td(FIELD_KEYS[row.field]);
  const display = (value: string | MaterialShare[] | null) =>
    typeof value === 'string' ? value : value ? summary(value) : '';

  if (row.kind === 'same' || !choice) {
    return (
      <div className="flex items-start gap-2 py-2.5 text-sm">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t('alreadySaved', { field: label })}</p>
          <p className="break-words">{display(row.read)}</p>
        </div>
      </div>
    );
  }

  // The label's value: text can be corrected before it is saved, a material mix is taken whole.
  const labelValue =
    row.field === 'composition' ? (
      <p className="break-words text-sm font-medium">{summary(row.read)}</p>
    ) : row.field === 'care_instructions' ? (
      // Care runs to several instructions; a one-line box would hide most of it.
      <Textarea
        aria-label={t('fromLabelValue', { field: label })}
        value={choice.value}
        maxLength={255}
        rows={3}
        className="min-h-0 resize-none"
        onChange={(event) => onChange({ ...choice, value: event.target.value })}
      />
    ) : (
      <Input
        aria-label={t('fromLabelValue', { field: label })}
        value={choice.value}
        maxLength={row.field === 'brand' ? 100 : 32}
        onChange={(event) => onChange({ ...choice, value: event.target.value })}
      />
    );

  if (row.kind === 'new') {
    return (
      <div className="flex items-start gap-3 py-2.5">
        <Checkbox
          id={id}
          className="mt-1"
          checked={choice.use}
          aria-label={t('take', { field: label })}
          onCheckedChange={(checked) => onChange({ ...choice, use: checked === true })}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            {label}
          </label>
          {labelValue}
        </div>
      </div>
    );
  }

  return (
    // Not a fieldset: its legend would cut through the divider line above the row.
    <div role="radiogroup" aria-labelledby={`${id}-title`} className="space-y-2 py-2.5">
      <p id={`${id}-title`} className="text-xs text-muted-foreground">
        {t('differs', { field: label })}
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="radio"
          name={id}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          checked={!choice.use}
          onChange={() => onChange({ ...choice, use: false })}
        />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{t('keepSaved')}</span>
          <span className="block break-words font-medium">{display(row.current)}</span>
        </span>
      </label>
      <div className="flex items-start gap-3 text-sm">
        <input
          type="radio"
          name={id}
          id={`${id}-label`}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          checked={choice.use}
          onChange={() => onChange({ ...choice, use: true })}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={`${id}-label`} className="block text-xs text-muted-foreground">
            {t('useLabel')}
          </label>
          {labelValue}
        </div>
      </div>
    </div>
  );
}

// Photograph an item's labels, let the AI read them, and confirm what to save. Nothing on the
// item changes until Confirm, and only the details ticked or picked here are written.
export function LabelScanDialog({ item, open, onOpenChange, initialFiles }: LabelScanDialogProps) {
  const t = useTranslations('wardrobe.closet.labelScan');
  const scan = useScanLabel();
  const update = useUpdateClosetDetails();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [result, setResult] = useState<LabelScanResult | null>(null);
  const [choices, setChoices] = useState<LabelChoices>({});
  const startedRef = useRef(false);

  const rows = useMemo(() => (result?.reading ? labelRows(item, result.reading) : []), [item, result]);
  const edits = editsFromChoices(rows, choices);

  const read = (files: File[]) => {
    scan.mutate(
      { itemId: item.id, files },
      {
        onSuccess: (scanResult) => {
          setResult(scanResult);
          setChoices(scanResult.reading ? initialChoices(labelRows(item, scanResult.reading)) : {});
        },
        onError: (error) => toast.error(getErrorMessage(error, t('scanFailed'))),
      }
    );
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    const files = (initialFiles ?? []).slice(0, MAX_LABEL_PHOTOS_PER_SCAN);
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    setPicked(files.map((file) => ({ file, preview: URL.createObjectURL(file) })));
    setResult(null);
    setChoices({});
    scan.reset();
    if (files.length) read(files);
    // Runs once per opening; the photos handed in at that moment are the ones read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Previews are freed when their photo is removed, when the dialog is opened afresh, and when
  // it goes away; never while a photo is still on screen.
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = picked.map((photo) => photo.preview);
  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_LABEL_PHOTOS_PER_SCAN - picked.length;
    const added = Array.from(files)
      .slice(0, room)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPicked((previous) => [...previous, ...added]);
  };

  const removePicked = (index: number) => {
    URL.revokeObjectURL(picked[index].preview);
    setPicked((previous) => previous.filter((_, i) => i !== index));
  };

  const confirm = () => {
    if (!edits) {
      onOpenChange(false);
      return;
    }
    update.mutate(
      { id: item.id, edits },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onOpenChange(false);
        },
        onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
      }
    );
  };

  const busy = scan.isPending || update.isPending;
  const step = scan.isPending ? 'reading' : result ? (result.reading ? 'review' : 'unread') : 'pick';

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {step === 'review' ? t('reviewHint') : step === 'unread' ? t('unreadTitle') : t('pickHint')}
          </DialogDescription>
        </DialogHeader>

        {picked.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto" aria-label={t('photos')}>
            {picked.map((photo, index) => (
              <li key={photo.preview} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                {/* A local preview of a file not uploaded yet; next/image has nothing to fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt={t('photoNumber', { number: index + 1 })} className="h-full w-full object-cover" />
                {step === 'pick' && (
                  <button
                    type="button"
                    aria-label={t('removePhoto', { number: index + 1 })}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    onClick={() => removePicked(index)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {step === 'pick' && (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_IMAGE_INPUT}
              multiple
              className="hidden"
              aria-label={t('addPhoto')}
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            {picked.length < MAX_LABEL_PHOTOS_PER_SCAN && (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full gap-2"
                onClick={() => inputRef.current?.click()}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {picked.length ? t('addAnother') : t('addPhoto')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t('tip')}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="button" disabled={!picked.length} onClick={() => read(picked.map((photo) => photo.file))}>
                {t('read')}
              </Button>
            </div>
          </div>
        )}

        {step === 'reading' && (
          <div role="status" className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {t('reading')}
          </div>
        )}

        {step === 'unread' && result && (
          <div className="space-y-3">
            <p className="text-sm">{t(`unread.${result.status}`)}</p>
            <p className="text-sm text-muted-foreground">{t('photosKept')}</p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Back to the photos, to add a clearer one or read them again.
                  setResult(null);
                  setChoices({});
                  scan.reset();
                }}
              >
                {t('tryAgain')}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            <div className="divide-y">
              {rows.map((row) => (
                <ReviewRow
                  key={row.field}
                  row={row}
                  choice={choices[row.field]}
                  onChange={(choice) => setChoices((previous) => ({ ...previous, [row.field]: choice }))}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('photosKept')}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {edits ? t('confirm') : t('close')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
