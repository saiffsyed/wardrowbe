import { describe, expect, it } from 'vitest'
import { layoutLook, lookZone } from '@/lib/look-layout'

const piece = (type: string) => ({ type, url: `/${type}.webp` })
const types = (pieces: { type: string }[]) => pieces.map((p) => p.type)

describe('look layout', () => {
  it('places pieces the way they are worn', () => {
    expect(lookZone('jhumkas')).toBe('head')
    expect(lookZone('kurti')).toBe('top')
    expect(lookZone('palazzo')).toBe('bottom')
    expect(lookZone('saree')).toBe('full')
    expect(lookZone('juttis')).toBe('feet')
    expect(lookZone('dupatta')).toBe('side')
    expect(lookZone('bangles')).toBe('side')
  })

  it('lets a saree take the top and bottom, moving the blouse beside it', () => {
    const layout = layoutLook([piece('saree-blouse'), piece('saree'), piece('petticoat'), piece('heels')])
    expect(types(layout.full)).toEqual(['saree'])
    expect(layout.top).toEqual([])
    expect(layout.bottom).toEqual([])
    expect(types(layout.side)).toEqual(['saree-blouse', 'petticoat'])
    expect(types(layout.feet)).toEqual(['heels'])
  })
})
