import { describe, expect, it } from 'vitest'
import { lookForDay, lookPhase } from '@/lib/look-phase'
import type { Outfit } from '@/lib/hooks/use-outfits'

const look = (id: string, extra: Partial<Outfit>) =>
  ({ id, scheduled_for: '2026-11-20', status: 'pending', feedback: null, ...extra }) as Outfit

describe('look stages', () => {
  it('names the stage from the separate fields', () => {
    expect(lookPhase(look('a', { scheduled_for: null }))).toBe('template')
    expect(lookPhase(look('a', {}))).toBe('planned')
    expect(lookPhase(look('a', { feedback: { worn_at: '2026-11-20' } as Outfit['feedback'] }))).toBe('worn')
    expect(lookPhase(look('a', { status: 'rejected' }))).toBe('declined')
  })

  it('shows the worn look of a day before any other', () => {
    const outfits = [
      look('new', {}),
      look('worn', { feedback: { worn_at: '2026-11-20' } as Outfit['feedback'] }),
      look('declined', { status: 'rejected' }),
    ]
    expect(lookForDay(outfits, '2026-11-20')?.id).toBe('worn')
    expect(lookForDay([look('declined', { status: 'rejected' })], '2026-11-20')).toBeUndefined()
  })
})
