'use client';

import { useId, useState } from 'react';
import { Pencil, Plus, Tag, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/lib/api';
import {
  useHomes,
  useUpdateClosetDetails,
  type ClosetDetailEdits,
} from '@/lib/hooks/use-homes';
import { useMaterialLabel, useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import type { Item, MaterialShare } from '@/lib/types';

const NO_HOME = '__none__';
const MAX_MATERIALS = 8;
// Labels round their percentages, so a total a little over 100 is still a faithful copy.
const MAX_TOTAL_PERCENT = 100.5;
// Shades of the accent, darkest for the largest share, so the bar reads without relying on hue.
const SHARE_OPACITY = [1, 0.6, 0.38, 0.24, 0.16];

interface MaterialRow {
  material: string;
  percent: string;
}

interface DetailsForm {
  brand: string;
  size: string;
  sizeSystem: string;
  fitNote: string;
  purchasePlace: string;
  care: string;
  materials: MaterialRow[];
  occasions: string[];
  homeId: string;
}

function formFromItem(item: Item): DetailsForm {
  return {
    brand: item.brand ?? '',
    size: item.tags?.size ?? '',
    sizeSystem: item.tags?.size_system ?? '',
    fitNote: item.tags?.fit_note ?? '',
    purchasePlace: item.tags?.purchase_place ?? '',
    care: item.tags?.care_instructions ?? '',
    materials: (item.tags?.composition ?? []).map((share) => ({
      material: share.material,
      percent: String(share.percent),
    })),
    occasions: [...(item.tags?.occasions ?? [])],
    homeId: item.home_id ?? NO_HOME,
  };
}

function cleanOccasion(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Rows the person has actually filled in; a half-typed row (no name, or no usable number) is
// dropped rather than sent and refused.
function sharesFrom(rows: MaterialRow[]): MaterialShare[] {
  return rows
    .map((row) => ({
      material: row.material.trim().toLowerCase(),
      percent: Number(row.percent.replace('%', '').replace(',', '.')),
    }))
    .filter((share) => share.material && Number.isFinite(share.percent) && share.percent > 0 && share.percent <= 100);
}

function editsFrom(form: DetailsForm): ClosetDetailEdits {
  const text = (value: string) => value.trim() || null;
  const shares = sharesFrom(form.materials);
  return {
    home_id: form.homeId === NO_HOME ? null : form.homeId,
    brand: text(form.brand),
    tags: {
      size: text(form.size),
      size_system: text(form.sizeSystem),
      fit_note: text(form.fitNote),
      purchase_place: text(form.purchasePlace),
      care_instructions: text(form.care),
      composition: shares.length ? shares : null,
      occasions: form.occasions.length ? form.occasions : null,
    },
  };
}

function CompositionBar({ shares }: { shares: MaterialShare[] }) {
  const t = useTranslations('wardrobe.closet.details');
  const materialLabel = useMaterialLabel();
  const sorted = [...shares].sort((a, b) => b.percent - a.percent);
  const summary = sorted.map((share) => `${share.percent}% ${materialLabel(share.material)}`).join(', ');

  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={t('compositionSummary', { summary })}
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {sorted.map((share, index) => (
          <div
            key={`${share.material}-${index}`}
            className="bg-primary"
            style={{
              width: `${share.percent}%`,
              opacity: SHARE_OPACITY[Math.min(index, SHARE_OPACITY.length - 1)],
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {sorted.map((share, index) => (
          <li key={`${share.material}-${index}`} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-sm bg-primary"
              style={{ opacity: SHARE_OPACITY[Math.min(index, SHARE_OPACITY.length - 1)] }}
            />
            <span>
              <span className="font-medium">{share.percent}%</span> {materialLabel(share.material)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

// What a label and a receipt say about an item (size, fibre content, care, where it was
// bought), plus the occasions it is for and the home it is kept in. Edited in place and saved
// on its own, apart from the dialog's main edit form.
export function ClosetDetails({ item }: { item: Item }) {
  const t = useTranslations('wardrobe.closet.details');
  const occasionLabel = useOccasionLabel();
  const { data: homes } = useHomes();
  const update = useUpdateClosetDetails();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DetailsForm>(() => formFromItem(item));
  const [occasionDraft, setOccasionDraft] = useState('');

  const tags = item.tags ?? {};
  const home = homes?.find((candidate) => candidate.id === item.home_id);
  const size = [tags.size, tags.size_system].filter(Boolean).join(' · ') || undefined;
  const hasAnything =
    !!(size || tags.fit_note || tags.purchase_place || tags.care_instructions || home) ||
    !!tags.composition?.length ||
    !!tags.occasions?.length;

  const totalPercent = sharesFrom(form.materials).reduce((sum, share) => sum + share.percent, 0);
  const tooMuch = totalPercent > MAX_TOTAL_PERCENT;

  const startEditing = () => {
    setForm(formFromItem(item));
    setOccasionDraft('');
    setEditing(true);
  };

  const set = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const setMaterial = (index: number, patch: Partial<MaterialRow>) =>
    set(
      'materials',
      form.materials.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );

  const addOccasion = () => {
    const occasion = cleanOccasion(occasionDraft);
    if (occasion && !form.occasions.includes(occasion)) set('occasions', [...form.occasions, occasion]);
    setOccasionDraft('');
  };

  const save = () => {
    if (tooMuch) return;
    // An occasion typed but not yet added is still meant.
    const pending = cleanOccasion(occasionDraft);
    const occasions = pending && !form.occasions.includes(pending) ? [...form.occasions, pending] : form.occasions;
    update.mutate(
      { id: item.id, edits: editsFrom({ ...form, occasions }) },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setEditing(false);
        },
        onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
      }
    );
  };

  if (!editing) {
    return (
      <div className="space-y-2 border-t pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t('title')}
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {hasAnything ? t('edit') : t('add')}
          </Button>
        </div>

        {!hasAnything && <p className="text-xs text-muted-foreground">{t('empty')}</p>}

        {!!tags.occasions?.length && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('occasions')}>
            {tags.occasions.map((occasion) => (
              <li key={occasion}>
                <Badge variant="secondary">{occasionLabel(occasion)}</Badge>
              </li>
            ))}
          </ul>
        )}

        <dl className="divide-y">
          <Fact label={t('home')} value={home?.name} />
          <Fact label={t('size')} value={size} />
          <Fact label={t('fitNote')} value={tags.fit_note} />
          <Fact label={t('boughtIn')} value={tags.purchase_place} />
          <Fact label={t('care')} value={tags.care_instructions} />
        </dl>

        {!!tags.composition?.length && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t('materials')}</p>
            <CompositionBar shares={tags.composition} />
          </div>
        )}
      </div>
    );
  }

  const field = (name: string) => `${formId}-${name}`;

  return (
    <form
      className="space-y-3 border-t pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t('title')}
      </div>

      {!!homes?.length && (
        <div className="space-y-1.5">
          <Label htmlFor={field('home')}>{t('home')}</Label>
          <Select value={form.homeId} onValueChange={(value) => set('homeId', value)}>
            <SelectTrigger id={field('home')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HOME}>{t('none')}</SelectItem>
              {homes.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={field('brand')}>{t('brand')}</Label>
        <Input id={field('brand')} value={form.brand} maxLength={100} onChange={(e) => set('brand', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={field('size')}>{t('size')}</Label>
          <Input id={field('size')} value={form.size} maxLength={32} onChange={(e) => set('size', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field('size-system')}>{t('sizeSystem')}</Label>
          <Input
            id={field('size-system')}
            value={form.sizeSystem}
            maxLength={32}
            placeholder={t('sizeSystemPlaceholder')}
            onChange={(e) => set('sizeSystem', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={field('fit')}>{t('fitNote')}</Label>
        <Input
          id={field('fit')}
          value={form.fitNote}
          maxLength={120}
          placeholder={t('fitNotePlaceholder')}
          onChange={(e) => set('fitNote', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={field('bought')}>{t('boughtIn')}</Label>
        <Input
          id={field('bought')}
          value={form.purchasePlace}
          maxLength={100}
          placeholder={t('boughtInPlaceholder')}
          onChange={(e) => set('purchasePlace', e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none">{t('materials')}</legend>
        {form.materials.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={t('materialName', { number: index + 1 })}
              value={row.material}
              maxLength={40}
              onChange={(e) => setMaterial(index, { material: e.target.value })}
            />
            <Input
              aria-label={t('materialPercent', { number: index + 1 })}
              value={row.percent}
              inputMode="decimal"
              placeholder="%"
              className="w-20 text-right"
              onChange={(e) => setMaterial(index, { percent: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t('removeMaterial', { number: index + 1 })}
              onClick={() =>
                set(
                  'materials',
                  form.materials.filter((_, i) => i !== index)
                )
              }
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {tooMuch && (
          <p role="alert" className="text-xs text-destructive">
            {t('tooMuch')}
          </p>
        )}
        {form.materials.length < MAX_MATERIALS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => set('materials', [...form.materials, { material: '', percent: '' }])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('addMaterial')}
          </Button>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={field('care')}>{t('care')}</Label>
        <Input
          id={field('care')}
          value={form.care}
          maxLength={255}
          placeholder={t('carePlaceholder')}
          onChange={(e) => set('care', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={field('occasion')}>{t('occasions')}</Label>
        {form.occasions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {form.occasions.map((occasion) => (
              <li key={occasion}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  {occasionLabel(occasion)}
                  <button
                    type="button"
                    aria-label={t('removeOccasion', { occasion: occasionLabel(occasion) })}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    onClick={() =>
                      set(
                        'occasions',
                        form.occasions.filter((value) => value !== occasion)
                      )
                    }
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id={field('occasion')}
            value={occasionDraft}
            maxLength={40}
            placeholder={t('occasionPlaceholder')}
            onChange={(e) => setOccasionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOccasion();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addOccasion} disabled={!cleanOccasion(occasionDraft)}>
            {t('addOccasion')}
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={update.isPending || tooMuch}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
