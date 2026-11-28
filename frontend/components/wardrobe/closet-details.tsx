'use client';

import { useId, useState } from 'react';
import { useLocale } from 'next-intl';
import { Pencil, Plus, ScanLine, Search, Tag, X } from 'lucide-react';
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
import { LabelPhotos } from '@/components/wardrobe/label-photos';
import { LabelScanDialog } from '@/components/wardrobe/label-scan-dialog';
import { CataloguePhotoDialog } from '@/components/wardrobe/catalogue-photo-dialog';
import { ProductFinderDialog } from '@/components/wardrobe/product-finder-dialog';
import { getErrorMessage } from '@/lib/api';
import {
  useHomes,
  useUpdateClosetDetails,
  type ClosetDetailEdits,
} from '@/lib/hooks/use-homes';
import { useMaterialLabel, useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import type { Item, MaterialShare } from '@/lib/types';
import { LaundryBadge, useLaundryOf } from './laundry';

const NO_HOME = '__none__';
// The currencies offered for a price, the homes' first. Anything else can be added here.
const CURRENCIES = ['INR', 'EUR', 'GBP', 'USD', 'AED', 'CHF', 'SGD'] as const;
const LAST_CURRENCY_KEY = 'closet-last-currency';

function lastCurrency(): string {
  try {
    return window.localStorage.getItem(LAST_CURRENCY_KEY) || 'INR';
  } catch {
    return 'INR';
  }
}

function rememberCurrency(currency: string) {
  try {
    window.localStorage.setItem(LAST_CURRENCY_KEY, currency);
  } catch {
    // Remembering the last currency is a convenience; a blocked store just means picking it again.
  }
}

function priceText(amount: number | null | undefined, currency: string | undefined, locale: string) {
  if (amount == null) return undefined;
  amount = Number(amount);
  // Whole amounts without ".00"; prices with cents keep them.
  const fraction = Number.isInteger(amount) ? 0 : 2;
  try {
    return currency
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: fraction,
          maximumFractionDigits: fraction,
        }).format(amount)
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount}${currency ? ` ${currency}` : ''}`;
  }
}
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
  articleNumber: string;
  size: string;
  sizeSystem: string;
  fitNote: string;
  purchasePlace: string;
  purchaseDate: string;
  price: string;
  currency: string;
  care: string;
  materials: MaterialRow[];
  occasions: string[];
  homeId: string;
}

function formFromItem(item: Item): DetailsForm {
  return {
    brand: item.brand ?? '',
    articleNumber: item.tags?.article_number ?? '',
    size: item.tags?.size ?? '',
    sizeSystem: item.tags?.size_system ?? '',
    fitNote: item.tags?.fit_note ?? '',
    purchasePlace: item.tags?.purchase_place ?? '',
    purchaseDate: item.purchase_date ?? '',
    // The server sends the price as a decimal string ("4500.00"); edit it as a plain number.
    price: item.purchase_price != null ? String(Number(item.purchase_price)) : '',
    currency: item.tags?.currency ?? lastCurrency(),
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
  const price = Number(form.price.replace(',', '.').trim());
  const hasPrice = form.price.trim() !== '' && Number.isFinite(price) && price >= 0;
  return {
    home_id: form.homeId === NO_HOME ? null : form.homeId,
    brand: text(form.brand),
    purchase_date: form.purchaseDate || null,
    purchase_price: hasPrice ? price : null,
    tags: {
      currency: hasPrice ? form.currency : null,
      article_number: text(form.articleNumber),
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

const CARD = 'rounded-2xl border bg-card';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

// The Status tile: the laundry badge when the item is waiting for a wash or away being cleaned.
function LaundryTile({ label, item, ready }: { label: string; item: Item; ready: string }) {
  const state = useLaundryOf(item);
  return (
    <div className={`${CARD} flex min-h-[3.75rem] flex-col justify-center gap-0.5 px-3`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {state !== 'clean' ? <span><LaundryBadge state={state} /></span> : <span className="truncate text-[15px] font-semibold">{ready}</span>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${CARD} flex min-h-[3.75rem] flex-col justify-center gap-0.5 px-3`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-[15px] font-semibold">{value}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex min-h-[3rem] items-center justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

