'use client';

import Image from 'next/image';
import { FolderHeart } from 'lucide-react';

// A 2×2 collage of the first four things in a collection; fewer pictures leave quiet tiles.
export function CollectionCover({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-muted">
        <FolderHeart className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl border p-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`relative overflow-hidden rounded-md ${urls[i] ? 'photo-ground' : 'bg-muted/50'}`}>
          {urls[i] && (
            <Image src={urls[i]} alt="" fill className="object-contain p-1" sizes="25vw" />
          )}
        </div>
      ))}
    </div>
  );
}
