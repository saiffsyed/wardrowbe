'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const OPTIONS = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const;

// Light, dark, or whatever the phone is set to. Lives in Settings rather than the top bar: it
// is chosen once, not every day.
export function DisplaySettings() {
  const t = useTranslations('wardrobe.closet.display');
  const { theme, setTheme } = useTheme();
  // The saved choice is only known in the browser; until then no option is shown as picked,
  // so the server's page and the browser's first paint agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? 'system') : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label={t('title')} className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ value, icon: Icon }) => {
            const selected = current === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {t(value)}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
