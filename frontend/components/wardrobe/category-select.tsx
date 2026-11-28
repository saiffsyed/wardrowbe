'use client';

import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategoryLabel } from '@/lib/hooks/use-wardrobe-categories';
import type { CategoryGroup } from '@/lib/wardrobe-categories';

// The wardrobe's categories as one filter (Saiff moved them off the screen into the filter
// panel): each group, then its smaller categories set in under it. Empty ones are left out,
// except whatever is chosen now.
export function CategorySelect({
  groups,
  value,
  onChange,
}: {
  groups: CategoryGroup[];
  value: string;
  onChange: (category: string) => void;
}) {
  const t = useTranslations('wardrobe.closet.categories');
  const label = useCategoryLabel();
  const shown = groups.filter((group) => group.item_count > 0 || group.id === value || group.children.some((c) => c.id === value));

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-xs sm:w-[180px]" aria-label={t('label')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('anyCategory')}</SelectItem>
        {shown.map((group) => (
          <div key={group.id}>
            <SelectItem value={group.id} className="font-semibold">
              {label(group)}
            </SelectItem>
            {group.children.length > 1 &&
              group.children
                .filter((child) => child.item_count > 0 || child.id === value)
                .map((child) => (
                  <SelectItem key={child.id} value={child.id} className="pl-8">
                    {label(child)}
                  </SelectItem>
                ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
