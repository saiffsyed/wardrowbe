'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Droplets, Grid2X2, Heart, LayoutGrid, List, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { useTypeLabel } from '@/lib/hooks/use-translated-constants';
import type { Home, Item } from '@/lib/types';
import { LaundryBadge, useLaundryOf } from './laundry';

export const VIEW_MODES = ['cutouts', 'tiles', 'list'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

const VIEW_MODE_STORAGE_KEY = 'wardrobe-view-mode';
const DEFAULT_VIEW_MODE: ViewMode = 'cutouts';

function isViewMode(value: unknown): value is ViewMode {
  return (VIEW_MODES as readonly unknown[]).includes(value);
}

// The view is a per-device habit, so it lives in localStorage. The first render always uses
// the default so the server and the browser agree, and the saved choice is applied after.
export function useWardrobeViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(DEFAULT_VIEW_MODE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (isViewMode(saved)) setMode(saved);
    } catch {
      // localStorage can be unavailable (private browsing); the default view still works.
    }
  }, []);

  const choose = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
    } catch {
      // The choice just will not be remembered.
    }
  };

  return [mode, choose];
}

const VIEW_ICONS = { cutouts: Grid2X2, tiles: LayoutGrid, list: List } as const;

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const t = useTranslations('wardrobe.closet.view');

  return (
    <div role="group" aria-label={t('label')} className="flex rounded-md border bg-background p-0.5">
      {VIEW_MODES.map((value) => {
        const Icon = VIEW_ICONS[value];
        return (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            aria-label={t(value)}
            title={t(value)}
            onClick={() => onChange(value)}
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
              mode === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

interface ItemViewProps {
  item: Item;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: () => void;
  errorDismissed?: boolean;
}

function StatusOverlay({ item, errorDismissed }: { item: Item; errorDismissed?: boolean }) {
  const t = useTranslations('wardrobe.closet.view');
  if (item.status === 'processing') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
        <Loader2 className="h-5 w-5 animate-spin text-foreground" role="img" aria-label={t('processing')} />
      </div>
    );
  }
  if (item.status === 'error' && !errorDismissed) {
    return (
      <div className="absolute bottom-1 left-1 rounded-full bg-destructive p-1 text-destructive-foreground">
        <AlertCircle className="h-3 w-3" role="img" aria-label={t('needsAttention')} />
      </div>
    );
  }
  return null;
}

function SelectBox({ item, selected, onSelect, label }: Pick<ItemViewProps, 'item' | 'selected' | 'onSelect'> & { label: string }) {
  return (
    <div
      className={`absolute left-1.5 top-1.5 z-10 transition-opacity ${
        selected ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={selected}
        aria-label={label}
        onCheckedChange={(checked) => onSelect(item.id, checked === true)}
        className="bg-background/80 backdrop-blur-sm"
      />
    </div>
  );
}

// The item on its own, nothing around it: the wardrobe as you would see it hanging.
export function CutoutTile({ item, selected, onSelect, onClick, errorDismissed }: ItemViewProps) {
  const typeLabel = useTypeLabel();
  const t = useTranslations('wardrobe.closet.view');
  const name = item.name || typeLabel(item.type);
  const laundry = useLaundryOf(item);
  const away = laundry === 'wash' || laundry === 'dry';

  return (
    <div className={`group relative aspect-square rounded-lg ${selected ? 'ring-2 ring-primary' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={name}
        className="photo-ground absolute inset-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {item.thumbnail_url ? (
          <Image
            src={item.thumbnail_url}
            alt=""
            fill
            className={`object-contain p-1 transition-transform group-hover:scale-[1.03] ${away ? 'opacity-45' : ''}`}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-lg bg-muted px-1 text-center text-xs text-muted-foreground">
            {name}
          </span>
        )}
        <StatusOverlay item={item} errorDismissed={errorDismissed} />
      </button>
      <SelectBox item={item} selected={selected} onSelect={onSelect} label={t('select', { item: name })} />
      {away ? (
        <span className="pointer-events-none absolute bottom-1 left-1">
          <LaundryBadge state={laundry} small />
        </span>
      ) : (
        item.needs_wash && (
          <div className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-amber-500 p-1 text-white">
            <Droplets className="h-3 w-3" role="img" aria-label={t('needsWash')} />
          </div>
        )
      )}
    </div>
  );
}

function compositionText(item: Item): string | undefined {
  const shares = item.tags?.composition;
  if (shares?.length) {
    return shares.map((share) => `${share.material} ${share.percent}%`).join(', ');
  }
  return item.tags?.material || undefined;
}

// One row per item with what a label and a receipt say about it: the wardrobe as a database.
export function ItemListRow({
  item,
  selected,
  onSelect,
  onClick,
  errorDismissed,
  home,
}: ItemViewProps & { home?: Home }) {
  const typeLabel = useTypeLabel();
  const t = useTranslations('wardrobe.closet');
  const name = item.name || typeLabel(item.type);
  const size = item.tags?.size;
  const laundry = useLaundryOf(item);
  const facts = [item.brand, size ? t('list.size', { size }) : undefined, compositionText(item)].filter(
    (fact): fact is string => !!fact
  );

  return (
    <li className={`group relative flex items-center gap-3 border-b py-2 ${selected ? 'bg-primary/5' : ''}`}>
      <div className="relative h-16 w-16 shrink-0">
        <div className="photo-ground relative h-full w-full overflow-hidden rounded-md">
          {item.thumbnail_url && (
            <Image src={item.thumbnail_url} alt="" fill className="object-contain p-0.5" sizes="64px" />
          )}
          <StatusOverlay item={item} errorDismissed={errorDismissed} />
        </div>
        <SelectBox item={item} selected={selected} onSelect={onSelect} label={t('view.select', { item: name })} />
      </div>
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          {item.favorite && <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500" aria-hidden="true" />}
        </span>
        {facts.length > 0 && (
          <span className="w-full truncate text-xs capitalize text-muted-foreground">{facts.join(' · ')}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {laundry ? <LaundryBadge state={laundry} small /> : t('list.worn', { count: item.wear_count })}
        </span>
      </button>
      {home && (
        <span className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium">{home.name}</span>
      )}
    </li>
  );
}
