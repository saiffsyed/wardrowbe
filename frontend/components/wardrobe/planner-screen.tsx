'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, dayAndMonth, dayDate, weekdayShort } from '@/lib/day-format';
import { useCalendarOutfits, useOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useStays, useWeatherDays, type Stay, type WeatherDay } from '@/lib/hooks/use-stays';
import { useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { useUserToday } from '@/lib/hooks/use-user';
import { displayValue } from '@/lib/temperature';
import { formatDateKey } from '@/lib/utils';
import { AddOutfitSheet, piecesOf } from './add-outfit-sheet';
import { AddStayDialog } from './add-stay-dialog';
import { weatherIcon } from './home-weather';
import { LookTile } from './look-tile';
import { WeatherSheet } from './weather-sheet';

// The forecast reaches 16 days ahead, today included.
const FORECAST_DAYS = 16;

type View = 'day' | 'month';

function weekOf(day: string): string[] {
  const start = addDays(day, -dayDate(day).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// What to show for a day: a worn or accepted outfit before a pending suggestion.
function lookFor(outfits: Outfit[] | undefined, day: string): Outfit | undefined {
  const onDay = (outfits ?? []).filter((outfit) => outfit.scheduled_for === day && outfit.status !== 'rejected');
  return onDay.find((outfit) => outfit.status !== 'pending') ?? onDay[0];
}

function stayOn(stays: Stay[] | undefined, day: string): Stay | undefined {
  return stays?.find((stay) => stay.start_date <= day && day <= stay.end_date);
}

function TinyWeather({ day }: { day: WeatherDay | undefined }) {
  if (!day?.forecast) return <span className="block h-4" aria-hidden="true" />;
  const Icon = weatherIcon(day.forecast.condition);
  return <Icon className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />;
}

export function PlannerScreen() {
  const t = useTranslations('wardrobe.closet.planner');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useUserToday()();
  const view: View = searchParams.get('view') === 'month' ? 'month' : 'day';
  const selected = searchParams.get('day') || today;
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [changingPlace, setChangingPlace] = useState(false);

  const go = (next: { view?: View; day?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextView = next.view ?? view;
    const nextDay = next.day ?? selected;
    if (nextView === 'month') params.set('view', 'month');
    else params.delete('view');
    if (nextDay !== today) params.set('day', nextDay);
    else params.delete('day');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const { data: weather } = useWeatherDays(FORECAST_DAYS);
  const weatherByDay = useMemo(
    () => new Map((weather?.days ?? []).map((day) => [day.date, day])),
    [weather]
  );
  const { data: stays } = useStays();
  const canPlan = (day: string) => day >= today && day < addDays(today, FORECAST_DAYS);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <button
          type="button"
          onClick={() => go({ day: today })}
          className="h-9 rounded-full bg-muted px-4 text-sm font-semibold hover:bg-accent"
        >
          {t('today')}
        </button>
      </div>
      <div role="tablist" aria-label={t('title')} className="grid grid-cols-2 border-b text-center font-semibold">
        {(['day', 'month'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={view === value}
            onClick={() => go({ view: value })}
            className={`pb-2.5 transition-colors ${
              view === value ? 'text-foreground shadow-[inset_0_-2px_0_currentColor]' : 'text-muted-foreground'
            }`}
          >
            {t(value)}
          </button>
        ))}
      </div>

      {view === 'day' ? (
        <DayView
          today={today}
          selected={selected}
          onSelect={(day) => go({ day })}
          weatherByDay={weatherByDay}
          stays={stays}
          canPlan={canPlan}
          onOpenWeather={setSheetFor}
          onAdd={() => setAdding(true)}
          onChangePlace={() => setChangingPlace(true)}
        />
      ) : (
        <MonthView
          today={today}
          selected={selected}
          weatherByDay={weatherByDay}
          stays={stays}
          onPick={(day) => go({ view: 'day', day })}
          onMonth={(day) => go({ day })}
        />
      )}

      <WeatherSheet
        day={sheetFor ? weatherByDay.get(sheetFor) : undefined}
        isToday={sheetFor === today}
        canPlan={!!sheetFor && canPlan(sheetFor)}
        open={sheetFor !== null}
        onOpenChange={(open) => !open && setSheetFor(null)}
      />
      <AddOutfitSheet
        day={selected}
        dayLabel={selected === today ? t('today') : `${weekdayShort(selected, locale)} ${dayAndMonth(selected, locale)}`}
        canSuggest={canPlan(selected)}
        open={adding}
        onOpenChange={setAdding}
      />
      <AddStayDialog open={changingPlace} onOpenChange={setChangingPlace} startDate={selected} />
    </div>
  );
}

function DayView({
  today,
  selected,
  onSelect,
  weatherByDay,
  stays,
  canPlan,
  onOpenWeather,
  onAdd,
  onChangePlace,
}: {
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  weatherByDay: Map<string, WeatherDay>;
  stays: Stay[] | undefined;
  canPlan: (day: string) => boolean;
  onOpenWeather: (day: string) => void;
  onAdd: () => void;
  onChangePlace: () => void;
}) {
  const t = useTranslations('wardrobe.closet.planner');
  const locale = useLocale();
  const outfitTitle = useOutfitTitle();
  const conditionLabel = useWeatherConditionLabel();
  const { data: prefs } = usePreferences();
  const week = weekOf(selected);
  const { data: outfits } = useOutfits({ date_from: week[0], date_to: week[6] }, 1, 50);
  const look = lookFor(outfits?.outfits, selected);
  const day = weatherByDay.get(selected);
  const stay = stayOn(stays, selected);
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const deg = (value: number) => `${displayValue(value, unit)}°`;
  const touchX = useRef<number | null>(null);
  const place = stay?.city ?? day?.city;

  const heading =
    selected === today
      ? t('today')
      : selected === addDays(today, 1)
        ? t('tomorrow')
        : dayDate(selected).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <button type="button" aria-label={t('previousWeek')} onClick={() => onSelect(addDays(selected, -7))} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="grid flex-1 grid-cols-7 text-center">
          {week.map((date) => {
            const isSelected = date === selected;
            const has = !!lookFor(outfits?.outfits, date);
            return (
              <button key={date} type="button" onClick={() => onSelect(date)} aria-pressed={isSelected} className="space-y-0.5 py-1">
                <span className="block text-[11.5px] text-muted-foreground">{weekdayShort(date, locale)}</span>
                <span
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold ${
                    isSelected ? 'bg-foreground text-background' : date === today ? 'text-primary' : ''
                  }`}
                >
                  {dayDate(date).getDate()}
                </span>
                <TinyWeather day={weatherByDay.get(date)} />
                <span className={`mx-auto block h-1.5 w-1.5 rounded-full ${has ? 'bg-foreground' : 'bg-transparent'}`} />
                {stayOn(stays, date) && <span className="mx-1 block h-0.5 rounded-full bg-violet-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label={t('nextWeek')} onClick={() => onSelect(addDays(selected, 7))} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {day?.forecast && (
        <button
          type="button"
          onClick={() => onOpenWeather(selected)}
          className="mx-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          {(() => {
            const Icon = weatherIcon(day.forecast.condition);
            return <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />;
          })()}
          <b className="tabular-nums text-foreground">{deg(day.forecast.temp_max)}</b>
          <span>
            {conditionLabel(day.forecast.condition)} · {deg(day.forecast.temp_min)}–{deg(day.forecast.temp_max)} ·{' '}
            {t('rain', { percent: day.forecast.precipitation_chance })}
          </span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <h2 className="text-center font-bold">{heading}</h2>

      <div
        className="relative mx-auto flex min-h-[22rem] max-w-sm items-center justify-center rounded-3xl border bg-card p-4"
        onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) onSelect(addDays(selected, dx < 0 ? 1 : -1));
        }}
      >
        {look ? (
          <Link href={`/dashboard/outfits/${look.id}`} className="block w-48">
            <LookTile pieces={piecesOf(look)} />
            <p className="mt-2 truncate text-center font-semibold">{outfitTitle(look)}</p>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-base font-bold text-background hover:opacity-90"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('addOutfit')}
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <MapPin className={`h-4 w-4 ${stay ? 'text-violet-600 dark:text-violet-300' : ''}`} aria-hidden="true" />
        <span>{place ? t('beIn', { city: place }) : t('noPlace')}</span>
        <button type="button" onClick={onChangePlace} className="font-semibold text-primary hover:underline">
          {t('change')}
        </button>
      </div>
      {!canPlan(selected) && selected > today && (
        <p className="text-center text-xs text-muted-foreground">{t('forecastLater')}</p>
      )}
    </div>
  );
}

function MonthView({
  today,
  selected,
  weatherByDay,
  stays,
  onPick,
  onMonth,
}: {
  today: string;
  selected: string;
  weatherByDay: Map<string, WeatherDay>;
  stays: Stay[] | undefined;
  onPick: (day: string) => void;
  onMonth: (day: string) => void;
}) {
  const t = useTranslations('wardrobe.closet.planner');
  const locale = useLocale();
  const shown = dayDate(selected);
  const year = shown.getFullYear();
  const month = shown.getMonth() + 1;
  const { data } = useCalendarOutfits(year, month);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = first.getDay();
  const cells = Array.from({ length: daysInMonth }, (_, i) => formatDateKey(new Date(year, month - 1, i + 1)));
  const trail = (7 - ((lead + daysInMonth) % 7)) % 7;
  const weekdays = weekOf(formatDateKey(first)).map((day) => weekdayShort(day, locale));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label={t('previousMonth')}
          onClick={() => onMonth(formatDateKey(new Date(year, month - 2, 1)))}
          className="rounded-full p-1.5 hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="min-w-[10rem] text-center font-bold">
          {first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          aria-label={t('nextMonth')}
          onClick={() => onMonth(formatDateKey(new Date(year, month, 1)))}
          className="rounded-full p-1.5 hover:bg-accent"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weekdays.map((name) => (
          <span key={name} className="text-center text-[11px] text-muted-foreground">
            {name}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {cells.map((date) => {
          const look = lookFor(data?.outfits, date);
          const away = !!stayOn(stays, date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-label={dayDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              className="space-y-0.5 text-left"
            >
              <span className="flex items-center justify-between px-0.5">
                <span
                  className={`text-xs font-semibold ${
                    date === today ? 'rounded-full bg-foreground px-1.5 text-background' : date < today ? 'text-muted-foreground' : ''
                  }`}
                >
                  {dayDate(date).getDate()}
                </span>
                {weatherByDay.get(date)?.forecast && (() => {
                  const Icon = weatherIcon(weatherByDay.get(date)!.forecast!.condition);
                  return <Icon className="h-3 w-3 text-primary" aria-hidden="true" />;
                })()}
              </span>
              <span
                className={`relative flex aspect-[3/5] items-center justify-center overflow-hidden rounded-lg ${
                  look ? 'border bg-card p-0.5' : 'bg-muted/60 text-muted-foreground'
                } ${away ? 'shadow-[inset_0_-3px_0_theme(colors.violet.500)]' : ''}`}
              >
                {look ? <MiniLook outfit={look} /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
        {Array.from({ length: trail }, (_, i) => (
          <span key={`trail-${i}`} className="px-0.5 text-xs text-muted-foreground/50">
            {i + 1}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('monthLegend')}</p>
    </div>
  );
}

function MiniLook({ outfit }: { outfit: Outfit }) {
  // The small tile drops the border and padding of the full one; it is already framed.
  return (
    <span className="block w-full [&>div]:rounded-md [&>div]:border-0 [&>div]:p-0.5">
      <LookTile pieces={piecesOf(outfit)} />
    </span>
  );
}
