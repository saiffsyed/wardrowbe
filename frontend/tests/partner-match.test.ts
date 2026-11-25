import { describe, expect, it } from 'vitest'
import { colourScore, makeMatchingLook, matchSavedLooks, type PartnerLook } from '@/lib/partner-match'
import { wadaPairing, wadaStrength } from '@/lib/wada'
import type { Outfit } from '@/lib/hooks/use-outfits'
import type { Item } from '@/lib/types'

const saree: PartnerLook = {
  occasion: 'wedding',
  items: [{ id: 's', type: 'saree', primary_color: 'pink', colors: ['pink'] }],
  item_patterns: { s: 'solid' },
}
const look = (id: string, occasion: string, pieces: [string, string][]) =>
  ({ id, occasion, items: pieces.map(([type, colour], i) => ({ id: `${id}${i}`, type, primary_color: colour, colors: [colour], position: i })) }) as unknown as Outfit
const item = (id: string, type: string, colour: string, extra: Partial<Item> = {}) =>
  ({ id, type, primary_color: colour, colors: [colour], needs_wash: false, is_archived: false, tags: { season: [], occasions: [] }, ...extra }) as unknown as Item

describe('Wada colour pairs', () => {
  it('knows which colours Wada combines and which never', () => {
    expect(wadaStrength('pink', 'gray')).toBeGreaterThanOrEqual(0.15)
    expect(wadaStrength('navy', 'orange')).toBeGreaterThanOrEqual(0.15)
    expect(wadaStrength('pink', 'orange')).toBeLessThan(0.04)
    const pair = wadaPairing('pink', 'gray')
    expect(pair.combination?.hexes.length).toBeGreaterThanOrEqual(2)
  })

  it('scores Go with and Twin differently', () => {
    const go = colourScore(['gray'], ['pink'], 'go')
    expect(go.score).toBeGreaterThan(0)
    expect(go.reason).toMatchObject({ kind: 'pair', mine: 'gray', theirs: 'pink' })
    expect(colourScore(['orange'], ['pink'], 'go').score).toBeLessThan(0)
    expect(colourScore(['pink'], ['pink'], 'twin').reason).toMatchObject({ kind: 'twin' })
  })
})

describe('Match with partner', () => {
  it('offers the dressed-up looks that go best with a pink wedding saree', () => {
    const looks = [
      look('grey', 'wedding', [['kurta', 'gray'], ['dhoti', 'white']]),
      look('orange', 'wedding', [['kurta', 'orange'], ['pants', 'orange']]),
      look('casual', 'casual', [['shirt', 'gray'], ['jeans', 'blue']]),
    ]
    const found = matchSavedLooks(looks, saree, 'go', new Map())
    expect(found.map((m) => m.look?.id)).toEqual(['grey'])
  })

  it('puts a new look together from clean clothes', () => {
    const items = [
      item('k', 'kurta', 'gray'),
      item('o', 'kurta', 'orange'),
      item('p', 'pants', 'white'),
      item('d', 'pants', 'navy', { needs_wash: true }),
      item('m', 'mojari', 'tan'),
    ]
    const made = makeMatchingLook(items, new Set(), saree, 'go', 'mild')
    expect(made?.itemIds).toEqual(['k', 'p', 'm'])
  })
})
