'use client';

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useWeather } from '@/lib/hooks/use-weather';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useWeatherConditionLabel } from '@/lib/hooks/use-translated-constants';
import { displayValue } from '@/lib/temperature';

export function weatherIcon(condition: string, isDay = true): LucideIcon {
  if (condition.includes('thunder')) return CloudLightning;
  if (condition.includes('snow') || condition.includes('freezing')) return CloudSnow;
  if (condition.includes('drizzle')) return CloudDrizzle;
  if (condition.includes('rain') || condition.includes('shower')) return CloudRain;
  if (condition === 'foggy') return CloudFog;
  if (condition === 'cloudy') return Cloud;
  if (condition === 'partly-cloudy' || condition === 'mostly-sunny') return CloudSun;
  return isDay ? Sun : Moon;
}

// The weather where you are, shown inside the home button: the weather follows the current
// home's city, so the two belong together. Shows nothing until a reading arrives.
export function HomeWeather() {
  const { data: weather } = useWeather();
  const { data: prefs } = usePreferences();
  const conditionLabel = useWeatherConditionLabel();
  if (!weather) return null;
  const unit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const Icon = weatherIcon(weather.condition, weather.is_day);
  // "31°": the C or F is left off to save room; the number follows the person's own setting.
  const temperature = `${displayValue(weather.temperature, unit)}°`;

  return (
    <span
      className="flex shrink-0 items-center gap-1 border-l pl-1.5 font-medium text-muted-foreground"
      title={conditionLabel(weather.condition)}
    >
      {/* On the narrowest phones the home's name gets the room instead. */}
      <Icon className="h-4 w-4 text-primary max-[374px]:hidden" aria-hidden="true" />
      <span>{temperature}</span>
      <span className="sr-only">{conditionLabel(weather.condition)}</span>
    </span>
  );
}
