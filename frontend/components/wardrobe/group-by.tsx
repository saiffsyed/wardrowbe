'use client';

import { Fragment, type ReactNode } from 'react';
import { Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Item } from '@/lib/types';

// What the wardrobe can be grouped by, and the item list's sort key that brings each group's
// items together.
export const GROUP_BY = {
  none: null,
  type: 'type',
  color: 'primary_color',
  home: 'home',
  brand: 'brand',
} as const;

export type GroupBy = keyof typeof GROUP_BY;

export function isGroupBy(value: string | null | undefined): value is GroupBy {
  return !!value && value in GROUP_BY;
}

function keyOf(item: Item, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'type':
      return item.type;
    case 'color':
      return item.primary_color ?? '';
    case 'home':
      return item.home_id ?? '';
    case 'brand':
      return item.brand?.trim().toLowerCase() ?? '';
    default:
      return '';
  }
}

/** Runs of items that share a group key, in the order the list arrives (sorted by that key). */
export function groupItems(items: Item[], groupBy: GroupBy): { key: string; items: Item[] }[] {
  const groups: { key: string; items: Item[] }[] = [];
  for (const item of items) {
    const key = keyOf(item, groupBy);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function GroupBySelect({ value, onChange }: { value: GroupBy; onChange: (value: GroupBy) => void }) {
  const t = useTranslations('wardrobe.closet.groupBy');
  return (
    <Select value={value} onValueChange={(next) => isGroupBy(next) && onChange(next)}>
      <SelectTrigger className="h-8 w-full text-xs sm:w-[150px]" aria-label={t('label')}>
        <Rows3 className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(GROUP_BY) as GroupBy[]).map((option) => (
          <SelectItem key={option} value={option}>
            {option === 'none' ? t('none') : t('by', { what: t(option) })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The wardrobe's items, either as one run or under a heading per group. */
export function GroupedItems({
  items,
  groupBy,
  label,
  render,
}: {
  items: Item[];
  groupBy: GroupBy;
  // The heading for a group's key; an empty key is the "none" group (no colour, no brand...).
  label: (key: string) => string;
  render: (items: Item[]) => ReactNode;
}) {
  if (groupBy === 'none') return <>{render(items)}</>;
  return (
    <div className="space-y-5 pb-20">
      {groupItems(items, groupBy).map((group) => (
        <Fragment key={group.key || '__none__'}>
          <section className="space-y-2" aria-label={label(group.key)}>
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              {label(group.key)}
              <span className="text-xs font-normal text-muted-foreground">{group.items.length}</span>
            </h2>
            {render(group.items)}
          </section>
        </Fragment>
      ))}
    </div>
  );
}
