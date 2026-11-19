'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/api';
import { dayDate } from '@/lib/day-format';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useDeleteStay, usePlanDayOutfit, type WeatherDay } from '@/lib/hooks/use-stays';
import { useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { useWeather } from '@/lib/hooks/use-weather';
import { displayValue } from '@/lib/temperature';
import { weatherHint, WET_HINTS } from '@/lib/weather-hints';
import { AddStayDialog } from './add-stay-dialog';
import { weatherIcon } from './home-weather';

// On a phone it comes up from the bottom like a sheet; on a wider screen it sits centred.
export const SHEET_CLASS =
  'bottom-0 top-auto max-h-[88dvh] translate-y-0 gap-3 overflow-y-auto rounded-t-3xl p-5 data-[state=closed]:slide-out-to-top-[100%] data-[state=open]:slide-in-from-top-[100%] sm:bottom-auto sm:top-[50%] sm:max-w-md sm:translate-y-[-50%] sm:rounded-3xl';

// The full weather for one day, from the weather bar or a day in the planner.
export function WeatherSheet({
  day,
  isToday,
  canPlan,
  open,
  onOpenChange,
}: {
  day: WeatherDay | undefined;
  isToday: boolean;
  // Only today and the next 15 days can have an outfit suggested for their weather.
  canPlan: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('wardrobe.closet.weatherScreen');
  const ts = useTranslations('wardrobe.closet.stays');
  const tw = useTranslations('wardrobe.closet.weather');
  const tp = useTranslations('wardrobe.closet.planner');
  const tHints = useTranslations('wardrobe.closet.weatherScreen.hints');
  const locale = useLocale();
  const conditionLabel = useWeatherConditionLabel();
  const { data: current } = useWeather();
  const { data: prefs } = usePreferences();
  const plan = usePlanDayOutfit();
  const removeStay = useDeleteStay();
  const [changingStay, setChangingStay] = useState(false);
  if (!day) return null;

  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const deg = (value: number) => `${displayValue(value, unit)}°`;
  const forecast = day.forecast;
  // At home today the live reading leads; otherwise the day's forecast high.
  const now = isToday && !day.away && current ? current : null;
  const condition = now?.condition ?? forecast?.condition ?? 'unknown';
  const Icon = weatherIcon(condition, now?.is_day ?? true);
  const hint = forecast ? weatherHint(forecast) : null;
  const title = dayDate(day.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const facts: [string, string][] = forecast
    ? [
        [`${forecast.precipitation_chance}%`, t('rain')],
        [forecast.humidity != null ? `${Math.round(forecast.humidity)}%` : '–', t('humidity')],
        [forecast.uv_index != null ? String(Math.round(forecast.uv_index)) : '–', t('uv')],
        [forecast.wind_speed != null ? String(Math.round(forecast.wind_speed)) : '–', tp('wind')],
      ]
    : [];

  return (
    <>
      <Dialog open={open && !changingStay} onOpenChange={onOpenChange}>
        <DialogContent className={SHEET_CLASS}>
          <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {isToday ? t('today') : title}
            {day.city && (
              <span
                className={`inline-flex items-center gap-1 text-sm font-semibold ${
                  day.away ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {day.city}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">{tp('sheetHint')}</DialogDescription>

          {forecast || now ? (
            <>
              <div className="flex items-center gap-3">
                <Icon className="h-11 w-11 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-[40px] font-extrabold leading-none tabular-nums">
                  {deg(now?.temperature ?? forecast!.temp_max)}
                </span>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{conditionLabel(condition)}</p>
                  {now
                    ? tw('feelsLike', { temp: deg(now.feels_like) })
                    : forecast && tp('low', { temp: deg(forecast.temp_min) })}
                </div>
              </div>
              {forecast && (
                <p className="text-sm">
                  {t('range')}:{' '}
                  <b className="tabular-nums">
                    {deg(forecast.temp_min)} → {deg(forecast.temp_max)}
                  </b>
                </p>
              )}
              {facts.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {facts.map(([value, label]) => (
                    <div key={label} className="rounded-xl bg-muted/60 px-1 py-2">
                      <b className="block tabular-nums">{value}</b>
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {hint && (
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                    WET_HINTS.includes(hint)
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200'
                      : 'bg-accent text-accent-foreground'
                  }`}
                >
                  {tHints(hint)}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noForecast')}</p>
          )}

          <div className="grid gap-2 pt-1">
            {canPlan && (
              <Button
                className="rounded-full"
                disabled={plan.isPending}
                onClick={() =>
                  plan.mutate(day.date, {
                    onSuccess: () => {
                      toast.success(t('planned', { day: title }));
                      onOpenChange(false);
                    },
                    onError: (error) => toast.error(getErrorMessage(error, t('planError'))),
                  })
                }
              >
                {plan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {tp('suggestForWeather')}
              </Button>
            )}
            {day.away && day.stay_id ? (
              <Button
                variant="outline"
                className="rounded-full"
                disabled={removeStay.isPending}
                onClick={() =>
                  removeStay.mutate(day.stay_id!, {
                    onSuccess: () => toast.success(ts('removed', { city: day.city ?? '' })),
                    onError: (error) => toast.error(getErrorMessage(error, ts('saveError'))),
                  })
                }
              >
                {tp('removeStay', { city: day.city ?? '' })}
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={() => setChangingStay(true)}>
                {tp('changePlace')}
              </Button>
            )}
            <Button variant="ghost" className="rounded-full" asChild>
              <Link href="/dashboard/weather">{tp('nextDays')}</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AddStayDialog
        open={changingStay}
        onOpenChange={(value) => {
          setChangingStay(value);
          if (!value) onOpenChange(false);
        }}
        startDate={day.date}
      />
    </>
  );
}
