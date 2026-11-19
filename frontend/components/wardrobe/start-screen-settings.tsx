'use client';

import { BookOpen, CalendarDays, Layers, Shirt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api';
import { usePreferences, useUpdatePreferences } from '@/lib/hooks/use-preferences';
import type { StartScreen } from '@/lib/start-screen';

const OPTIONS: { value: StartScreen; icon: typeof Shirt }[] = [
  { value: 'wardrobe', icon: Shirt },
  { value: 'lookbook', icon: BookOpen },
  { value: 'outfits', icon: Layers },
  { value: 'plan', icon: CalendarDays },
];

// Which screen the app opens on. Kept with the account, so it follows the person to a new phone.
export function StartScreenSettings() {
  const t = useTranslations('wardrobe.closet.startScreen');
  const { data: prefs } = usePreferences();
  const update = useUpdatePreferences();
  const current = update.isPending
    ? update.variables?.start_screen
    : (prefs?.start_screen ?? (prefs ? 'wardrobe' : undefined));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label={t('title')} className="grid grid-cols-2 gap-2">
          {OPTIONS.map(({ value, icon: Icon }) => {
            const selected = current === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!prefs}
                onClick={() =>
                  update.mutate(
                    { start_screen: value },
                    { onError: (error) => toast.error(getErrorMessage(error, t('saveError'))) }
                  )
                }
                className={`flex min-h-[3.25rem] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {t(value)}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
