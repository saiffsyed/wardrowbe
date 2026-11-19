'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, Unlock, Repeat, Shirt, Shuffle, Tag, Trash2, Undo2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  boxOf,
  choices,
  coversBottom,
  dressWith,
  pickOne,
  piecesFor,
  resolveColours,
  shuffleOutfit,
  spotOf,
  warmthOf,
  worn,
  type Box,
  type DressItem,
  type Outfit,
  type Spot,
} from '@/lib/dressing-room';
import { DEFAULT_ROOM, useDressingRoomSettings } from '@/lib/hooks/use-dressing-room';
import { useHomes } from '@/lib/hooks/use-homes';
import { useItems } from '@/lib/hooks/use-items';
import { useLaundryStates } from '@/lib/hooks/use-laundry';
import { useWeatherDays } from '@/lib/hooks/use-stays';
import { useOccasionLabel, useTypeLabel } from '@/lib/hooks/use-translated-constants';
import type { Item } from '@/lib/types';
import { DressingFigure } from './dressing-figure';
import { weatherIcon } from './home-weather';

// A piece handed to and from the outfit maker.
export interface RoomPiece {
  id: string;
  type: string;
  thumb?: string;
  image?: string;
}

const OCCASIONS = ['casual', 'work', 'formal', 'party', 'wedding', 'date'] as const;
const GROUPS: { key: string; spots: Spot[] }[] = [
  { key: 'jewellery', spots: ['head', 'neck', 'wrist'] },
  { key: 'tops', spots: ['top'] },
  { key: 'layers', spots: ['outer'] },
  { key: 'bottoms', spots: ['bottom'] },
  { key: 'shoes', spots: ['feet'] },
  { key: 'accessories', spots: ['dupatta', 'bag'] },
];
const UNDO_FOR = 5000;

function fromItem(item: Item): DressItem {
  return {
    id: item.id,
    type: item.type,
    image: item.medium_url ?? item.image_url ?? item.thumbnail_url ?? undefined,
    thumb: item.thumbnail_url ?? item.image_url ?? undefined,
    occasions: item.tags?.occasions ?? [],
    material: item.tags?.material,
    season: item.tags?.season ?? [],
    lastWorn: item.last_worn_at ?? null,
  };
}

