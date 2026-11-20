'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, dayAndMonth, dayDate, weekdayShort } from '@/lib/day-format';
import { useCalendarOutfits, useOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useStays, useWeatherDays, type Stay, type WeatherDay } from '@/lib/hooks/use-stays';
import { useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import { useUserToday } from '@/lib/hooks/use-user';
import { useWeather } from '@/lib/hooks/use-weather';
import { displayValue } from '@/lib/temperature';
import { formatDateKey } from '@/lib/utils';
import { lookForDay } from '@/lib/look-phase';
import { piecesOf } from './add-outfit-sheet';
import { DayEmpty, LookName, TodayActions } from './today-card';
import { weatherIcon } from './home-weather';
import { LookTile, type Arranged } from './look-tile';
import { useOutfitLayouts } from '@/lib/hooks/use-outfit-layouts';
import { WeatherSheet } from './weather-sheet';

// The forecast reaches 16 days ahead, today included.
const FORECAST_DAYS = 16;

type View = 'day' | 'month';

function weekOf(day: string): string[] {
  const start = addDays(day, -dayDate(day).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
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
  const { data: prefs } = usePreferences();
  const canPlan = (day: string) => day >= today && day < addDays(today, FORECAST_DAYS);

  const heading = (day: string) =>
    day === today
      ? t('today')
      : day === addDays(today, 1)
        ? t('tomorrow')
        : dayDate(day).toLocaleDateString(locale, { weekday: 'long' });
  const selectedWeather = weatherByDay.get(selected)?.forecast;
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const SkyIcon = selectedWeather ? weatherIcon(selectedWeather.condition) : null;
  // Today shows the temperature now, as the weather sheet and the wardrobe's weather bar do;
  // other days their high.
  const { data: current } = useWeather();
  const shownTemp =
    selected === today && current && !weatherByDay.get(today)?.away ? current.temperature : selectedWeather?.temp_max;

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {/* One header line: the day, its weather (tap for details) and the month. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight">
            {view === 'month' ? t('title') : heading(selected)}
          </h1>
          {view === 'day' && (
            <p className="text-sm text-muted-foreground">
              {`${weekdayShort(selected, locale)} ${dayAndMonth(selected, locale)}`}
              {selected !== today && (
                <>
                  {' · '}
                  <button type="button" onClick={() => go({ day: today })} className="font-semibold text-primary hover:underline">
                    {t('backToToday')}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        {view === 'day' && selectedWeather && SkyIcon && (
          <button
            type="button"
            onClick={() => setSheetFor(selected)}
            aria-label={t('weatherFor', { day: heading(selected) })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-bold hover:bg-accent"
          >
            <SkyIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="tabular-nums">{displayValue(shownTemp ?? selectedWeather.temp_max, unit)}°</span>
          </button>
        )}
        {view === 'month' && (
          <button type="button" onClick={() => go({ day: today })} className="h-9 rounded-full bg-muted px-4 text-sm font-semibold hover:bg-accent">
            {t('today')}
          </button>
        )}
        <button
          type="button"
          onClick={() => go({ view: view === 'day' ? 'month' : 'day' })}
          aria-label={view === 'day' ? t('month') : t('day')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-accent"
        >
          {view === 'day' ? <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" /> : <CalendarRange className="h-[18px] w-[18px]" aria-hidden="true" />}
        </button>
      </div>

      {view === 'day' ? (
        <DayView
          today={today}
          selected={selected}
          onSelect={(day) => go({ day })}
          weatherByDay={weatherByDay}
          stays={stays}
          canPlan={canPlan}
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
}: {
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  weatherByDay: Map<string, WeatherDay>;
  stays: Stay[] | undefined;
  canPlan: (day: string) => boolean;
}) {
  const t = useTranslations('wardrobe.closet.planner');
  const locale = useLocale();
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const { data: prefs } = usePreferences();
  const week = weekOf(selected);
  const { data: outfits } = useOutfits({ date_from: week[0], date_to: week[6] }, 1, 50);
  const look = lookForDay(outfits?.outfits, selected);
  const { data: layouts } = useOutfitLayouts((outfits?.outfits ?? []).map((outfit) => outfit.id));
  const forecast = weatherByDay.get(selected)?.forecast ?? null;
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const deg = (value: number) => `${displayValue(value, unit)}°`;
  const touchX = useRef<number | null>(null);
  const isToday = selected === today;

  return (
    <div className="flex flex-col gap-2">
      {/* The week in one slim row: a dot on planned days, a violet line on days away. */}
      <div className="flex items-center">
        <button type="button" aria-label={t('previousWeek')} onClick={() => onSelect(addDays(selected, -7))} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="grid flex-1 grid-cols-7 text-center">
          {week.map((date) => {
            const isSelected = date === selected;
            const has = !!lookForDay(outfits?.outfits, date);
            return (
              <button key={date} type="button" onClick={() => onSelect(date)} aria-pressed={isSelected} aria-label={dayDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} className="py-0.5">
                <span className="block text-[10.5px] text-muted-foreground" aria-hidden="true">
                  {dayDate(date).toLocaleDateString(locale, { weekday: 'narrow' })}
                </span>
                <span
                  aria-hidden="true"
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    isSelected ? 'bg-foreground text-background' : date === today ? 'text-primary' : ''
                  }`}
                >
                  {dayDate(date).getDate()}
                </span>
                <span className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${has ? 'bg-foreground/60' : 'bg-transparent'}`} />
                {stayOn(stays, date) && <span className="mx-1.5 mt-0.5 block h-0.5 rounded-full bg-violet-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label={t('nextWeek')} onClick={() => onSelect(addDays(selected, 7))} className="rounded-full p-1 text-muted-foreground hover:bg-accent">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* The look itself gets the rest of the screen; swipe it for the next or previous day. */}
      <div
        className={`flex items-center justify-center py-1 ${look ? '' : 'min-h-[max(18rem,calc(100dvh-19rem))]'}`}
        onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) onSelect(addDays(selected, dx < 0 ? 1 : -1));
        }}
      >
        {look ? (
          <Link
            href={`/dashboard/outfits/${look.id}`}
            aria-label={outfitTitle(look)}
            className="block"
            style={{ width: `min(80vw, 22rem, calc((100dvh - ${isToday ? '21rem' : '17rem'}) * 0.6))` }}
          >
            <LookTile pieces={piecesOf(look)} arranged={layouts?.get(look.id)} bare />
          </Link>
        ) : (
          <DayEmpty
            day={selected}
            isToday={isToday}
            canSuggest={canPlan(selected)}
            forecast={forecast}
            deg={deg}
          />
        )}
      </div>

      {look &&
        (isToday ? (
          <TodayActions today={today} look={look} forecast={forecast} deg={deg} />
        ) : (
          <LookName title={outfitTitle(look)} occasion={occasionLabel(look.occasion)} />
        ))}
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
  const { data: layouts } = useOutfitLayouts((data?.outfits ?? []).map((outfit) => outfit.id));
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
          const look = lookForDay(data?.outfits, date);
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
                {look ? <MiniLook outfit={look} arranged={layouts?.get(look.id)} /> : <Plus className="h-4 w-4" aria-hidden="true" />}
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

function MiniLook({ outfit, arranged }: { outfit: Outfit; arranged?: Arranged }) {
  // The small tile drops the border and padding of the full one; it is already framed.
  return (
    <span className="block w-full [&>div]:rounded-md [&>div]:border-0 [&>div]:p-0.5">
      <LookTile pieces={piecesOf(outfit)} arranged={arranged} />
    </span>
  );
}
