import type { DayForecast } from '@/lib/hooks/use-stays';

// What a day's weather means for clothes, by fixed rules (no AI, so free and instant).
// The first rule that fits wins: wet weather matters more than warmth.
export type WeatherHint =
  | 'storm'
  | 'rain'
  | 'hotHumid'
  | 'hot'
  | 'coolEvening'
  | 'cold'
  | 'cool'
  | 'mild';

export function weatherHint(day: DayForecast): WeatherHint {
  const condition = day.condition.toLowerCase();
  if (condition.includes('thunder')) return 'storm';
  if (
    day.precipitation_chance >= 60 ||
    ['rain', 'shower', 'drizzle'].some((word) => condition.includes(word))
  ) {
    return 'rain';
  }
  if (day.temp_max >= 30) return (day.humidity ?? 0) >= 60 ? 'hotHumid' : 'hot';
  if (day.temp_max <= 10) return 'cold';
  if (day.temp_min <= 18 && day.temp_max >= 22) return 'coolEvening';
  if (day.temp_max <= 18) return 'cool';
  return 'mild';
}

export const WET_HINTS: readonly WeatherHint[] = ['storm', 'rain'];
