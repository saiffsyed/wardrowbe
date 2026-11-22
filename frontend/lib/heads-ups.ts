import { addDays } from '@/lib/day-format';
import { isWarm, warmthOf } from '@/lib/dressing-room';
import type { DayForecast, Stay } from '@/lib/hooks/use-stays';
import type { LaundryState } from '@/lib/hooks/use-laundry';
import type { Item } from '@/lib/types';
import { WET_HINTS, weatherHint } from '@/lib/weather-hints';

// Heads-ups: one short line on the Plan screen when something needs you. Fixed rules, no AI.
// The order below is their importance; the screen shows the first and "+N more".
export type HeadsUpKind =
  | 'away' // a piece of the day's look is in the wash, at the dry cleaner or needs washing
  | 'rain' // rain likely and the look has suede, silk, velvet or leather
  | 'hot' // a coat or wool on a hot day
  | 'cold' // no warm layer on a cold day
  | 'trip' // a stay soon somewhere much colder or warmer
  | 'home' // the morning after a trip: back to the clothes of the home before it
  | 'washBeforeRain'; // several rainy days ahead and clothes waiting to be washed

export type HeadsUpAction = 'swap' | 'weather' | 'home' | 'laundry';

export interface HeadsUp {
  id: string;
  kind: HeadsUpKind;
  tone: 'warn' | 'info';
  action: HeadsUpAction;
  // Values for the sentence, which the screen translates.
  values: Record<string, string | number>;
}

export interface LookPiece {
  id: string;
  name: string | null;
  type: string;
}

export interface HeadsUpInput {
  day: string;
  today: string;
  look: { items: LookPiece[] } | undefined;
  // The clothes of the current home, for material, needs_wash and so on.
  items: Map<string, Item>;
  laundry: Map<string, LaundryState>;
  // Each day's forecast and city, as far as it reaches.
  forecast: Map<string, { forecast: DayForecast | null; city: string | null }>;
  stays: Stay[];
  toWash: number;
  // The trip just ended, if the wardrobe was switched for it.
  returned?: { homeName: string };
  name: (piece: LookPiece) => string;
}

const WET_MATERIALS = ['suede', 'silk', 'velvet', 'leather'];
const TRIP_DAYS = 3;
const TRIP_DIFFERENCE = 8;
const RAIN_CHANCE = 60;
const RAINY_RUN = 3;
const WASH_PILE = 5;

const rainy = (forecast: DayForecast | null | undefined) =>
  !!forecast && (forecast.precipitation_chance >= RAIN_CHANCE || WET_HINTS.includes(weatherHint(forecast)));

export function headsUps(input: HeadsUpInput): HeadsUp[] {
  const { day, today, look, items, laundry, forecast } = input;
  const found: HeadsUp[] = [];
  const dayForecast = forecast.get(day)?.forecast ?? null;
  const pieces = look?.items ?? [];
  const detail = (piece: LookPiece) => items.get(piece.id);

  // 1. A piece of the look is not ready to wear.
  const notReady = pieces
    .map((piece) => {
      const away = laundry.get(piece.id);
      const state = away === 'wash' ? 'washing' : away === 'dry' ? 'dryCleaning' : detail(piece)?.needs_wash ? 'dirty' : null;
      return state ? { piece, state } : null;
    })
    .filter((entry): entry is { piece: LookPiece; state: string } => !!entry);
  if (notReady.length) {
    found.push({
      id: `away:${notReady[0].piece.id}`,
      kind: 'away',
      tone: 'warn',
      action: 'swap',
      values: { name: input.name(notReady[0].piece), state: notReady[0].state, count: notReady.length },
    });
  }

  if (dayForecast) {
    // 2. Rain against fabrics that do not like it.
    if (rainy(dayForecast)) {
      const fragile = pieces.find((piece) => {
        const material = (detail(piece)?.tags?.material ?? '').toLowerCase();
        return WET_MATERIALS.some((word) => material.includes(word));
      });
      if (fragile) {
        found.push({
          id: `rain:${fragile.id}`,
          kind: 'rain',
          tone: 'warn',
          action: 'swap',
          values: { chance: dayForecast.precipitation_chance, name: input.name(fragile) },
        });
      }
    }
    // 3. Too warm or too cold for the day.
    const warmth = warmthOf(dayForecast);
    const warmPiece = pieces.find((piece) => {
      const item = detail(piece);
      return isWarm({ type: piece.type, material: item?.tags?.material, season: item?.tags?.season ?? [] });
    });
    if (warmth === 'hot' && warmPiece) {
      found.push({
        id: `hot:${warmPiece.id}`,
        kind: 'hot',
        tone: 'warn',
        action: 'swap',
        values: { temp: Math.round(dayForecast.temp_max), name: input.name(warmPiece) },
      });
    }
    if (warmth === 'cold' && pieces.length && !warmPiece) {
      found.push({ id: 'cold', kind: 'cold', tone: 'warn', action: 'swap', values: { temp: Math.round(dayForecast.temp_max) } });
    }
  }

  // The rest are about the days ahead, so they show on today only.
  if (day === today) {
    // 4. A stay soon somewhere much colder or warmer than today.
    const todayHigh = forecast.get(today)?.forecast?.temp_max;
    const trip = input.stays
      .filter((stay) => stay.start_date > today && stay.start_date <= addDays(today, TRIP_DAYS))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const there = trip ? forecast.get(trip.start_date)?.forecast : undefined;
    if (trip && there && todayHigh !== undefined && Math.abs(there.temp_max - todayHigh) >= TRIP_DIFFERENCE) {
      const difference = Math.round(there.temp_max - todayHigh);
      found.push({
        id: `trip:${trip.id}`,
        kind: 'trip',
        tone: 'info',
        action: 'weather',
        values: {
          day: trip.start_date,
          city: trip.city,
          temp: Math.round(there.temp_max),
          difference: Math.abs(difference),
          colder: difference < 0 ? 'colder' : 'warmer',
        },
      });
    }
    // 5. Back from a trip the wardrobe was switched for.
    if (input.returned) {
      found.push({ id: 'home', kind: 'home', tone: 'info', action: 'home', values: { home: input.returned.homeName } });
    }
    // 6. Rain several days running ahead, with a pile to wash.
    if (input.toWash >= WASH_PILE) {
      const ahead = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
      let run: string[] = [];
      let best: string[] = [];
      for (const date of ahead) {
        run = rainy(forecast.get(date)?.forecast) ? [...run, date] : [];
        if (run.length > best.length) best = run;
      }
      if (best.length >= RAINY_RUN) {
        found.push({
          id: `washBeforeRain:${best[0]}`,
          kind: 'washBeforeRain',
          tone: 'info',
          action: 'laundry',
          values: { from: best[0], to: best[best.length - 1], count: input.toWash },
        });
      }
    }
  }
  return found;
}
