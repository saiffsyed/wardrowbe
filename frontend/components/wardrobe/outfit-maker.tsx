'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronsUpDown, Droplet, Loader2, Plus, Repeat, Sparkles, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/api';
import { addPieces, autoBoard, BOARD_BACKGROUNDS, DEFAULT_BACKGROUND, type BoardPiece } from '@/lib/board-layout';
import { dayAndMonth, weekdayShort, addDays } from '@/lib/day-format';
import { useHomes } from '@/lib/hooks/use-homes';
import { useItems } from '@/lib/hooks/use-items';
import { useOutfitLayouts, useSaveOutfitLayout } from '@/lib/hooks/use-outfit-layouts';
import { useInfiniteOutfits, useOutfit, type Outfit } from '@/lib/hooks/use-outfits';
import { useOutfitTitle } from '@/lib/hooks/use-outfit-title';
import { useCreateStudioOutfit, usePatchOutfit } from '@/lib/hooks/use-studio';
import { useOccasionLabel } from '@/lib/hooks/use-translated-constants';
import { useUserToday } from '@/lib/hooks/use-user';
import { useCategoryLabel, useWardrobeCategories } from '@/lib/hooks/use-wardrobe-categories';
import { GRID_PAGE_SIZE } from '@/lib/pagination';
import { piecesOf } from './add-outfit-sheet';
import { DressingRoom, type RoomPiece } from './dressing-room';
import { LookTile } from './look-tile';
import { BoardView, EditableBoard, type PieceImages } from './outfit-board';
import { SHEET_CLASS } from './weather-sheet';

// A piece chosen for the look: enough to place it and draw it, whichever chip it came from.
interface Picked {
  id: string;
  type: string;
  thumb?: string;
  image?: string;
}

const OCCASIONS = ['casual', 'work', 'formal', 'party', 'wedding', 'date'] as const;
const PAGE = 100;

type Step = 'pick' | 'arrange' | 'dress' | 'save';

function pickedFromItem(item: { id: string; type: string; thumbnail_url?: string | null; medium_url?: string | null; image_url?: string | null }): Picked {
  return {
    id: item.id,
    type: item.type,
    thumb: item.thumbnail_url ?? item.image_url ?? undefined,
    image: item.medium_url ?? item.image_url ?? item.thumbnail_url ?? undefined,
  };
}

