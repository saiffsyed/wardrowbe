'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudRain, Home as HomeIcon, Plane, Snowflake, Sun, WashingMachine, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import { weekdayShort } from '@/lib/day-format';
import { headsUps, type HeadsUp, type HeadsUpKind } from '@/lib/heads-ups';
import { useHomes, useSetCurrentHome } from '@/lib/hooks/use-homes';
import { useItems } from '@/lib/hooks/use-items';
import { useLaundry, useLaundryStates } from '@/lib/hooks/use-laundry';
import type { Outfit } from '@/lib/hooks/use-outfits';
import { usePreferences } from '@/lib/hooks/use-preferences';
import type { Stay, WeatherDay } from '@/lib/hooks/use-stays';
import { useTypeLabel } from '@/lib/hooks/use-translated-constants';
import { displayValue } from '@/lib/temperature';
import { forgetTrip, isBackFrom, tripToReturnFrom } from '@/lib/trip-return';

const ICON: Record<HeadsUpKind, typeof Sun> = {
  away: WashingMachine,
  rain: CloudRain,
  hot: Sun,
  cold: Snowflake,
  trip: Plane,
  home: HomeIcon,
  washBeforeRain: WashingMachine,
};
const HIDDEN_KEY = 'heads-ups-hidden';

function hiddenToday(day: string): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '{}') as Record<string, string[]>;
    return new Set(saved[day] ?? []);
  } catch {
    return new Set();
  }
}

function hide(day: string, id: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '{}') as Record<string, string[]>;
    // Only the recent days are kept.
    const kept = Object.fromEntries(Object.entries(saved).filter(([date]) => date >= day).slice(-14));
    kept[day] = Array.from(new Set([...(kept[day] ?? []), id]));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(kept));
  } catch {
    // Without storage it shows again next time.
  }
}

// The heads-up line under the week (lib/heads-ups.ts has the rules): the most important one,
// "+N more" for the rest; ✕ hides one for that day.
export function HeadsUps({
  day,
  today,
  look,
  weatherByDay,
  stays,
  onSwap,
  onShown,
}: {
  day: string;
  today: string;
  look: Outfit | undefined;
  weatherByDay: Map<string, WeatherDay>;
  stays: Stay[] | undefined;
  onSwap: () => void;
  // How many lines are showing (0 when none), so the look can make room for them.
  onShown?: (lines: number) => void;
}) {
  const t = useTranslations('wardrobe.closet.headsUps');
  const locale = useLocale();
  const router = useRouter();
  const typeLabel = useTypeLabel();
  const { data: prefs } = usePreferences();
  const fahrenheit = prefs?.temperature_unit === 'fahrenheit';
  const { data: homes } = useHomes();
  const current = homes?.find((home) => home.is_current);
  const { data: itemList } = useItems({ home_id: current?.id, is_archived: false }, 1, 100);
  const { data: laundry } = useLaundryStates();
  const { data: lists } = useLaundry(current?.id);
  const setCurrent = useSetCurrentHome();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => hiddenToday(day));
  const [hiddenFor, setHiddenFor] = useState(day);
  if (hiddenFor !== day) {
    setHiddenFor(day);
    setHidden(hiddenToday(day));
  }

  const trip = typeof window === 'undefined' ? null : tripToReturnFrom();
  const back = isBackFrom(trip, today, stays, current?.id) ? homes?.find((home) => home.id === trip!.from) : undefined;

  const all = useMemo(
    () =>
      headsUps({
        day,
        today,
        look,
        items: new Map((itemList?.items ?? []).map((item) => [item.id, item])),
        laundry: laundry ?? new Map(),
        forecast: new Map(Array.from(weatherByDay.entries()).map(([date, entry]) => [date, { forecast: entry.forecast, city: entry.city }])),
        stays: stays ?? [],
        toWash: lists?.to_wash.length ?? 0,
        returned: back ? { homeName: back.name } : undefined,
        name: (piece) => piece.name || typeLabel(piece.type),
      }),
    [day, today, look, itemList, laundry, weatherByDay, stays, lists, back, typeLabel]
  );
  const shown = all.filter((entry) => !hidden.has(entry.id));
  const lines = shown.length === 0 ? 0 : open ? shown.length + 1 : shown.length > 1 ? 2 : 1;
  useEffect(() => onShown?.(lines), [lines, onShown]);
  if (!shown.length) return null;

  const temp = (celsius: number) => `${displayValue(celsius, fahrenheit ? 'fahrenheit' : 'celsius')}°`;
  const gap = (celsius: number) => `${Math.round(fahrenheit ? celsius * 1.8 : celsius)}°`;
  const sentence = (entry: HeadsUp) => {
    const v = entry.values;
    switch (entry.kind) {
      case 'hot':
      case 'cold':
        return t(entry.kind, { ...v, temp: temp(Number(v.temp)) });
      case 'trip':
        return t('trip', { ...v, day: weekdayShort(String(v.day), locale), temp: temp(Number(v.temp)), difference: gap(Number(v.difference)) });
      case 'washBeforeRain':
        return t('washBeforeRain', { ...v, from: weekdayShort(String(v.from), locale), to: weekdayShort(String(v.to), locale) });
      default:
        return t(entry.kind, v);
    }
  };
  const act = (entry: HeadsUp) => {
    if (entry.action === 'swap') {
      if (day === today) onSwap();
      else if (look) router.push(`/dashboard/outfits/make?edit=${look.id}`);
    } else if (entry.action === 'weather') router.push('/dashboard/weather');
    else if (entry.action === 'laundry') router.push('/dashboard/more/laundry');
    else if (entry.action === 'home' && trip) {
      setCurrent.mutate(trip.from, {
        onSuccess: () => forgetTrip(),
        onError: (error) => toast.error(getErrorMessage(error, t('homeError'))),
      });
    }
  };
  const actionLabel = (entry: HeadsUp) => (entry.action === 'swap' && day !== today ? t('actions.change') : t(`actions.${entry.action}`));

  return (
    <div className="space-y-1.5" aria-live="polite">
      {(open ? shown : shown.slice(0, 1)).map((entry) => {
        const Icon = ICON[entry.kind];
        return (
          <div
            key={entry.id}
            className={`flex items-center gap-2 rounded-2xl py-2 pl-3 pr-1.5 text-[13.5px] font-semibold ${
              entry.tone === 'warn'
                ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{sentence(entry)}</span>
            <button
              type="button"
              onClick={() => act(entry)}
              disabled={setCurrent.isPending}
              className="shrink-0 font-extrabold underline underline-offset-[3px]"
            >
              {actionLabel(entry)}
            </button>
            <button
              type="button"
              aria-label={t('hide')}
              onClick={() => {
                hide(day, entry.id);
                setHidden(new Set([...Array.from(hidden), entry.id]));
                if (entry.kind === 'home') forgetTrip();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {shown.length > 1 && (
        <button type="button" onClick={() => setOpen((value) => !value)} className="px-1 text-xs font-bold text-muted-foreground">
          {open ? t('less') : t('more', { count: shown.length - 1 })}
        </button>
      )}
    </div>
  );
}
