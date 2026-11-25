import { useId } from 'react';

// Aina's logo (Saiff's choice, 25 Nov 2026): an arch mirror with a person reflected in it,
// cut out so the page shows through. Her A-line dress is the letter A. The same drawing is in
// public/logo.svg and the app icons (white on the green tile).
export const AINA_ARCH = 'M10 60V31a22 22 0 0 1 44 0v29z';
export const AINA_PERSON = {
  head: { cx: 32, cy: 27, r: 5 },
  body: 'M28.5 35h7c1.8 0 3 1.2 3.3 3L41 60H23l2.2-22c.3-1.8 1.5-3 3.3-3z',
  arms: 'M26.2 37.4 20.6 51M37.8 37.4 43.4 51',
};

export function AinaMark({ className = 'h-6 w-6' }: { className?: string }) {
  const mask = `aina-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 text-primary ${className}`} aria-hidden="true">
      <mask id={mask}>
        <rect width="64" height="64" fill="white" />
        <circle {...AINA_PERSON.head} fill="black" />
        <path d={AINA_PERSON.body} fill="black" />
        <path d={AINA_PERSON.arms} stroke="black" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      </mask>
      <path d={AINA_ARCH} fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}