// The clothes to choose from: category chips and a grid with a tick on each.
function ClothesPicker({
  picked,
  onToggle,
}: {
  picked: Map<string, Picked>;
  onToggle: (item: Picked) => void;
}) {
  const t = useTranslations('wardrobe.closet.maker');
  const tc = useTranslations('wardrobe.closet.categories');
  const categoryLabel = useCategoryLabel();
  const { data: homes } = useHomes();
  const homeId = homes?.find((home) => home.is_current)?.id;
  const { data: categories } = useWardrobeCategories(homeId);
  const [category, setCategory] = useState('all');
  const { data, isLoading } = useItems(
    { home_id: homeId, category: category === 'all' ? undefined : category, is_archived: false },
    1,
    PAGE
  );
  const groups = (categories?.groups ?? []).filter((group) => group.item_count > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1">
        {[{ id: 'all', label: tc('all') }, ...groups.map((group) => ({ id: group.id, label: categoryLabel(group) }))].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setCategory(chip.id)}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              category === chip.id ? 'bg-foreground text-background' : 'text-foreground hover:bg-accent'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('noClothes')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {data!.items.map((item) => {
            const on = picked.has(item.id);
            const thumb = item.thumbnail_url ?? item.image_url;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={item.name ?? item.type}
                  onClick={() => onToggle(pickedFromItem(item))}
                  className={`photo-ground relative block aspect-square w-full overflow-hidden rounded-xl p-2 ${on ? 'ring-2 ring-primary' : ''}`}
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element -- small cut-out
                    <img src={thumb} alt="" className="h-full w-full object-contain" />
                  )}
                  <span
                    className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/40 bg-background/60'
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LookbookSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (look: Outfit) => void;
}) {
  const t = useTranslations('wardrobe.closet.maker');
  const outfitTitle = useOutfitTitle();
  const looks = useInfiniteOutfits({ is_lookbook: true }, GRID_PAGE_SIZE);
  const list = looks.data?.pages.flatMap((page) => page.outfits) ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CLASS}>
        <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <DialogTitle className="text-base">{t('fromLookbook')}</DialogTitle>
        <DialogDescription className="sr-only">{t('fromLookbookHint')}</DialogDescription>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noLooks')}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {list.map((look) => (
              <li key={look.id}>
                <button type="button" className="block w-full text-left" onClick={() => onPick(look)}>
                  <LookTile pieces={piecesOf(look)} />
                  <span className="mt-1 block truncate text-xs font-semibold">{outfitTitle(look)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OutfitMaker() {
  const t = useTranslations('wardrobe.closet.maker');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const planDay = searchParams.get('date');
  const today = useUserToday()();
  const occasionLabel = useOccasionLabel();

  const [step, setStep] = useState<Step>('pick');
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map());
  const [pieces, setPieces] = useState<BoardPiece[] | null>(null);
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [swatches, setSwatches] = useState(false);
  const [lookbookOpen, setLookbookOpen] = useState(false);
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState<string>('casual');
  const [day, setDay] = useState<string>(planDay ?? addDays(today, 1));
  const [planning, setPlanning] = useState(!!planDay);
  // The dressing room's pieces to start from, and whether the look being saved came from it
  // (then it keeps the automatic layout instead of a board arrangement).
  const [roomStart, setRoomStart] = useState<RoomPiece[]>([]);
  const [fromRoom, setFromRoom] = useState(false);

  // Opening a saved look to change it: its pieces, arrangement, name and occasion.
  const { data: editing } = useOutfit(editId ?? undefined);
  const { data: editLayouts } = useOutfitLayouts(editId ? [editId] : []);
  useEffect(() => {
    if (!editing) return;
    const items = editing.items.map((item) => pickedFromItem(item));
    setPicked(new Map(items.map((item) => [item.id, item])));
    const saved = editLayouts?.get(editing.id);
    setPieces(saved ? saved.pieces : autoBoard(items));
    if (saved) setBackground(saved.background);
    setName(editing.name ?? '');
    setOccasion(editing.occasion);
    setStep('arrange');
  }, [editing, editLayouts]);

  const create = useCreateStudioOutfit();
  const patch = usePatchOutfit();
  const saveLayout = useSaveOutfitLayout();
  const saving = create.isPending || patch.isPending || saveLayout.isPending;

  const images: PieceImages = useMemo(
    () => Object.fromEntries(Array.from(picked.values()).map((item) => [item.id, item.image])),
    [picked]
  );
  const toggle = (item: Picked) =>
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });

  const toArrange = () => {
    const items = Array.from(picked.values());
    setPieces((current) =>
      current ? addPieces(current.filter((piece) => picked.has(piece.item_id)), items) : autoBoard(items)
    );
    setFromRoom(false);
    setStep('arrange');
  };
  const startFromLook = (look: Outfit) => {
    const items = look.items.map((item) => pickedFromItem(item));
    setPicked(new Map(items.map((item) => [item.id, item])));
    setPieces(autoBoard(items));
    setName(look.name ?? '');
    setOccasion(look.occasion);
    setLookbookOpen(false);
    setStep('arrange');
  };
  const openRoom = (items: Picked[]) => {
    setRoomStart(items);
    setSelected(null);
    setStep('dress');
  };
  const fromDressingRoom = (items: RoomPiece[], next: 'arrange' | 'save') => {
    setPicked(new Map(items.map((item) => [item.id, item])));
    setPieces(autoBoard(items));
    setFromRoom(next === 'save');
    setStep(next);
  };

  const finish = async (asNew: boolean) => {
    if (!pieces?.length) return;
    const items = pieces.map((piece) => piece.item_id);
    try {
      let outfitId = editId && !asNew ? editId : null;
      if (outfitId) {
        await patch.mutateAsync({ id: outfitId, payload: { name: name.trim() || undefined, items } });
      } else {
        const outfit = await create.mutateAsync({
          items,
          occasion,
          name: name.trim() || undefined,
          scheduled_for: planning ? day : null,
        });
        outfitId = outfit.id;
      }
      // A look dressed in the dressing room keeps the automatic layout, unless it replaces one
      // arranged by hand before (whose pieces would no longer match).
      if (!fromRoom || (editId && !asNew && editLayouts?.get(editId))) {
        await saveLayout.mutateAsync({ outfitId, background: fromRoom ? DEFAULT_BACKGROUND : background, pieces });
      }
      toast.success(planning ? t('plannedFor', { day: `${weekdayShort(day, locale)} ${dayAndMonth(day, locale)}` }) : t('saved'));
      router.push(planning ? `/dashboard/plan?day=${day}` : '/dashboard/wardrobe?tab=lookbook');
    } catch (error) {
      toast.error(getErrorMessage(error, t('saveError')));
    }
  };

  const pickedList = Array.from(picked.values());

  if (step === 'pick') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/suggest" className="flex flex-col items-center gap-1 rounded-2xl bg-muted/70 p-3 text-sm font-semibold hover:bg-accent">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            {t('suggestions')}
          </Link>
          <button type="button" onClick={() => setLookbookOpen(true)} className="flex flex-col items-center gap-1 rounded-2xl bg-muted/70 p-3 text-sm font-semibold hover:bg-accent">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            {t('fromLookbook')}
          </button>
        </div>
        <ClothesPicker picked={picked} onToggle={toggle} />

        <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t bg-card px-4 pb-3 pt-2.5 lg:bottom-0 lg:left-72">
          <div className="mx-auto max-w-2xl space-y-2">
            <p className="text-sm font-semibold">{t('selected', { count: pickedList.length })}</p>
            {pickedList.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1.5">
                {pickedList.map((item) => (
                  <div key={item.id} className="photo-ground relative h-14 w-14 shrink-0 rounded-xl p-1.5">
                    {item.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- small cut-out
                      <img src={item.thumb} alt="" className="h-full w-full object-contain" />
                    )}
                    <button
                      type="button"
                      aria-label={t('unpick')}
                      onClick={() => toggle(item)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => openRoom(pickedList)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-bold">
                {t('collage')}
                <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={pickedList.length === 0}
                onClick={toArrange}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-40"
              >
                {t('next')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <LookbookSheet open={lookbookOpen} onOpenChange={setLookbookOpen} onPick={startFromLook} />
      </div>
    );
  }

  if (step === 'arrange') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={t('backToPick')}
            onClick={() => setStep('pick')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!pieces?.length}
            onClick={() => {
              setSelected(null);
              setFromRoom(false);
              setStep('save');
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-40"
          >
            {t('next')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <EditableBoard
          background={background}
          pieces={pieces ?? []}
          images={images}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            setSwatches(false);
          }}
          onChange={setPieces}
          onRemove={(id) => {
            setPieces((current) => (current ?? []).filter((piece) => piece.item_id !== id));
            setPicked((current) => {
              const next = new Map(current);
              next.delete(id);
              return next;
            });
            setSelected(null);
          }}
        />
        <p className="text-center text-xs text-muted-foreground">{t('boardHint')}</p>
        {swatches && (
          <div className="mx-auto flex gap-2 rounded-full border bg-card p-2" role="group" aria-label={t('background')}>
            {BOARD_BACKGROUNDS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={t(`backgrounds.${colour.slice(1)}`)}
                aria-pressed={background === colour}
                onClick={() => {
                  setBackground(colour);
                  setSwatches(false);
                }}
                className={`h-8 w-8 rounded-full border-2 ${background === colour ? 'border-primary' : 'border-border'}`}
                style={{ background: colour }}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Plus, label: t('addClothes'), onClick: () => setAdding(true) },
            { icon: Droplet, label: t('background'), onClick: () => setSwatches((v) => !v) },
            {
              icon: Repeat,
              label: t('switchMode'),
              onClick: () => openRoom((pieces ?? []).map((piece) => picked.get(piece.item_id)).filter((item): item is Picked => !!item)),
            },
          ].map(({ icon: Icon, label, onClick }) => (
            <button key={label} type="button" onClick={onClick} className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-muted text-xs font-bold hover:bg-accent">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <Dialog
          open={adding}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) toArrange();
          }}
        >
          <DialogContent className={`${SHEET_CLASS} flex max-h-[85dvh] flex-col`}>
            <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <DialogTitle className="text-base">{t('addClothes')}</DialogTitle>
            <DialogDescription className="sr-only">{t('addClothesHint')}</DialogDescription>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ClothesPicker picked={picked} onToggle={toggle} />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <b className="text-sm">{t('selected', { count: picked.size })}</b>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  toArrange();
                }}
                className="h-10 rounded-full bg-foreground px-5 text-sm font-bold text-background"
              >
                {t('done')}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (step === 'dress') {
    return (
      <DressingRoom
        start={roomStart}
        day={planDay ?? today}
        onBack={() => setStep('pick')}
        onNext={(items, dressedFor) => {
          if (dressedFor) setOccasion(dressedFor);
          fromDressingRoom(items, 'save');
        }}
        onBoard={(items) => fromDressingRoom(items, 'arrange')}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={fromRoom ? t('backToRoom') : t('backToBoard')}
          onClick={() => (fromRoom ? openRoom(pickedList) : setStep('arrange'))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-extrabold">{t('saveTitle')}</h1>
      </div>
      <div className="mx-auto w-1/2 overflow-hidden rounded-2xl border">
        {fromRoom ? (
          <LookTile pieces={pickedList.map((item) => ({ id: item.id, type: item.type, url: item.thumb ?? item.image ?? '' }))} />
        ) : (
          <BoardView background={background} pieces={pieces ?? []} images={images} />
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="look-name" className="text-sm font-semibold">{t('name')}</label>
        <Input id="look-name" value={name} maxLength={100} placeholder={t('namePlaceholder')} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('occasion')}</p>
        <div className="flex flex-wrap gap-1.5">
          {OCCASIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={occasion === value}
              onClick={() => setOccasion(value)}
              className={`h-9 rounded-full border px-3.5 text-sm ${occasion === value ? 'border-foreground bg-foreground font-semibold text-background' : 'bg-card hover:bg-accent'}`}
            >
              {occasionLabel(value)}
            </button>
          ))}
        </div>
      </div>
      {planning && (
        <div className="space-y-2">
          <label htmlFor="look-day" className="text-sm font-semibold">{t('planDay')}</label>
          <Input id="look-day" type="date" value={day} min={today} onChange={(event) => setDay(event.target.value)} />
        </div>
      )}
      <div className="grid gap-2">
        {planning ? (
          <button type="button" disabled={saving || !day} onClick={() => finish(false)} className="h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('saveAndPlan')}
          </button>
        ) : (
          <button type="button" disabled={saving} onClick={() => finish(false)} className="h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />}
            {editId ? t('saveChanges') : t('saveToLookbook')}
          </button>
        )}
        {!editId && (
          <button type="button" onClick={() => setPlanning((v) => !v)} className="h-12 rounded-full bg-muted font-bold hover:bg-accent">
            {planning ? t('saveToLookbookInstead') : t('planForDay')}
          </button>
        )}
        {editId && (
          <button type="button" disabled={saving} onClick={() => finish(true)} className="h-12 rounded-full bg-muted font-bold hover:bg-accent disabled:opacity-50">
            {t('saveAsNew')}
          </button>
        )}
      </div>
    </div>
  );
}
