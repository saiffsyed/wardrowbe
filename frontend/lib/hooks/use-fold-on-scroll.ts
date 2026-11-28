'use client';

import { useEffect, useState } from 'react';

// True while the person scrolls down through the page, past the first screenful of header;
// false again as soon as they scroll up or return to the top.
export function useFoldOnScroll(threshold = 160): boolean {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    // A laptop screen has room for the whole header; only phones and tablets fold it.
    const wide = window.matchMedia?.('(min-width: 1024px)');
    const onScroll = () => {
      if (wide?.matches) {
        setFolded(false);
        return;
      }
      const y = window.scrollY;
      // A few pixels of jitter (a thumb resting, the address bar settling) changes nothing.
      if (Math.abs(y - last) < 6) return;
      // On a short page folding would only make the page jump; keep everything in view.
      const roomToScroll = document.documentElement.scrollHeight - window.innerHeight;
      setFolded(roomToScroll > threshold * 3 && y > threshold && y > last);
      last = y;
    };
    // Turning a tablet or widening the window to laptop size unfolds at once.
    const onWide = () => wide?.matches && setFolded(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    wide?.addEventListener?.('change', onWide);
    return () => {
      window.removeEventListener('scroll', onScroll);
      wide?.removeEventListener?.('change', onWide);
    };
  }, [threshold]);
  return folded;
}
