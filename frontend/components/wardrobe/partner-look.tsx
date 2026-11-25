'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/api';
import { dayAndMonth, weekdayShort } from '@/lib/day-format';
import { useCouple, useUpdateCouple, type PartnerInfo } from '@/lib/hooks/use-couple';
import type { Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import { piecesOf } from './add-outfit-sheet';
import { LookTile } from './look-tile';

const HIDDEN_KEY = 'partner-tile-hidden';

function savedHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

const firstName = (partner: PartnerInfo) => partner.display_name.split(' ')[0];

// Your partner's look for the day, small in the top corner of the Plan screen. The eye hides
// or shows it (remembered on this phone); tapping it opens the look large.
export function PartnerCorner({ day, look }: { day: string; look: Outfit | undefined }) {
  const t = useTranslations('wardrobe.closet.partner');
  const locale = useLocale();
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const { data: couple } = useCouple();
  const [hidden, setHidden] = useState(savedHidden);
  const [open, setOpen] = useState(false);
  const partner = couple?.partner;
  if (!partner || !couple.partner_shares) return null;
  const name = firstName(partner);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, next ? '1' : '0');
    } catch {
      // Without storage it shows again next time.
    }
  };
  const eye = (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!hidden}
      aria-label={hidden ? t('show', { name }) : t('hide', { name })}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm hover:text-foreground"
    >
      {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  return (
    <div className="absolute right-0 top-0 z-10 flex flex-col items-end gap-1.5">
      {hidden ? (
        eye
      ) : (
        <>
          {look ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('open', { name })}
              className="w-[4.75rem] rounded-2xl bg-card p-1 text-center shadow-md ring-[1.5px] ring-pink-500/80 dark:ring-pink-300/80"
            >
              <LookTile pieces={piecesOf(look)} bare />
              <span className="block truncate text-[11px] font-extrabold text-pink-700 dark:text-pink-300">{name}</span>
            </button>
          ) : (
            <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
              {t('nothing', { name })}
            </span>
          )}
          {eye}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-base">{t('title', { name })}</DialogTitle>
          <DialogDescription>{`${weekdayShort(day, locale)} ${dayAndMonth(day, locale)}`}</DialogDescription>
          {look && (
            <div className="space-y-2">
              <div className="mx-auto w-[min(70vw,16rem)]">
                <LookTile pieces={piecesOf(look)} bare />
              </div>
              <div className="flex items-center justify-between gap-2 px-1">
                <b className="truncate">{outfitTitle(look)}</b>
                <span className="shrink-0 text-sm text-muted-foreground">{occasionLabel(look.occasion)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// More → Family: who your partner is (when the family has more than two) and whether they see
// your planned looks.
export function CoupleSettingsCard() {
  const t = useTranslations('wardrobe.closet.partner');
  const { data: couple } = useCouple();
  const update = useUpdateCouple();
  if (!couple) return null;
  const save = (change: { share_plans?: boolean; partner_id?: string }) =>
    update.mutate(change, { onError: (error) => toast.error(getErrorMessage(error, t('saveError'))) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settingsTitle')}</CardTitle>
        <CardDescription>{t('settingsHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {couple.choices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('whoIsPartner')}</p>
            <div role="radiogroup" aria-label={t('whoIsPartner')} className="flex flex-wrap gap-2">
              {couple.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={couple.partner?.id === choice.id}
                  onClick={() => save({ partner_id: choice.id })}
                  className={`h-9 rounded-full border px-3.5 text-sm ${
                    couple.partner?.id === choice.id ? 'border-foreground bg-foreground font-semibold text-background' : 'bg-card'
                  }`}
                >
                  {choice.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">
            <b className="block">{t('share')}</b>
            <span className="text-muted-foreground">
              {couple.partner ? t('shareHint', { name: firstName(couple.partner) }) : t('shareHintNoPartner')}
            </span>
          </span>
          <Switch checked={couple.share_plans} disabled={update.isPending} onCheckedChange={(on) => save({ share_plans: on })} />
        </label>
      </CardContent>
    </Card>
  );
}
