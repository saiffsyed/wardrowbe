'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api';
import { useHomes, useSetCurrentHome } from '@/lib/hooks/use-homes';
import { useWeatherDays } from '@/lib/hooks/use-stays';
import { rememberTrip } from '@/lib/trip-return';

const DISMISSED_KEY = 'stay-home-prompt-dismissed';

function dismissedFor(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

// On a day of a stay at one of your other homes, one tap shows the clothes kept there. The
// wardrobe never switches home by itself.
export function StayHomePrompt() {
  const t = useTranslations('wardrobe.closet.stays');
  const { data: days } = useWeatherDays(7);
  const { data: homes } = useHomes();
  const setCurrent = useSetCurrentHome();
  const today = days?.days[0];
  const [dismissed, setDismissed] = useState(() => dismissedFor());
  const home = today?.away && today.home_id ? homes?.find((h) => h.id === today.home_id) : undefined;
  if (!today || !home || home.is_current || dismissed === `${today.date}:${home.id}`) return null;

  const dismiss = () => {
    const value = `${today.date}:${home.id}`;
    try {
      localStorage.setItem(DISMISSED_KEY, value);
    } catch {
      // Without storage it simply asks again next time.
    }
    setDismissed(value);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-violet-400 bg-card p-3 text-sm">
      <p>{t('prompt', { home: home.name })}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="rounded-full"
          disabled={setCurrent.isPending}
          onClick={() =>
            setCurrent.mutate(home.id, {
              // Remembered, so the morning after the stay the app offers the way back.
              onSuccess: () => {
                const before = homes?.find((h) => h.is_current);
                if (before && today.stay_id) rememberTrip({ from: before.id, to: home.id, stayId: today.stay_id });
              },
              onError: (error) => toast.error(getErrorMessage(error, t('saveError'))),
            })
          }
        >
          {t('promptYes')}
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={dismiss}>
          {t('promptNo')}
        </Button>
      </div>
    </div>
  );
}
