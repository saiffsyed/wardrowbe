'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/api';
import { dayAndMonth, weekdayShort } from '@/lib/day-format';
import { warmthOf } from '@/lib/dressing-room';
import { useCouple, useUpdateCouple, type PartnerInfo, type PartnerPlan } from '@/lib/hooks/use-couple';
import { useHomes } from '@/lib/hooks/use-homes';
import { useItems } from '@/lib/hooks/use-items';
import { useLaundryStates } from '@/lib/hooks/use-laundry';
import type { DayForecast } from '@/lib/hooks/use-stays';
import { useCreateStudioOutfit } from '@/lib/hooks/use-studio';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { makeMatchingLook, matchSavedLooks, type Match, type MatchStyle } from '@/lib/partner-match';
import { lookChoices } from '@/lib/today';
import { useDeleteOutfit, useInfiniteOutfits, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { useColorLabel, useOccasionLabel } from '@/lib/hooks/use-translated-constants';
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

// Your partner's look for the day, small in the top corner of the Plan screen. The eye on
// its corner hides or shows it (remembered on this phone); tapping it opens the look large,
// with Match with partner.
export function PartnerCorner({
  day,
  look,
  myLook,
  forecast,
}: {
  day: string;
  look: PartnerPlan | undefined;
  myLook: Outfit | undefined;
  forecast: DayForecast | null;
}) {
  const t = useTranslations('wardrobe.closet.partner');
  const locale = useLocale();
  const outfitTitle = useOutfitTitle();
  const occasionLabel = useOccasionLabel();
  const { data: couple } = useCouple();
  const [hidden, setHidden] = useState(savedHidden);
  const [open, setOpen] = useState(false);
  const [matching, setMatching] = useState(false);
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
      className={`flex items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground ${
        hidden ? 'h-8 w-8' : 'absolute -left-2.5 -top-2.5 h-7 w-7'
      }`}
    >
      {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
  const close = (value: boolean) => {
    setOpen(value);
    if (!value) setMatching(false);
  };

  return (
    <div className="absolute right-0 top-1 z-10">
      {hidden ? (
        eye
      ) : (
        <div className="relative">
          {look ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('open', { name })}
              className="block w-[4.75rem] rounded-2xl bg-card p-1 text-center shadow-md ring-[1.5px] ring-pink-500/80 dark:ring-pink-300/80"
            >
              <LookTile pieces={piecesOf(look)} bare />
              <span className="block truncate text-[11px] font-extrabold text-pink-700 dark:text-pink-300">{name}</span>
            </button>
          ) : (
            <span className="block rounded-full bg-pink-50 py-1 pl-6 pr-2.5 text-xs font-bold text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
              {t('nothing', { name })}
            </span>
          )}
          {eye}
        </div>
      )}

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
          <DialogTitle className="text-base">{matching ? t('matchTitle', { name }) : t('title', { name })}</DialogTitle>
          <DialogDescription>{`${weekdayShort(day, locale)} ${dayAndMonth(day, locale)}`}</DialogDescription>
          {look && !matching && (
            <div className="space-y-3">
              <div className="mx-auto w-[min(62vw,15rem)]">
                <LookTile pieces={piecesOf(look)} bare />
              </div>
              <div className="flex items-center justify-between gap-2 px-1">
                <b className="truncate">{outfitTitle(look)}</b>
                <span className="shrink-0 text-sm text-muted-foreground">{occasionLabel(look.occasion)}</span>
              </div>
              <button
                type="button"
                onClick={() => setMatching(true)}
                className="h-12 w-full rounded-full bg-pink-600 font-extrabold text-white hover:bg-pink-700 dark:bg-pink-400 dark:text-pink-950"
              >
                {t('match')}
              </button>
            </div>
          )}
          {look && matching && (
            <MatchChoices day={day} partnerLook={look} myLook={myLook} forecast={forecast} name={name} onDone={() => close(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Looks of yours that go with your partner's (lib/partner-match.ts has the rules): up to
// three saved looks and one new one from your clothes. Picking one plans it for the day.
function MatchChoices({
  day,
  partnerLook,
  myLook,
  forecast,
  name,
  onDone,
}: {
  day: string;
  partnerLook: PartnerPlan;
  myLook: Outfit | undefined;
  forecast: DayForecast | null;
  name: string;
  onDone: () => void;
}) {
  const t = useTranslations('wardrobe.closet.partner');
  const colourLabel = useColorLabel();
  const outfitTitle = useOutfitTitle();
  const [style, setStyle] = useState<MatchStyle>('go');
  const { data: homes } = useHomes();
  const homeId = homes?.find((home) => home.is_current)?.id;
  const { data: itemList } = useItems({ home_id: homeId, is_archived: false }, 1, 100);
  const { data: away } = useLaundryStates();
  const lookbook = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  const create = useCreateStudioOutfit();
  const remove = useDeleteOutfit();
  const warmth = warmthOf(forecast);
  const items = useMemo(() => itemList?.items ?? [], [itemList]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const matches = useMemo(() => {
    const awayIds = new Set(away?.keys() ?? []);
    const saved = lookChoices(lookbook.data?.pages.flatMap((page) => page.outfits) ?? [], byId, awayIds, warmth);
    const found: Match[] = matchSavedLooks(saved, partnerLook, style, byId);
    const made = makeMatchingLook(items, awayIds, partnerLook, style, warmth);
    const savedSets = found.map((match) => match.itemIds.slice().sort().join());
    if (made && !savedSets.includes(made.itemIds.slice().sort().join())) found.push(made);
    return found;
  }, [lookbook.data, byId, items, away, partnerLook, style, warmth]);

  if (myLook?.feedback?.worn_at) return <p className="py-4 text-sm text-muted-foreground">{t('alreadyWorn')}</p>;

  const reasonText = (match: Match) => {
    const r = match.reason;
    if (r.kind === 'pair') return t('reasonPair', { mine: colourLabel(r.mine), theirs: colourLabel(r.theirs) });
    if (r.kind === 'neutral') return t('reasonNeutral', { mine: colourLabel(r.mine) });
    if (r.kind === 'twin') return t('reasonTwin', { colour: colourLabel(r.colour) });
    if (r.kind === 'indian') return t('reasonIndian');
    return t('reasonOccasion');
  };
  const piecesFor = (match: Match) =>
    match.look
      ? piecesOf(match.look)
      : match.itemIds.flatMap((id) => {
          const item = byId.get(id);
          const url = item?.thumbnail_url ?? item?.image_url;
          return item && url ? [{ id, type: item.type, url }] : [];
        });
  const plan = async (match: Match) => {
    try {
      const added = await create.mutateAsync({
        items: match.itemIds,
        occasion: match.look?.occasion ?? partnerLook.occasion,
        name: match.look?.name ?? undefined,
        scheduled_for: day,
      });
      // The look it replaces was planned for this day only; keep one look on the day.
      if (myLook) {
        try {
          await remove.mutateAsync(myLook.id);
        } catch (error) {
          await remove.mutateAsync(added.id).catch(() => undefined);
          throw error;
        }
      }
      toast.success(t('planned', { name }));
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, t('planError')));
    }
  };

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t('styleLabel')} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(['go', 'twin'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={style === value}
            onClick={() => setStyle(value)}
            className={`h-9 rounded-lg text-sm font-bold ${style === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            {t(`style.${value}`)}
          </button>
        ))}
      </div>
      {matches.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('noMatches')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {matches.map((match) => (
            <li key={match.look?.id ?? 'new'}>
              <button
                type="button"
                disabled={create.isPending || remove.isPending}
                onClick={() => plan(match)}
                className="block w-full rounded-xl border bg-background p-1.5 text-left disabled:opacity-50"
              >
                <LookTile pieces={piecesFor(match)} />
                <span className="mt-1 block truncate text-xs font-bold">{match.look ? outfitTitle(match.look) : t('newLook')}</span>
                <span className="block text-[11px] font-semibold text-pink-700 dark:text-pink-300">{reasonText(match)}</span>
                {match.reason.kind === 'pair' && match.reason.wada && (
                  <span className="mt-1 flex items-center gap-1" title={t('wada', { id: match.reason.wada.id })}>
                    {match.reason.wada.hexes.map((hex) => (
                      <span key={hex} className="h-3 w-3 rounded-full border border-black/10" style={{ background: hex }} />
                    ))}
                    <span className="text-[10px] text-muted-foreground">{t('wada', { id: match.reason.wada.id })}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">{t('wadaCredit')}</p>
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
