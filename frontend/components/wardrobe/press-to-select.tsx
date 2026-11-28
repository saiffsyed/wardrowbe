'use client';

import { useRef, type ReactNode } from 'react';

const HOLD_MS = 450;
const MOVE_PX = 10;

// Press and hold a piece to start selecting, like a phone's photo gallery (Saiff's choice: no
// floating select button). While something is selected, a tap ticks or unticks instead of
// opening the piece. Wraps a tile without changing the layout ("display: contents").
export function PressToSelect({
  selecting,
  selected,
  onSelect,
  children,
}: {
  selecting: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return (
    <div
      className="contents [&_img]:select-none [&_img]:[-webkit-touch-callout:none]"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        held.current = false;
        start.current = { x: event.clientX, y: event.clientY };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          held.current = true;
          start.current = null;
          navigator.vibrate?.(20);
          onSelect(true);
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        const from = start.current;
        if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > MOVE_PX) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        // The click that ends a hold, or any tap while selecting, must not open the piece.
        if (held.current) {
          held.current = false;
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        if (selecting && !(event.target as HTMLElement).closest('[role="checkbox"]')) {
          event.stopPropagation();
          event.preventDefault();
          onSelect(!selected);
        }
      }}
    >
      {children}
    </div>
  );
}
