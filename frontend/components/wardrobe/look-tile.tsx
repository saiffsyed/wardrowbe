'use client';

import Image from 'next/image';
import Link from 'next/link';
import { layoutLook, type LookPiece } from '@/lib/look-layout';

// How much of the tile's height each band takes when it has pieces.
const BAND_WEIGHT = { head: 1.8, top: 4, bottom: 4, full: 8, feet: 2.2 } as const;
type Band = keyof typeof BAND_WEIGHT;
const BANDS: Band[] = ['head', 'top', 'full', 'bottom', 'feet'];

function Row({ pieces }: { pieces: LookPiece[] }) {
  return (
    <div className="flex min-h-0 justify-center">
      {pieces.map((piece, i) => (
        // Pieces in one band overlap a little, as clothes laid out together do.
        <div key={i} className={`relative h-full flex-1 ${i > 0 ? '-ml-[8%]' : ''}`}>
          <Image src={piece.url} alt="" fill className="object-contain" sizes="30vw" />
        </div>
      ))}
    </div>
  );
}

// A saved look laid out on one tall tile: head jewellery, top, bottom and shoes from top to
// bottom, with dupatta, bag and bangles in a narrow column beside them.
export function LookTile({ pieces }: { pieces: LookPiece[] }) {
  const layout = layoutLook(pieces);
  const bands = BANDS.filter((band) => layout[band].length > 0);
  const rows = bands.map((band) => `${BAND_WEIGHT[band]}fr`).join(' ');

  return (
    <div className="photo-ground flex aspect-[3/5] gap-1 overflow-hidden rounded-2xl border p-3">
      <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateRows: rows || '1fr' }}>
        {bands.map((band) => (
          <Row key={band} pieces={layout[band]} />
        ))}
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
}: {
  href: string;
  name: string;
  occasion: string;
  pieces: LookPiece[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LookTile pieces={pieces} />
      <p className="mt-2 line-clamp-2 px-0.5 text-[15px] font-semibold leading-snug">{name}</p>
      <p className="px-0.5 text-sm text-muted-foreground">{occasion}</p>
    </Link>
  );
}
