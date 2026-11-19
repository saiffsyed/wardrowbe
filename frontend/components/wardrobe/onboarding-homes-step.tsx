'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HomesSettings } from '@/components/wardrobe/homes-settings';
import { useHomes } from '@/lib/hooks/use-homes';

// The first-run step that asks where the person keeps clothes. It takes the place of the
// original single "location" step: each home carries its own city, and the first one added
// becomes the person's location for the weather.
export function OnboardingHomesStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const t = useTranslations('wardrobe.closet.onboarding');
  const { data: homes } = useHomes();
  const count = homes?.length ?? 0;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <HomesSettings bare />

      <div className="space-y-2">
        <Button className="h-11 w-full" onClick={onNext} disabled={count === 0}>
          {count === 0 ? t('addOneFirst') : t('continue', { count })}
        </Button>
        <div className="text-center">
          <Button variant="ghost" onClick={onSkip}>
            {t('skip')}
          </Button>
        </div>
      </div>
    </div>
  );
}
