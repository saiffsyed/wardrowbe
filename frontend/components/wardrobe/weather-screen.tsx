'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, MapPin, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/api';
import { dayAndMonth, weekdayShort } from '@/lib/day-format';
import { useOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { usePlanDayOutfit, useWeatherDays, type WeatherDay } from '@/lib/hooks/use-stays';
import { useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { useWeather } from '@/lib/hooks/use-weather';
import { displayValue } from '@/lib/temperature';
import { weatherHint, WET_HINTS } from '@/lib/weather-hints';
import { weatherIcon } from './home-weather';
import { LookTile } from './look-tile';
import { AddStayDialog } from './add-stay-dialog';

// Today plus the next seven days.
const DAY_COUNT = 8;

function piecesOf(outfit: Outfit) {
  return [...outfit.items]
    .sort((a, b) => a.position - b.position)
    .flatMap((item) => {
      const url = item.thumbnail_url ?? item.image_url;
      return url ? [{ type: item.type, url }] : [];
    });
}

function Hint({ day }: { day: WeatherDay }) {
  const t = useTranslations('wardrobe.closet.weatherScreen.hints');
  if (!day.forecast) return null;
  const hint = weatherHint(day.forecast);
  const wet = WET_HINTS.includes(hint);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        wet ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200' : 'bg-accent text-accent-foreground'
      }`}
    >
      {t(hint)}
    </span>
  );
}

function AwayPin({ city }: { city: string | null }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
      <MapPin className="h-3 w-3" aria-hidden="true" />
      {city}
    </span>
  );
}

function PlannedLook({ outfit, label }: { outfit: Outfit; label: string }) {
  return (
    <Link href={`/dashboard/outfits/${outfit.id}`} className="flex items-center gap-2.5">
      <div className="w-12 shrink-0">
        <LookTile pieces={piecesOf(outfit)} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{outfit.name || label}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

export function WeatherScreen() {
  const t = useTranslations('wardrobe.closet.weatherScreen');
  const tw = useTranslations('wardrobe.closet.weather');
  const locale = useLocale();
  const conditionLabel = useWeatherConditionLabel();
  const { data, isLoading, isError } = useWeatherDays(DAY_COUNT);
  const { data: current } = useWeather();
  const { data: prefs } = usePreferences();
  const plan = usePlanDayOutfit();
  const [planning, setPlanning] = useState<string | null>(null);
  const [addingStay, setAddingStay] = useState(false);
  const days = data?.days ?? [];
  const { data: planned } = useOutfits(
    days.length ? { date_from: days[0].date, date_to: days[days.length - 1].date } : {},
    1,
    50
  );
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const deg = (value: number) => `${displayValue(value, unit)}°`;
  const plannedOn = (day: string) => planned?.outfits.find((outfit) => outfit.scheduled_for === day);

  const back = (
    <Link href="/dashboard/wardrobe" className="-ml-2 inline-flex h-10 items-center pr-3 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      {t('back')}
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (isError || days.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <p className="py-10 text-center text-muted-foreground">{t('unavailable')}</p>
      </div>
    );
  }

  const today = days[0];
  // Away today, the forecast for the stay's city stands in for the current reading at home.
  const now = !today.away && current ? current : null;
  const TodayIcon = weatherIcon(now?.condition ?? today.forecast?.condition ?? 'unknown', now?.is_day ?? true);
  const planDay = (day: string) => {
    setPlanning(day);
    plan.mutate(day, {
      onSuccess: () => toast.success(t('planned', { day: weekdayShort(day, locale) })),
      onError: (error) => toast.error(getErrorMessage(error, t('planError'))),
      onSettled: () => setPlanning(null),
    });
  };
  const todayLook = plannedOn(today.date);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {back}
      <h1 className="text-2xl font-extrabold tracking-tight">
        {t('title')} <span className="font-semibold text-muted-foreground">· {today.city}</span>
      </h1>

      <section aria-label={t('today')} className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <TodayIcon className="h-11 w-11 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-[42px] font-extrabold leading-none tabular-nums">
            {deg(now?.temperature ?? today.forecast?.temp_max ?? 0)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{conditionLabel(now?.condition ?? today.forecast?.condition ?? 'unknown')}</p>
            <p className="text-sm text-muted-foreground">
              {now ? tw('feelsLike', { temp: deg(now.feels_like) }) : today.away && <AwayPin city={today.city} />}
            </p>
          </div>
        </div>
        {today.forecast && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>{t('range')}</span>
              <b className="tabular-nums">
                {deg(today.forecast.temp_min)} → {deg(today.forecast.temp_max)}
              </b>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [`${today.forecast.precipitation_chance}%`, t('rain')],
                [today.forecast.humidity != null ? `${Math.round(today.forecast.humidity)}%` : '–', t('humidity')],
                [today.forecast.uv_index != null ? String(Math.round(today.forecast.uv_index)) : '–', t('uv')],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl bg-muted/60 p-2">
                  <b className="block tabular-nums">{value}</b>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <Hint day={today} />
          </>
        )}
        {todayLook ? (
          <PlannedLook outfit={todayLook} label={t('plannedToday')} />
        ) : (
          <Button variant="outline" className="rounded-full" disabled={planning !== null} onClick={() => planDay(today.date)}>
            {planning === today.date && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('planToday')}
          </Button>
        )}
      </section>

      <h2 className="pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('nextDays')}</h2>
      <ul className="divide-y rounded-2xl border bg-card">
        {days.slice(1).map((day) => {
          const Icon = weatherIcon(day.forecast?.condition ?? 'unknown');
          const look = plannedOn(day.date);
          return (
            <li
              key={day.date}
              className={`space-y-2 px-4 py-3 ${day.away ? 'bg-gradient-to-r from-violet-50 to-transparent dark:from-violet-500/10' : ''}`}
            >
              <div className="grid grid-cols-[3rem_1.75rem_1fr_auto] items-center gap-2">
                <div>
                  <b className="block">{weekdayShort(day.date, locale)}</b>
                  <span className="text-xs text-muted-foreground">{dayAndMonth(day.date, locale)}</span>
                </div>
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
                  {day.away && <AwayPin city={day.city} />}
                  {day.forecast ? (
                    <p>
                      <span className="font-semibold text-sky-700 dark:text-sky-300">
                        {tw('rain', { percent: day.forecast.precipitation_chance })}
                      </span>
                      {day.forecast.humidity != null && ` · ${tw('humidity', { percent: Math.round(day.forecast.humidity) })}`}
                    </p>
                  ) : (
                    <p>{t('noForecast')}</p>
                  )}
                </div>
                {day.forecast && (
                  <p className="text-right font-bold tabular-nums">
                    {deg(day.forecast.temp_max)} <span className="font-medium text-muted-foreground">/ {deg(day.forecast.temp_min)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Hint day={day} />
                {look ? (
                  <PlannedLook outfit={look} label={t('plannedFor', { day: weekdayShort(day.date, locale) })} />
                ) : (
                  <Button size="sm" className="rounded-full" disabled={planning !== null} onClick={() => planDay(day.date)}>
                    {planning === day.date && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {t('planOutfit')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" className="w-full rounded-full" onClick={() => setAddingStay(true)}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {t('addStay')}
      </Button>
      <AddStayDialog open={addingStay} onOpenChange={setAddingStay} startDate={days[1]?.date ?? today.date} />
    </div>
  );
}
