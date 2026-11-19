'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api';
import { useDeleteStay, useWeatherDays, type WeatherDay } from '@/lib/hooks/use-stays';
import { dayDate, weekdayShort } from '@/lib/day-format';
import { AddStayDialog } from './add-stay-dialog';

interface Run {
  start: number;
  length: number;
  day: WeatherDay;
}

// Neighbouring days in the same place, so a two-day stay shows as one bar.
function runsOf(days: WeatherDay[]): Run[] {
  const runs: Run[] = [];
  days.forEach((day, index) => {
    const last = runs[runs.length - 1];
    const same = last && last.day.away === day.away && last.day.stay_id === day.stay_id && last.day.city === day.city;
    if (same) last.length += 1;
    else runs.push({ start: index, length: 1, day });
  });
  return runs;
}

// "Where I'll be" on Plan: the coming week with the city for each day. Grey is the current
// home; a coloured bar is a stay. Tap a day to add a stay starting then.
export function StaysRow() {
  const t = useTranslations('wardrobe.closet.stays');
  const locale = useLocale();
  const { data } = useWeatherDays(7);
  const remove = useDeleteStay();
  const [adding, setAdding] = useState<string | null>(null);
  const days = data?.days ?? [];
  if (days.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t('rowTitle')}</h2>
          <button
            type="button"
            onClick={() => setAdding(days[0].date)}
            className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium text-primary hover:bg-accent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('add')}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day, index) => (
            <button
              key={day.date}
              type="button"
              onClick={() => setAdding(day.date)}
              aria-label={t('addFrom', { day: dayDate(day.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) })}
              className={`rounded-lg py-1.5 transition-colors hover:bg-accent ${index === 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            >
              <span className="block text-[11px] font-medium opacity-80">{weekdayShort(day.date, locale)}</span>
              <span className="block text-[15px] font-bold">{dayDate(day.date).getDate()}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {runsOf(days).map((run) => (
            <div
              key={run.start}
              style={{ gridColumn: `${run.start + 1} / span ${run.length}` }}
              className={`flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-1 text-[11px] font-semibold ${
                run.day.away ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="truncate">{run.day.city ?? t('noCity')}</span>
              {run.day.away && run.day.stay_id && (
                <button
                  type="button"
                  aria-label={t('remove', { city: run.day.city ?? '' })}
                  onClick={() =>
                    remove.mutate(run.day.stay_id!, {
                      onSuccess: () => toast.success(t('removed', { city: run.day.city ?? '' })),
                      onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
                    })
                  }
                  className="-mr-0.5 shrink-0 rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-500/30"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('legend')}</p>
      </CardContent>
      <AddStayDialog open={adding !== null} onOpenChange={(open) => !open && setAdding(null)} startDate={adding ?? days[0].date} />
    </Card>
  );
}
