import { describe, expect, it } from 'vitest'
import { lookChoices } from '@/lib/today'
import type { Outfit } from '@/lib/hooks/use-outfits'
import type { Item } from '@/lib/types'

const item = (id: string, extra: Partial<Item> = {}) =>
  ({ id, type: 'kurti', needs_wash: false, tags: { season: [] }, last_worn_at: undefined, ...extra }) as unknown as Item
const look = (id: string, ids: string[]) => ({ id, items: ids.map((i) => ({ id: i })) }) as unknown as Outfit

const items = new Map(
  [
    item('kurti'),
    item('palazzo', { type: 'palazzo', last_worn_at: '2026-11-01' }),
    item('dirty', { needs_wash: true }),
    item('coat', { type: 'coat' }),
    item('shirt', { type: 'shirt', last_worn_at: '2026-10-01' }),
  ].map((entry) => [entry.id, entry])
)

describe('lookChoices', () => {
  it('leaves out looks with something to wash, away, in another home or too warm', () => {
    const looks = [
      look('fine', ['kurti', 'palazzo']),
      look('dirty', ['kurti', 'dirty']),
      look('away', ['shirt']),
      look('elsewhere', ['kurti', 'not-here']),
      look('warm', ['kurti', 'coat']),
    ]
    expect(lookChoices(looks, items, new Set(['shirt']), 'hot').map((l) => l.id)).toEqual(['fine'])
  })

  it('puts warm looks first on a cold day, then the least recently worn', () => {
    const looks = [look('recent', ['palazzo']), look('older', ['shirt']), look('warm', ['coat'])]
    expect(lookChoices(looks, items, new Set(), 'cold').map((l) => l.id)).toEqual(['warm', 'older', 'recent'])
    expect(lookChoices(looks, items, new Set(), 'mild').map((l) => l.id)).toEqual(['warm', 'older', 'recent'])
  })
})