// The stage keeps the figure's shape (1 wide by 2 high) and fills as much of the screen as it can.
function useFit() {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => {
      const w = Math.min(element.clientWidth, element.clientHeight / 2);
      setSize({ w, h: w * 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { area, size };
}

const place = (box: Box) => ({ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` });

// The dressing room: only the outfit on a figure until a piece is tapped. Then the pieces
// beside it peek in from the edges to swipe through, tools appear on the side and the clothes
// for that place open at the bottom.
export function DressingRoom({
  start,
  day,
  onBack,
  onNext,
  onBoard,
}: {
  start: RoomPiece[];
  day: string;
  onBack: () => void;
  onNext: (pieces: RoomPiece[], occasion: string | null) => void;
  onBoard: (pieces: RoomPiece[]) => void;
}) {
  const t = useTranslations('wardrobe.closet.dressing');
  const typeLabel = useTypeLabel();
  const occasionLabel = useOccasionLabel();
  const { resolvedTheme } = useTheme();
  const { data: settings } = useDressingRoomSettings();
  const room = settings ?? DEFAULT_ROOM;
  const colours = resolveColours(room.background, room.figure_colour, resolvedTheme === 'dark');
  const ink = colours.darkGround ? '#f2f4f3' : '#16201d';
  const chip = colours.darkGround ? 'rgba(255,255,255,.13)' : 'rgba(22,32,29,.08)';

  const { data: homes } = useHomes();
  const homeId = homes?.find((home) => home.is_current)?.id;
  const { data: list, isLoading } = useItems({ home_id: homeId, is_archived: false }, 1, 100);
  const { data: weather } = useWeatherDays(7);
  const { data: away } = useLaundryStates();
  const forecastDay = weather?.days.find((entry) => entry.date === day);
  const warmth = warmthOf(forecastDay?.forecast);

  // The clothes of this home that are not waiting for a wash, plus whatever the look started with.
  const items = useMemo(() => {
    const startIds = new Set(start.map((piece) => piece.id));
    // Clothes away in the wash or at the dry cleaner are left out too.
    const loaded = (list?.items ?? [])
      .filter((item) => startIds.has(item.id) || (!item.needs_wash && !away?.has(item.id)))
      .map(fromItem);
    const have = new Set(loaded.map((item) => item.id));
    const extra = start
      .filter((piece) => !have.has(piece.id))
      .map((piece): DressItem => ({ id: piece.id, type: piece.type, image: piece.image, thumb: piece.thumb, occasions: [], season: [] }));
    return [...loaded, ...extra].filter((item) => spotOf(item.type));
  }, [list, start, away]);

  const [outfit, setOutfit] = useState<Outfit>(() => dressWith(start));
  const [locked, setLocked] = useState<Set<Spot>>(new Set());
  const [selected, setSelected] = useState<Spot | null>(null);
  const [kind, setKind] = useState('all');
  const [sheet, setSheet] = useState<'clothes' | 'occasion' | null>(null);
  const [group, setGroup] = useState('all');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [undo, setUndo] = useState<Outfit | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const { area, size } = useFit();

  // With nothing chosen yet, the room opens dressed for the day.
  const dressed = useRef(start.length > 0);
  useEffect(() => {
    if (dressed.current || isLoading || !list) return;
    dressed.current = true;
    setOutfit((current) => shuffleOutfit(current, items, { locked: new Set(), occasion: null, warmth }));
  }, [isLoading, list, items, warmth]);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const onFigure = worn(outfit, items);
  const pieces = (): RoomPiece[] => onFigure.map(({ item }) => ({ id: item.id, type: item.type, thumb: item.thumb, image: item.image }));

  const unlockFirst = () => toast(t('unlockFirst'));
  const offerUndo = (before: Outfit) => {
    setUndo(before);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_FOR);
  };
  const shuffle = (forOccasion = occasion) => {
    const before = outfit;
    setOutfit(shuffleOutfit(outfit, items, { locked, occasion: forOccasion, warmth }));
    offerUndo(before);
  };
  const putOn = (spot: Spot, id: string | null) => {
    if (locked.has(spot)) return unlockFirst();
    setOutfit((current) => ({ ...current, [spot]: id }));
  };

  // Swiping, or the shuffle button beside a piece, moves through the clothes for its place.
  const along = (spot: Spot) => piecesFor(items, spot).filter((item) => kind === 'all' || item.type === kind);
  const step = (direction: 1 | -1) => {
    if (!selected) return;
    if (locked.has(selected)) return unlockFirst();
    const row = along(selected);
    if (!row.length) return;
    const at = row.findIndex((item) => item.id === outfit[selected]);
    putOn(selected, row[(at + direction + row.length) % row.length].id);
  };
  const neighbours = (spot: Spot) => {
    const row = along(spot);
    const at = row.findIndex((item) => item.id === outfit[spot]);
    if (row.length < 2 || at < 0) return null;
    return { prev: row[(at - 1 + row.length) % row.length], next: row[(at + 1) % row.length] };
  };

  const swipe = useRef<{ x: number; y: number } | null>(null);
  // A swipe that ends over a piece is not a tap on it.
  const swiped = useRef(false);
  const down = (event: React.PointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const up = (event: React.PointerEvent) => {
    const from = swipe.current;
    swipe.current = null;
    swiped.current = false;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) > 12) swiped.current = true;
    if (selected && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  };

  const select = (spot: Spot) => {
    setSelected(spot);
    setKind('all');
    setSheet(null);
    setUndo(null);
  };
  const calm = () => {
    setSelected(null);
    setSheet(null);
  };

  const peek = selected ? neighbours(selected) : null;
  const kinds = selected ? Array.from(new Set(piecesFor(items, selected).map((item) => item.type))) : [];
  const sheetItems = selected
    ? along(selected)
    : sheet === 'clothes'
      ? items.filter((item) => {
          const spot = spotOf(item.type);
          return group === 'all' || GROUPS.find((entry) => entry.key === group)?.spots.includes(spot!);
        })
      : [];
  const isOn = (item: DressItem) => Object.values(outfit).includes(item.id) && onFigure.some((entry) => entry.item.id === item.id);
  const tapThumb = (item: DressItem) => {
    const spot = spotOf(item.type)!;
    if (sheet === 'clothes' && isOn(item)) return putOn(spot, null);
    putOn(spot, item.id);
    // Putting on a top for under a saree's place brings a bottom back with it.
    if (spot === 'top' && !coversBottom(item.type) && !outfit.bottom && !locked.has('bottom')) {
      const bottom = pickOne(choices(items, 'bottom', occasion, warmth));
      if (bottom) setOutfit((current) => ({ ...current, bottom: bottom.id }));
    }
  };

  const round = 'flex h-12 w-12 items-center justify-center rounded-full backdrop-blur';
  const temp = forecastDay?.forecast ? Math.round(forecastDay.forecast.temp_max) : null;
  const WeatherIcon = forecastDay?.forecast ? weatherIcon(forecastDay.forecast.condition) : null;

  return (
    <div
      className="fixed inset-x-0 bottom-[4.5rem] top-0 z-30 overflow-hidden lg:bottom-0 lg:left-72"
      style={{ background: colours.background, color: ink }}
    >
      <div ref={area} className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative touch-pan-y select-none"
          style={{ width: size.w, height: size.h }}
          onPointerDown={down}
          onPointerUp={up}
          onClick={(event) => event.target === event.currentTarget && !swiped.current && calm()}
        >
          <DressingFigure shape={room.figure} colour={colours.figure} className="pointer-events-none absolute left-[12%] top-[8%] h-[76%] w-[76%]" />
          {peek &&
            [peek.prev, peek.next].map((item, i) => {
              const box = boxOf(selected!, item.type);
              return (
                // eslint-disable-next-line @next/next/no-img-element -- cut-outs are placed freely
                <img
                  key={`${i}-${item.id}`}
                  src={item.image}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute object-contain object-top opacity-80"
                  style={place({ ...box, x: i === 0 ? -box.w * 0.62 : 100 - box.w * 0.38 })}
                />
              );
            })}
          {onFigure.map(({ spot, item }) => (
            <button
              key={spot}
              type="button"
              aria-label={t('piece', { kind: typeLabel(item.type) })}
              aria-pressed={selected === spot}
              onClick={() => !swiped.current && select(spot)}
              className="absolute"
              style={{ ...place(boxOf(spot, item.type)), zIndex: selected === spot ? 20 : undefined }}
            >
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element -- cut-outs are placed freely
                <img
                  src={item.image}
                  alt=""
                  draggable={false}
                  className={`pointer-events-none h-full w-full object-contain object-top ${selected === spot ? 'drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]' : ''}`}
                />
              )}
              {locked.has(spot) && !selected && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: chip }}>
                  <Lock className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
          {!isLoading && onFigure.length === 0 && (
            <p className="absolute inset-x-6 top-[45%] text-center text-sm font-semibold">{t('empty')}</p>
          )}
        </div>
      </div>

      <div className="absolute inset-x-3 top-3 z-30 flex items-center justify-between gap-2">
        <button type="button" aria-label={t('back')} onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ArrowLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        {temp !== null && WeatherIcon && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold" style={{ background: chip }}>
            <WeatherIcon className="h-4 w-4" aria-hidden="true" />
            {temp}°{forecastDay?.city ? ` ${forecastDay.city}` : ''}
          </span>
        )}
        <button
          type="button"
          disabled={onFigure.length === 0}
          onClick={() => onNext(pieces(), occasion)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-extrabold disabled:opacity-40"
          style={{ background: ink, color: colours.background }}
        >
          {t('next')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {selected && (
        <div className="absolute right-3 top-[28%] z-30 flex flex-col gap-2.5">
          <button type="button" aria-label={t('done')} onClick={calm} className={round} style={{ background: ink, color: colours.background }}>
            <Check className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={locked.has(selected) ? t('unlock') : t('lock')}
            aria-pressed={locked.has(selected)}
            onClick={() =>
              setLocked((current) => {
                const next = new Set(current);
                if (next.has(selected)) next.delete(selected);
                else next.add(selected);
                return next;
              })
            }
            className={`${round} ${locked.has(selected) ? 'ring-2 ring-amber-500' : ''}`}
            style={{ background: chip }}
          >
            {locked.has(selected) ? <Lock className="h-5 w-5" aria-hidden="true" /> : <Unlock className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            aria-label={t('shuffleOne')}
            onClick={() => {
              if (locked.has(selected)) return unlockFirst();
              const others = choices(items, selected, occasion, warmth).filter((item) => item.id !== outfit[selected]);
              const pick = pickOne(others);
              if (pick) putOn(selected, pick.id);
            }}
            className={round}
            style={{ background: chip }}
          >
            <Shuffle className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('remove')}
            onClick={() => {
              putOn(selected, null);
              setLocked((current) => {
                const next = new Set(current);
                next.delete(selected);
                return next;
              });
              setSelected(null);
            }}
            className={round}
            style={{ background: chip }}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {!selected && !sheet && (
        <>
          {undo && (
            <button
              type="button"
              onClick={() => {
                setOutfit(undo);
                setUndo(null);
              }}
              className="absolute left-1/2 top-16 z-30 inline-flex h-10 -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#16201d] px-4 text-sm font-bold text-white shadow-lg"
            >
              {temp !== null ? t('shuffledFor', { temp }) : t('shuffled')}
              <span className="inline-flex items-center gap-1 text-[#7FD6BC]">
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                {t('undo')}
              </span>
            </button>
          )}
          <div className="absolute inset-x-3 bottom-3 z-30 grid grid-cols-4 gap-2">
            {[
              { icon: Shirt, label: t('clothes'), onClick: () => (setSheet('clothes'), setGroup('all'), setUndo(null)) },
              { icon: Tag, label: occasion ? occasionLabel(occasion) : t('occasion'), onClick: () => (setSheet('occasion'), setUndo(null)) },
              { icon: Shuffle, label: t('shuffle'), onClick: () => shuffle() },
              { icon: Repeat, label: t('switchMode'), onClick: () => onBoard(pieces()) },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-bold"
                style={{ background: chip }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {(selected || sheet) && (
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl bg-[#1b1f23] px-3 pb-3 pt-2 text-[#eef2f0] shadow-2xl">
          <button type="button" aria-label={t('closeSheet')} onClick={calm} className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-[#555c61]" />
          {sheet === 'occasion' ? (
            <>
              <p className="mb-2 px-1 text-sm font-extrabold">{t('occasionTitle')}</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[null, ...OCCASIONS].map((value) => (
                  <button
                    key={value ?? 'all'}
                    type="button"
                    aria-pressed={occasion === value}
                    onClick={() => {
                      setOccasion(value);
                      setSheet(null);
                      shuffle(value);
                    }}
                    className={`h-9 shrink-0 rounded-xl px-3.5 text-sm font-bold ${occasion === value ? 'bg-white text-[#16201d]' : ''}`}
                  >
                    {value ? occasionLabel(value) : t('any')}
                  </button>
                ))}
              </div>
              <p className="mt-1 px-1 text-xs text-[#9aa6a1]">{t('occasionHint')}</p>
            </>
          ) : (
            <>
              <div className="mb-2 flex gap-1.5 overflow-x-auto">
                {selected
                  ? ['all', ...kinds].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={kind === value}
                        onClick={() => setKind(value)}
                        className={`h-9 shrink-0 rounded-xl px-3.5 text-sm font-bold ${kind === value ? 'bg-white text-[#16201d]' : ''}`}
                      >
                        {value === 'all' ? t('any') : typeLabel(value)}
                      </button>
                    ))
                  : ['all', ...GROUPS.map((entry) => entry.key)].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={group === value}
                        onClick={() => setGroup(value)}
                        className={`h-9 shrink-0 rounded-xl px-3.5 text-sm font-bold ${group === value ? 'bg-white text-[#16201d]' : ''}`}
                      >
                        {value === 'all' ? t('any') : t(`groups.${value}`)}
                      </button>
                    ))}
              </div>
              {sheetItems.length === 0 ? (
                <p className="px-1 py-4 text-sm text-[#9aa6a1]">{t('noneHere')}</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {sheetItems.map((item) => {
                    const on = isOn(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={typeLabel(item.type)}
                        aria-pressed={on}
                        onClick={() => tapThumb(item)}
                        className={`h-20 w-[4.5rem] shrink-0 rounded-xl border-2 bg-[#2a3035] p-1.5 ${on ? 'border-[#7FD6BC]' : 'border-transparent'}`}
                      >
                        {item.thumb && (
                          // eslint-disable-next-line @next/next/no-img-element -- small cut-out
                          <img src={item.thumb} alt="" className="h-full w-full object-contain" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {selected && outfit[selected] && byId.get(outfit[selected]!) ? typeLabel(byId.get(outfit[selected]!)!.type) : ''}
      </span>
    </div>
  );
}
