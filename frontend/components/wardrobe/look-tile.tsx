'use client';

import Image from 'next/image';
import Link from 'next/link';
import { layoutLook, type LookPiece } from '@/lib/look-layout';
import { DEFAULT_BACKGROUND, type BoardPiece } from '@/lib/board-layout';
import { BoardView } from './outfit-board';

export interface Arranged {
  background: string;
  pieces: BoardPiece[];
}

// How much of the tile's height each band takes when it has pieces.
const BAND_WEIGHT = { head: 1.8, top: 4, bottom: 4, full: 8, feet: 2.2 } as const;
type Band = keyof typeof BAND_WEIGHT;
const BANDS: Band[] = ['head', 'top', 'full', 'bottom', 'feet'];

// The top rests on the bottom edge of its band and the trousers hang from the top of theirs,
// so the two meet the way an outfit is laid out flat. Jewellery sits just above the top and
// shoes just below the trousers, with a little air.
const ANCHOR: Record<Band, string> = {
  head: 'object-bottom pb-[6%]',
  top: 'object-bottom',
  full: 'object-center',
  bottom: 'object-top',
  feet: 'object-top pt-[8%]',
};

// Jewellery and shoes are drawn narrower than clothes, closer to how they look worn.
const ROW_INSET: Partial<Record<Band, string>> = { head: 'px-[28%]', feet: 'px-[18%]' };

function Row({ band, pieces }: { band: Band; pieces: LookPiece[] }) {
  return (
    <div className={`flex min-h-0 justify-center ${ROW_INSET[band] ?? ''}`}>
      {pieces.map((piece, i) => (
        // Pieces in one band overlap a little, as clothes laid out together do.
        <div key={i} className={`relative h-full flex-1 ${i > 0 ? '-ml-[8%]' : ''}`}>
          <Image src={piece.url} alt="" fill className={`object-contain ${ANCHOR[band]}`} sizes="30vw" />
        </div>
      ))}
    </div>
  );
}

// A long kurti over palazzos or churidar, the way it is worn: the kurti covers the upper part
// of the bottoms, which show from under its hem down to the shoes.
function LayeredBody({ top, bottom }: { top: LookPiece[]; bottom: LookPiece[] }) {
  return (
    <div className="relative min-h-0">
      <div className="absolute inset-x-0 bottom-0 top-[36%] flex justify-center">
        {bottom.map((piece, i) => (
          <div key={i} className={`relative h-full flex-1 ${i > 0 ? '-ml-[8%]' : ''}`}>
            <Image src={piece.url} alt="" fill className="object-contain object-top" sizes="30vw" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 z-10 flex h-[64%] justify-center">
        {top.map((piece, i) => (
          <div key={i} className={`relative h-full flex-1 ${i > 0 ? '-ml-[8%]' : ''}`}>
            <Image src={piece.url} alt="" fill className="object-contain object-top" sizes="30vw" />
          </div>
        ))}
      </div>
    </div>
  );
}

// A saved look laid out on one tall tile: head jewellery, top, bottom and shoes from top to
// bottom, with dupatta, bag and bangles in a narrow column beside them.
export function LookTile({ pieces, arranged }: { pieces: LookPiece[]; arranged?: Arranged }) {
  if (arranged) {
    // Arranged by hand on the board: shown exactly as saved.
    const images = Object.fromEntries(pieces.filter((piece) => piece.id).map((piece) => [piece.id!, piece.url]));
    const plain = arranged.background === DEFAULT_BACKGROUND;
    return (
      <div
        className={`flex aspect-[3/5] items-center overflow-hidden rounded-2xl border ${plain ? 'photo-ground' : ''}`}
        style={plain ? undefined : { background: arranged.background }}
      >
        <BoardView background={arranged.background} pieces={arranged.pieces} images={images} />
      </div>
    );
  }
  const layout = layoutLook(pieces);
  // With a long top, the top and the bottoms share one band, drawn over each other.
  const bands = BANDS.filter(
    (band) => layout[band].length > 0 && !(layout.layered && band === 'bottom')
  );
  const rows = bands
    .map((band) => `${layout.layered && band === 'top' ? 8 : BAND_WEIGHT[band]}fr`)
    .join(' ');

  return (
    <div className="photo-ground flex aspect-[3/5] gap-1 overflow-hidden rounded-2xl border p-3">
      <div className="grid min-w-0 flex-1" style={{ gridTemplateRows: rows || '1fr' }}>
        {bands.map((band) =>
          layout.layered && band === 'top' ? (
            <LayeredBody key={band} top={layout.top} bottom={layout.bottom} />
          ) : (
            <Row key={band} band={band} pieces={layout[band]} />
          )
        )}
      </div>
      {layout.side.length > 0 && (
        <div className="flex w-[28%] shrink-0 flex-col justify-center gap-1">
          {layout.side.slice(0, 5).map((piece, i) => (
            <div key={i} className="relative min-h-0 flex-1 basis-0" style={{ maxHeight: '24%' }}>
              <Image src={piece.url} alt="" fill className="object-contain" sizes="12vw" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The tile with the look's name and occasion under it, opening the outfit.
export function LookCard({
  href,
  name,
  occasion,
  pieces,
  arranged,
}: {
  href: string;
  name: string;
  occasion: string;
  pieces: LookPiece[];
  arranged?: Arranged;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LookTile pieces={pieces} arranged={arranged} />
      <p className="mt-2 line-clamp-2 px-0.5 text-[15px] font-semibold leading-snug">{name}</p>
      <p className="px-0.5 text-sm text-muted-foreground">{occasion}</p>
    </Link>
  );
}