// What a label and a receipt say about an item (size, fibre content, care, where it was
// bought), plus the occasions it is for and the home it is kept in. Edited in place and saved
// on its own, apart from the dialog's main edit form.
export function ClosetDetails({ item }: { item: Item }) {
  const t = useTranslations('wardrobe.closet.details');
  const locale = useLocale();
  const occasionLabel = useOccasionLabel();
  const { data: homes } = useHomes();
  const update = useUpdateClosetDetails();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DetailsForm>(() => formFromItem(item));
  const [occasionDraft, setOccasionDraft] = useState('');
  const [scanning, setScanning] = useState(false);
  const [finding, setFinding] = useState(false);
  const [tidying, setTidying] = useState(false);

  const tags = item.tags ?? {};
  const home = homes?.find((candidate) => candidate.id === item.home_id);
  const size = [tags.size, tags.size_system].filter(Boolean).join(' · ') || undefined;
  const hasAnything =
    !!(size || tags.fit_note || tags.purchase_place || tags.care_instructions || home) ||
    !!item.purchase_date ||
    item.purchase_price != null ||
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
    if (form.price.trim()) rememberCurrency(form.currency);
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
    // Care is typed and read as one line, and shown one instruction to a row.
    const careSteps = (tags.care_instructions ?? '')
      .split(/[,;\n]/)
      .map((step) => step.trim())
      .filter(Boolean)
      // Each row starts a line of its own, so it starts with a capital.
      .map((step) => step.charAt(0).toLocaleUpperCase() + step.slice(1));
    const price = priceText(item.purchase_price, tags.currency, locale);
    const boughtOn = item.purchase_date
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${item.purchase_date}T00:00:00`))
      : undefined;
    const hasFacts = !!(item.brand || tags.article_number || size || tags.fit_note || tags.purchase_place || boughtOn || price);

    return (
      <div className="space-y-4 border-t pt-3">
        <div className="grid grid-cols-2 gap-2.5">
          {home && <Tile label={t('home')} value={home.name} />}
          <LaundryTile label={t('status')} item={item} ready={t('statusReady')} />
        </div>

        {!!tags.occasions?.length && (
          <section className="space-y-2">
            <SectionLabel>{t('occasions')}</SectionLabel>
            <ul className="flex flex-wrap gap-2" aria-label={t('occasions')}>
              {tags.occasions.map((occasion) => (
                <li
                  key={occasion}
                  className="flex h-9 items-center rounded-[10px] border border-primary bg-accent px-3.5 text-sm font-semibold text-accent-foreground"
                >
                  {occasionLabel(occasion)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>{t('title')}</SectionLabel>
            <div className="-my-1 flex items-center">
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setScanning(true)}>
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                {t('scanLabel')}
              </Button>
              {item.brand && (
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setFinding(true)}>
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('findOnline')}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {hasAnything ? t('edit') : t('add')}
              </Button>
            </div>
          </div>
          {hasFacts ? (
            <dl className={`${CARD} divide-y px-3.5`}>
              <Fact label={t('brand')} value={item.brand ?? undefined} />
              <Fact label={t('articleNumber')} value={tags.article_number} />
              <Fact label={t('size')} value={size} />
              <Fact label={t('fitNote')} value={tags.fit_note} />
              <Fact label={t('boughtIn')} value={tags.purchase_place} />
              <Fact label={t('boughtOn')} value={boughtOn} />
              <Fact label={t('price')} value={price} />
            </dl>
          ) : null}
        </section>

        {!!tags.composition?.length && (
          <section className="space-y-2">
            <SectionLabel>{t('materials')}</SectionLabel>
            <div className={`${CARD} p-3.5`}>
              <CompositionBar shares={tags.composition} />
            </div>
          </section>
        )}

        {careSteps.length > 0 && (
          <section className="space-y-2">
            <SectionLabel>{t('care')}</SectionLabel>
            <ol className={`${CARD} divide-y px-3.5`} aria-label={t('care')}>
              {careSteps.map((step, index) => (
                <li key={index} className="flex min-h-[2.75rem] items-center py-2 text-[15px]">
                  {step}
                </li>
              ))}
            </ol>
          </section>
        )}

        <LabelPhotos itemId={item.id} />
        <LabelScanDialog item={item} open={scanning} onOpenChange={setScanning} onFindProduct={() => setFinding(true)} />
        <ProductFinderDialog
          item={item}
          open={finding}
          onOpenChange={setFinding}
          onCataloguePhoto={() => setTidying(true)}
        />
        <CataloguePhotoDialog item={item} open={tidying} onOpenChange={setTidying} />
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

      <div className="space-y-1.5">
        <Label htmlFor={field('article')}>{t('articleNumber')}</Label>
        <Input
          id={field('article')}
          value={form.articleNumber}
          maxLength={60}
          onChange={(e) => set('articleNumber', e.target.value)}
        />
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

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5 min-[420px]:col-span-1">
          <Label htmlFor={field('bought-on')}>{t('boughtOn')}</Label>
          <Input
            id={field('bought-on')}
            type="date"
            value={form.purchaseDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set('purchaseDate', e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1.5 min-[420px]:col-span-1">
          <Label htmlFor={field('price')}>{t('price')}</Label>
          <div className="flex gap-1.5">
            <Input
              id={field('price')}
              value={form.price}
              inputMode="decimal"
              placeholder="0"
              className="min-w-0"
              onChange={(e) => set('price', e.target.value)}
            />
            <Select value={form.currency} onValueChange={(value) => set('currency', value)}>
              <SelectTrigger aria-label={t('currency')} className="w-[5.5rem] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(CURRENCIES.includes(form.currency as (typeof CURRENCIES)[number])
                  ? CURRENCIES
                  : [form.currency, ...CURRENCIES]
                ).map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
