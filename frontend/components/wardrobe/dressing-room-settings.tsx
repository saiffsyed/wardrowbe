'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api';
import { COLOUR_NAMES, FIGURE_COLOURS, resolveColours, ROOM_BACKGROUNDS } from '@/lib/dressing-room';
import {
  DEFAULT_ROOM,
  useDressingRoomSettings,
  useUpdateDressingRoomSettings,
  type DressingRoomSettings as Settings,
} from '@/lib/hooks/use-dressing-room';
import { DressingFigure } from './dressing-figure';

// More → Dressing room: each person's figure, its colour and the background behind it.
export function DressingRoomSettings() {
  const t = useTranslations('wardrobe.closet.dressing.settings');
  const { resolvedTheme } = useTheme();
  const { data } = useDressingRoomSettings();
  const update = useUpdateDressingRoomSettings();
  const room = data ?? DEFAULT_ROOM;
  const colours = resolveColours(room.background, room.figure_colour, resolvedTheme === 'dark');
  const change = (value: Partial<Settings>) =>
    update.mutate(value, { onError: (error) => toast.error(getErrorMessage(error, t('saveError'))) });

  const swatches = (label: string, options: readonly string[], current: string, key: 'background' | 'figure_colour') => (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            aria-label={t(`colours.${COLOUR_NAMES[value]}`)}
            disabled={!data}
            onClick={() => change({ [key]: value })}
            className={`h-10 w-10 rounded-full border ring-offset-2 ring-offset-background ${current === value ? 'ring-2 ring-primary' : ''}`}
            style={{ background: value === 'auto' ? 'linear-gradient(135deg,#ffffff 50%,#121417 50%)' : value }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t(`colours.${COLOUR_NAMES[current] ?? 'sameAsApp'}`)}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-4">
          <div className="flex h-40 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={{ background: colours.background }}>
            <DressingFigure shape={room.figure} colour={colours.figure} className="h-[88%] w-[88%]" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold">{t('figure')}</p>
            <div role="radiogroup" aria-label={t('figure')} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(['women', 'men'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={room.figure === value}
                  disabled={!data}
                  onClick={() => change({ figure: value })}
                  className={`h-10 rounded-lg text-sm font-bold ${room.figure === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  {t(value)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {swatches(t('background'), ROOM_BACKGROUNDS, room.background, 'background')}
        {swatches(t('figureColour'), FIGURE_COLOURS, room.figure_colour, 'figure_colour')}
      </CardContent>
    </Card>
  );
}
