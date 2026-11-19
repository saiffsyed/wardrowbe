'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { clamp, DEFAULT_BACKGROUND, type BoardPiece } from '@/lib/board-layout';

export type PieceImages = Record<string, string | undefined>;

function sorted(pieces: BoardPiece[]) {
  return [...pieces].sort((a, b) => a.z - b.z);
}

// A saved arrangement, shown as it was laid out (in the Lookbook, Collections and Planner).
// The plain white board takes the screen's own photo ground, so it suits dark mode too.
export function BoardView({
  background,
  pieces,
  images,
  className = '',
}: {
  background: string;
  pieces: BoardPiece[];
  images: PieceImages;
  className?: string;
}) {
  const plain = background === DEFAULT_BACKGROUND;
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden ${plain ? 'photo-ground' : ''} ${className}`}
      style={plain ? undefined : { background }}
    >
      {sorted(pieces).map((piece) =>
        images[piece.item_id] ? (
          // eslint-disable-next-line @next/next/no-img-element -- cut-outs are placed freely
          <img
            key={piece.item_id}
            src={images[piece.item_id]}
            alt=""
            draggable={false}
            className="pointer-events-none absolute h-auto select-none"
            style={{ left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%` }}
          />
        ) : null
      )}
    </div>
  );
}

interface Gesture {
  id: string;
  pointers: Map<number, { x: number; y: number }>;
  start: { x: number; y: number; w: number };
  from: { x: number; y: number };
  spread: number;
  moved: boolean;
}

const spreadOf = (points: { x: number; y: number }[]) =>
  points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

// The board you arrange a look on: drag a piece with one finger, pinch with two to resize
// (or turn the mouse wheel over it), tap it for Front / Back / Remove.
export function EditableBoard({
  background,
  pieces,
  images,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  background: string;
  pieces: BoardPiece[];
  images: PieceImages;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (pieces: BoardPiece[]) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('wardrobe.closet.maker');
  const board = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);

  const update = (id: string, change: Partial<BoardPiece>) =>
    onChange(pieces.map((piece) => (piece.item_id === id ? { ...piece, ...change } : piece)));

  const down = (event: React.PointerEvent, piece: BoardPiece | null) => {
    const current = gesture.current;
    if (current) {
      // A second finger anywhere on the board pinches the piece being held.
      current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      current.spread = spreadOf(Array.from(current.pointers.values()));
      current.start = { ...current.start, w: pieces.find((p) => p.item_id === current.id)?.w ?? current.start.w };
      board.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (!piece) {
      onSelect(null);
      return;
    }
    event.preventDefault();
    board.current?.setPointerCapture(event.pointerId);
    gesture.current = {
      id: piece.item_id,
      pointers: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
      start: { x: piece.x, y: piece.y, w: piece.w },
      from: { x: event.clientX, y: event.clientY },
      spread: 0,
      moved: false,
    };
  };

  const move = (event: React.PointerEvent) => {
    const current = gesture.current;
    const rect = board.current?.getBoundingClientRect();
    if (!current || !rect || !current.pointers.has(event.pointerId)) return;
    current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(current.pointers.values());
    if (points.length >= 2 && current.spread > 0) {
      current.moved = true;
      update(current.id, { w: clamp((current.start.w * spreadOf(points)) / current.spread, 8, 100) });
      return;
    }
    const dx = ((event.clientX - current.from.x) / rect.width) * 100;
    const dy = ((event.clientY - current.from.y) / rect.height) * 100;
    if (Math.abs(dx) + Math.abs(dy) > 1) current.moved = true;
    if (current.moved) update(current.id, { x: clamp(current.start.x + dx, -20, 100), y: clamp(current.start.y + dy, -10, 100) });
  };

  const up = (event: React.PointerEvent) => {
    const current = gesture.current;
    if (!current) return;
    current.pointers.delete(event.pointerId);
    if (current.pointers.size > 0) return;
    gesture.current = null;
    if (!current.moved) onSelect(selected === current.id ? null : current.id);
  };

  const chosen = pieces.find((piece) => piece.item_id === selected);
  const topZ = Math.max(0, ...pieces.map((piece) => piece.z));
  const bottomZ = Math.min(0, ...pieces.map((piece) => piece.z));

  return (
    <div
      ref={board}
      className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-[1.75rem] border shadow-sm"
      style={{ background }}
      onPointerDown={(event) => event.target === board.current && down(event, null)}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {sorted(pieces).map((piece) => (
        <div
          key={piece.item_id}
          role="button"
          tabIndex={0}
          aria-label={t('piece')}
          aria-pressed={selected === piece.item_id}
          className={`absolute cursor-grab ${selected === piece.item_id ? 'rounded-md outline-dashed outline-2 outline-offset-4 outline-[#1E5B4F]' : ''}`}
          style={{ left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            down(event, piece);
          }}
          onWheel={(event) => update(piece.item_id, { w: clamp(piece.w * (event.deltaY < 0 ? 1.06 : 0.94), 8, 100) })}
          onKeyDown={(event) => event.key === 'Enter' && onSelect(piece.item_id)}
        >
          {images[piece.item_id] && (
            // eslint-disable-next-line @next/next/no-img-element -- cut-outs are placed freely
            <img src={images[piece.item_id]} alt="" draggable={false} className="pointer-events-none h-auto w-full" />
          )}
        </div>
      ))}
      {chosen && (
        <div
          className="absolute z-[1000] flex -translate-x-1/2 -translate-y-[115%] overflow-hidden rounded-full bg-[#16201d] text-sm font-bold text-white shadow-lg"
          style={{ left: `${clamp(chosen.x + chosen.w / 2, 22, 78)}%`, top: `${Math.max(9, chosen.y)}%` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" className="px-3.5 py-2" onClick={() => update(chosen.item_id, { z: topZ + 1 })}>
            {t('front')}
          </button>
          <button type="button" className="border-l border-white/15 px-3.5 py-2" onClick={() => update(chosen.item_id, { z: bottomZ - 1 })}>
            {t('back')}
          </button>
          <button type="button" className="border-l border-white/15 px-3.5 py-2" onClick={() => onRemove(chosen.item_id)}>
            {t('remove')}
          </button>
        </div>
      )}
    </div>
  );
}
