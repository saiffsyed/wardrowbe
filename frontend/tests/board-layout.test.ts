import { describe, expect, it } from 'vitest'
import { addPieces, autoBoard } from '@/lib/board-layout'

describe('autoBoard', () => {
  it('starts a look in the order it is worn, top above bottom', () => {
    const pieces = autoBoard([
      { id: 'shoes', type: 'juttis' }, { id: 'pants', type: 'palazzo' },
      { id: 'top', type: 'shirt' }, { id: 'ears', type: 'jhumkas' }, { id: 'scarf', type: 'dupatta' },
    ])
    const at = (id: string) => pieces.find((p) => p.item_id === id)!
    expect(at('ears').y).toBeLessThan(at('top').y)
    expect(at('top').y).toBeLessThan(at('pants').y)
    expect(at('pants').y).toBeLessThan(at('shoes').y)
    expect(at('scarf').x).toBeGreaterThan(60)
    expect(at('top').z).toBeGreaterThan(at('pants').z)
  })

  it('adds new pieces on top without moving placed ones', () => {
    const placed = [{ item_id: 'a', x: 5, y: 5, w: 30, z: 3 }]
    const next = addPieces(placed, [{ id: 'a', type: 'shirt' }, { id: 'b', type: 'heels' }])
    expect(next[0]).toEqual(placed[0])
    expect(next).toHaveLength(2)
    expect(next[1].z).toBe(4)
  })
})
