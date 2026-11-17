'use client';

import { useState, type ReactNode } from 'react';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { MobileMenuButton } from '@/components/wardrobe/mobile-menu';
import { HomePill, HomeScopeToggle, type HomeScope } from '@/components/wardrobe/home-bar';
import { useCategoryLabel } from '@/lib/hooks/use-wardrobe-categories';
import { groupOfCategory, type CategoryGroup } from '@/lib/wardrobe-categories';
import type { Home } from '@/lib/types';

interface WardrobeHeaderProps {
  homes: Home[];
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
  // The person's categories with item counts; a group or sub-group with nothing in it is not
  // offered, so each person's bar holds only what they own.
  groups: CategoryGroup[];
  // 'all', or the id of a group or of a sub-group.
  category: string;
  onCategoryChange: (category: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  filterCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onAdd: () => void;
  total: number;
  // What the app is doing with the photos (analysing, queued, failed), when there is something.
  status?: ReactNode;
}

const CHIP_ROW =
  '-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden';

function Chip({
  selected,
  small = false,
  onClick,
  children,
}: {
  selected: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  // Main chips fill solid when chosen; the second row uses the soft accent, so the two rows
  // read as "where you are" and "narrowed to".
  const chosen = small
    ? 'border-primary bg-accent font-semibold text-accent-foreground'
    : 'border-foreground bg-foreground font-semibold text-background';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 rounded-full border text-sm transition-colors ${small ? 'h-10 px-3.5' : 'h-11 px-4'} ${
        selected ? chosen : 'bg-card font-medium text-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {children}
    </button>
  );
}

const ROUND = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors';
const ROUND_QUIET = `${ROUND} border bg-card text-foreground hover:bg-accent hover:text-accent-foreground`;

// The top of the wardrobe: where you are, the three things you do (filter, search, add), and
// the category chips. Laid out for a thumb on a phone; the same row simply has more air on a
// wide screen.
export function WardrobeHeader({
  homes,
  scope,
  onScopeChange,
  groups,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  filterCount,
  filtersOpen,
  onToggleFilters,
  onAdd,
  total,
  status,
}: WardrobeHeaderProps) {
  const t = useTranslations('wardrobe');
  const tc = useTranslations('wardrobe.closet.categories');
  // Search stays open while it holds text, so a search can never be active and invisible.
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || !!search;
  const filtersOn = filtersOpen || filterCount > 0;
  const categoryLabel = useCategoryLabel();
  const openGroup = category === 'all' ? undefined : groupOfCategory(groups, category);
  // What is chosen stays on show even if its last item has just gone.
  const shownGroups = groups.filter((group) => group.item_count > 0 || group.id === openGroup?.id);
  const shownChildren = (openGroup?.children ?? []).filter(
    (child) => child.item_count > 0 || child.id === category
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MobileMenuButton />
          <HomePill homes={homes} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={t('closet.filters.toggle')}
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
            className={`relative ${
              filtersOn ? `${ROUND} border border-primary bg-accent text-accent-foreground` : ROUND_QUIET
            }`}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            {filterCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {filterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label={t('closet.header.search')}
            aria-expanded={showSearch}
            onClick={() => setSearchOpen((open) => !open)}
            className={ROUND_QUIET}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('actions.addItem')}
            onClick={onAdd}
            className={`${ROUND} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            <Plus className="h-[22px] w-[22px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{t('closet.header.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('closet.header.count', { count: total })}</p>
        </div>
        <HomeScopeToggle homes={homes} scope={scope} onScopeChange={onScopeChange} />
      </div>

      {status}

      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus={searchOpen}
            placeholder={t('search')}
            aria-label={t('closet.header.search')}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 rounded-full bg-card pl-10 pr-11"
          />
          <button
            type="button"
            aria-label={t('closet.header.closeSearch')}
            onClick={() => {
              onSearchChange('');
              setSearchOpen(false);
            }}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Bleeds to the screen edges so the row visibly scrolls on, instead of ending at the margin. */}
      {shownGroups.length > 0 && (
        <div role="group" aria-label={tc('label')} className={CHIP_ROW}>
          <Chip selected={category === 'all'} onClick={() => onCategoryChange('all')}>
            {tc('all')}
          </Chip>
          {shownGroups.map((group) => (
            <Chip
              key={group.id}
              selected={openGroup?.id === group.id}
              onClick={() => onCategoryChange(group.id)}
            >
              {categoryLabel(group)}
            </Chip>
          ))}
        </div>
      )}

      {/* The chosen group's own row. With one kind of thing in the group there is nothing to
          narrow down to. */}
      {openGroup && shownChildren.length > 1 && (
        <div role="group" aria-label={categoryLabel(openGroup)} className={CHIP_ROW}>
          <Chip small selected={category === openGroup.id} onClick={() => onCategoryChange(openGroup.id)}>
            {tc('allOf', { group: categoryLabel(openGroup) })}
          </Chip>
          {shownChildren.map((child) => (
            <Chip
              key={child.id}
              small
              selected={category === child.id}
              onClick={() => onCategoryChange(child.id)}
            >
              {categoryLabel(child)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
