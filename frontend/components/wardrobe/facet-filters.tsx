'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEASON_VALUES } from '@/lib/generated/garment-vocabulary';
import {
  useColorLabel,
  useMaterialLabel,
  useOccasionLabel,
  useSeasonLabel,
} from '@/lib/hooks/use-translated-constants';
import type { FacetValue, WardrobeFacets } from '@/lib/types';

export interface FacetSelection {
  occasion?: string;
  brand?: string;
  material?: string;
  season?: string;
  color?: string;
  worn?: string;
  in_outfits?: string;
}

// Each key is also the item list's query parameter of the same name.
export const FACET_KEYS = ['color', 'occasion', 'brand', 'material', 'season', 'worn', 'in_outfits'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export function activeFacetCount(selection: FacetSelection): number {
  return FACET_KEYS.filter((key) => !!selection[key]).length;
}

const ANY = '__any__';

function FacetSelect({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: FacetValue[];
  optionLabel: (value: string) => string;
  onChange: (value: string | undefined) => void;
}) {
  const t = useTranslations('wardrobe.closet.filters');
  // A filter that is set stays offered even when nothing matches any more (the last such item
  // was edited), so the person can still see it and switch it off.
  const shown =
    value && !options.some((option) => option.value === value)
      ? [{ value, count: 0 }, ...options]
      : options;

  if (shown.length === 0) return null;

  return (
    <Select value={value ?? ANY} onValueChange={(next) => onChange(next === ANY ? undefined : next)}>
      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t('any', { filter: label })}</SelectItem>
        {shown.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.count > 0
              ? t('option', { label: optionLabel(option.value), count: option.count })
              : optionLabel(option.value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Filters drawn from the wardrobe itself: only occasions, brands and materials that some item
// has are offered, each with how many items it would show.
export function FacetFilters({
  facets,
  selection,
  onChange,
}: {
  facets: WardrobeFacets | undefined;
  selection: FacetSelection;
  onChange: (key: FacetKey, value: string | undefined) => void;
}) {
  const t = useTranslations('wardrobe.closet.filters');
  const occasionLabel = useOccasionLabel();
  const materialLabel = useMaterialLabel();
  const seasonLabel = useSeasonLabel();
  const colorLabel = useColorLabel();
  const seasons: FacetValue[] = SEASON_VALUES.map((value) => ({ value, count: 0 }));
  // Fixed choices rather than counts drawn from the wardrobe.
  const wornOptions: FacetValue[] = ['never', 'not_recently'].map((value) => ({ value, count: 0 }));
  const outfitOptions: FacetValue[] = ['true', 'false'].map((value) => ({ value, count: 0 }));

  return (
    <>
      <FacetSelect
        label={t('color')}
        value={selection.color}
        options={facets?.colors ?? []}
        optionLabel={colorLabel}
        onChange={(value) => onChange('color', value)}
      />
      <FacetSelect
        label={t('occasion')}
        value={selection.occasion}
        options={facets?.occasions ?? []}
        optionLabel={occasionLabel}
        onChange={(value) => onChange('occasion', value)}
      />
      <FacetSelect
        label={t('brand')}
        value={selection.brand}
        options={facets?.brands ?? []}
        optionLabel={(value) => value}
        onChange={(value) => onChange('brand', value)}
      />
      <FacetSelect
        label={t('material')}
        value={selection.material}
        options={facets?.materials ?? []}
        optionLabel={materialLabel}
        onChange={(value) => onChange('material', value)}
      />
      <FacetSelect
        label={t('season')}
        value={selection.season}
        options={seasons}
        optionLabel={seasonLabel}
        onChange={(value) => onChange('season', value)}
      />
      <FacetSelect
        label={t('worn')}
        value={selection.worn}
        options={wornOptions}
        optionLabel={(value) => t(`wornOptions.${value}`)}
        onChange={(value) => onChange('worn', value)}
      />
      <FacetSelect
        label={t('inOutfits')}
        value={selection.in_outfits}
        options={outfitOptions}
        optionLabel={(value) => t(`inOutfitsOptions.${value}`)}
        onChange={(value) => onChange('in_outfits', value)}
      />
    </>
  );
}
