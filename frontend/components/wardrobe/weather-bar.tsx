'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWeather } from '@/lib/hooks/use-weather';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { displayValue } from '@/lib/temperature';
import { weatherIcon } from './home-weather';

// Today's weather where you are, as a bar under the top row of the wardrobe. Opens Plan, which
// has the full weather card (later the "Today" card). Shows nothing until a reading arrives.
export function WeatherBar() {
  const t = useTranslations('wardrobe.closet.weather');
  const { data: weather } = useWeather();
  const { data: prefs } = usePreferences();
  const conditionLabel = useWeatherConditionLabel();
  if (!weather) return null;
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const degrees = (value: number) => `${displayValue(value, unit)}°`;
  const Icon = weatherIcon(weather.condition, weather.is_day);

  return (
    <Link
      href="/dashboard"
      aria-label={t('open')}
      className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-2xl font-bold tabular-nums">{degrees(weather.temperature)}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">
          {conditionLabel(weather.condition)}
          <span className="font-normal text-muted-foreground">
            {' · '}
            {t('feelsLike', { temp: degrees(weather.feels_like) })}
          </span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {t('rain', { percent: Math.round(weather.precipitation_chance) })}
          {' · '}
          {t('humidity', { percent: Math.round(weather.humidity) })}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
