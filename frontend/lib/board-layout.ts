import { lookZone, type LookZone } from '@/lib/look-layout';

// A piece on the outfit board: position and width in percent of the board, which is 3 wide
// by 4 high; z is the stacking order (higher lies on top).
export interface BoardPiece {
  item_id: string;
  x: number;
  y: number;
  w: number;
  z: number;
}

export const BOARD_BACKGROUNDS = ['#ffffff', '#f6f1e7', '#e9ecea', '#111316'] as const;
export const DEFAULT_BACKGROUND = BOARD_BACKGROUNDS[0];

const LONG_TOPS = new Set(['kurta', 'kurti', 'sherwani']);

// Where pieces start on the board: the same arrangement as the Lookbook's automatic layout.
// Head jewellery at the top, the top over the bottom (a long kurti further down over it),
// a saree or lehenga in place of both, shoes at the foot and the rest in a side column.
export function autoBoard(items: { id: string; type: string }[]): BoardPiece[] {
  const by: Record<LookZone, { id: string; type: string }[]> = {
    head: [], top: [], bottom: [], full: [], feet: [], side: [],
  };
  for (const item of items) by[lookZone(item.type)].push(item);
  const long = by.top.some((item) => LONG_TOPS.has(item.type));
  const pieces: BoardPiece[] = [];
  let z = 1;
  const put = (id: string, x: number, y: number, w: number) => pieces.push({ item_id: id, x, y, w, z: z++ });
  by.full.forEach((item, i) => put(item.id, 22 + i * 6, 14, 46));
  by.bottom.forEach((item, i) => put(item.id, 26 + i * 6, by.full.length ? 52 : long ? 38 : 44, 40));
  by.top.forEach((item, i) => put(item.id, 20 + i * 6, 12, 48));
  by.head.forEach((item, i) => put(item.id, 34 + i * 6, 2, 24));
  by.feet.forEach((item, i) => put(item.id, 28 + i * 6, 86, 32));
  by.side.forEach((item, i) => put(item.id, 74, 14 + i * 20, 22));
  return pieces;
}

// New pieces join the top of the stack without moving what is already placed.
export function addPieces(current: BoardPiece[], items: { id: string; type: string }[]): BoardPiece[] {
  const have = new Set(current.map((piece) => piece.item_id));
  const added = items.filter((item) => !have.has(item.id));
  const top = Math.max(0, ...current.map((piece) => piece.z));
  return [...current, ...autoBoard(added).map((piece, i) => ({ ...piece, z: top + i + 1 }))];
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
