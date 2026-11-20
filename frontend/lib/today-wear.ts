import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

// "I wore it" on today's look moves through these stages:
//
//   idle ──wore()──▶ undoable ──(5 s, or the app is hidden)──▶ sending ──▶ sent
//                       │                                         │
//                       └──undo()──▶ idle                         └──fails──▶ idle (+ error)
//
// "sent" stays until the outfit itself reports worn_at, so the buttons never flash back
// in between. One shared record per outfit, so every card showing it agrees.
export type WearPhase = 'idle' | 'undoable' | 'sending' | 'sent';

export const UNDO_FOR = 5000;

interface Entry {
  phase: Exclude<WearPhase, 'idle'>;
  timer?: ReturnType<typeof setTimeout>;
  onDone?: (ok: boolean, error?: unknown) => void;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function wearPhase(outfitId: string): WearPhase {
  return entries.get(outfitId)?.phase ?? 'idle';
}

export function wore(outfitId: string, onDone?: Entry['onDone']): void {
  if (entries.has(outfitId)) return;
  entries.set(outfitId, { phase: 'undoable', timer: setTimeout(() => send(outfitId), UNDO_FOR), onDone });
  notify();
}

export function undo(outfitId: string): void {
  const entry = entries.get(outfitId);
  if (entry?.phase !== 'undoable') return;
  clearTimeout(entry.timer);
  entries.delete(outfitId);
  notify();
}

async function send(outfitId: string): Promise<void> {
  const entry = entries.get(outfitId);
  if (entry?.phase !== 'undoable') return;
  clearTimeout(entry.timer);
  entry.phase = 'sending';
  notify();
  try {
    // keepalive lets the request finish when the app is being closed.
    await api.post(`/outfits/${outfitId}/feedback`, { worn: true }, { keepalive: true });
    entry.phase = 'sent';
    notify();
    entry.onDone?.(true);
  } catch (error) {
    entries.delete(outfitId);
    notify();
    entry.onDone?.(false, error);
  }
}

// Leaving or hiding the app sends a waiting wear at once rather than losing it.
function sendAllWaiting() {
  Array.from(entries.entries())
    .filter(([, entry]) => entry.phase === 'undoable')
    .forEach(([id]) => void send(id));
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', sendAllWaiting);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendAllWaiting();
  });
}

// Once the outfit itself says it was worn, the shared record is no longer needed.
export function settle(outfitId: string): void {
  if (entries.get(outfitId)?.phase === 'sent') {
    entries.delete(outfitId);
    notify();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWearPhase(outfitId: string): WearPhase {
  return useSyncExternalStore(subscribe, () => wearPhase(outfitId), () => 'idle');
}

// Test helper: forget every record.
export function resetWears(): void {
  entries.forEach((entry) => clearTimeout(entry.timer));
  entries.clear();
  notify();
}
