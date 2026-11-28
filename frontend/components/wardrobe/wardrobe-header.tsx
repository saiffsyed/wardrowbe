'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { type HomeScope } from '@/components/wardrobe/home-bar';
import { AppTopBar } from '@/components/wardrobe/app-top-bar';
import { WeatherBar } from '@/components/wardrobe/weather-bar';
import { StayHomePrompt } from '@/components/wardrobe/stay-home-prompt';
import { useFoldOnScroll } from '@/lib/hooks/use-fold-on-scroll';
import type { CategoryGroup } from '@/lib/wardrobe-categories';
import type { Home } from '@/lib/types';
import { WardrobeTabs } from './wardrobe-tabs';

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
  // Kept for callers; the header no longer shows an item count.
  total?: number;
  // What the app is doing with the photos (analysing, queued, failed), when there is something.
  status?: ReactNode;
  // Sort, views and the filter panel: they fold away with the rest while scrolling.
  toolbar?: React.ReactNode;
}

const ROUND = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors';
const ROUND_QUIET = `${ROUND} border bg-card text-foreground hover:bg-accent hover:text-accent-foreground`;

// The top of the wardrobe: where you are, the three things you do (filter, search, add), and
// the category chips. Laid out for a thumb on a phone; the same row simply has more air on a
// wide screen.
export function WardrobeHeader({
  homes,
  scope,
  groups,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  filterCount,
  filtersOpen,
  onToggleFilters,
  onAdd,
  status,
  toolbar,
}: WardrobeHeaderProps) {
  const t = useTranslations('wardrobe');
  // Search stays open while it holds text, so a search can never be active and invisible.
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || !!search;
  const filtersOn = filtersOpen || filterCount > 0;
  // Scrolling down folds everything below the top row away; scrolling up brings it back.
  // Never while the filter panel or the search box is open, which the person is using.
  const scrolledAway = useFoldOnScroll();
  const topRowRef = useRef<HTMLDivElement>(null);
  const [topRowHeight, setTopRowHeight] = useState(76);
  useEffect(() => {
    const row = topRowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTopRowHeight(row.offsetHeight));
    observer.observe(row);
    return () => observer.disconnect();
  }, []);
  const folded = scrolledAway && !filtersOpen && !showSearch;
  const showingAllHomes = scope === 'all' && homes.some((home) => home.is_current);

  return (
    // Stays at the top of the screen on a phone, so the home, filter, search and add buttons
    // are always in reach; a laptop has room enough without.
    // On a phone the two parts stick to the page rather than to this box ("contents"), so they
    // stay in view however far down the clothes go.
    <div className="contents lg:block lg:space-y-3">
      <h1 className="sr-only">{t('closet.header.title')}</h1>
      <div
        ref={topRowRef}
        className="sticky top-0 z-30 -mx-4 -mt-4 bg-background px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:-mx-6 sm:px-6 lg:static lg:m-0 lg:p-0"
      >
      <AppTopBar homes={homes}>
          <button
            type="button"
            aria-label={t('closet.filters.toggle')}
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
            className={`relative ${
              filtersOn ? `${ROUND} border border-primary bg-accent text-accent-foreground` : ROUND_QUIET
            }`}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
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
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('actions.addItem')}
            onClick={onAdd}
            className={`${ROUND} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
      </AppTopBar>
      </div>

      {/* Slides up behind the top row while scrolling down, instead of shrinking, so the
          clothes underneath never jump. */}
      <div
        className={`${filtersOpen ? 'relative' : 'sticky'} z-20 -mx-4 bg-background px-4 pb-3 transition-[transform,opacity] duration-200 motion-reduce:transition-none sm:-mx-6 sm:px-6 lg:static lg:m-0 lg:p-0 lg:opacity-100 lg:translate-y-0 ${
          folded ? 'pointer-events-none -translate-y-full opacity-0 lg:pointer-events-auto' : ''
        }`}
        // Only a sticky box uses top; on a relative one it would push everything down by the
        // top row's height and leave a gap.
        style={filtersOpen ? undefined : { top: topRowHeight }}
        aria-hidden={folded || undefined}
        // Folded controls must not be reachable by keyboard either.
        {...(folded ? ({ inert: '' } as Record<string, string>) : {})}
      >
      <div className="space-y-3">
      {/* No visible title or item count: the app's name is in the top row and "Wardrobe" on
          the bottom bar (Saiff asked for both to go). The heading stays for screen readers.
          "All homes" still shows while it is on, since that choice lives in the filter panel. */}
      <WeatherBar />
      <StayHomePrompt />
      {showingAllHomes && (
        <p className="text-sm font-medium text-muted-foreground">{t('closet.homes.everywhere')}</p>
      )}

      <WardrobeTabs value="clothes" />

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

      {toolbar}
      </div>
      </div>
    </div>
  );
}
