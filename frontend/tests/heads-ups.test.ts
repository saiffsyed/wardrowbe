import { describe, expect, it } from 'vitest'
import { headsUps, type HeadsUpInput } from '@/lib/heads-ups'
import { isBackFrom } from '@/lib/trip-return'
import type { Item } from '@/lib/types'

const TODAY = '2026-11-22'
const item = (id: string, extra: Partial<Item> = {}) =>
  ({ id, type: 'kurti', needs_wash: false, tags: { season: [] }, ...extra }) as unknown as Item
const sky = (temp_max: number, precipitation_chance = 10, condition = 'sunny') => ({
  forecast: { temp_max, temp_min: temp_max - 6, precipitation_chance, humidity: 60, uv_index: 5, condition },
  city: 'Chennai',
})

function input(over: Partial<HeadsUpInput> = {}): HeadsUpInput {
  return {
    day: TODAY,
    today: TODAY,
    look: { items: [{ id: 'kurti', name: 'Teal kurti', type: 'kurti' }, { id: 'juttis', name: 'Suede juttis', type: 'juttis' }] },
    items: new Map([
      ['kurti', item('kurti')],
      ['juttis', item('juttis', { type: 'juttis', tags: { material: 'Suede', season: [] } as unknown as Item['tags'] })],
    ]),
    laundry: new Map(),
    forecast: new Map([[TODAY, sky(31)]]),
    stays: [],
    toWash: 0,
    name: (piece) => piece.name ?? piece.type,
    ...over,
  }
}
const kinds = (over: Partial<HeadsUpInput> = {}) => headsUps(input(over)).map((h) => h.kind)

describe('heads-ups', () => {
  it('says nothing on an ordinary day', () => {
    expect(kinds()).toEqual([])
  })

  it('names a piece of the look that is in the wash', () => {
    const [first] = headsUps(input({ laundry: new Map([['kurti', 'wash']]) }))
    expect(first).toMatchObject({ kind: 'away', action: 'swap', values: { name: 'Teal kurti', state: 'washing' } })
  })

  it('warns about rain on suede, and about wool on a hot day', () => {
    expect(kinds({ forecast: new Map([[TODAY, sky(24, 70, 'rain')]]) })).toEqual(['rain'])
    const wool = new Map([['kurti', item('kurti', { tags: { material: 'Merino wool', season: [] } as unknown as Item['tags'] })]])
    expect(kinds({ items: wool, forecast: new Map([[TODAY, sky(34)]]) })).toEqual(['hot'])
  })

  it('notices a cold day with no warm layer', () => {
    expect(kinds({ forecast: new Map([[TODAY, sky(8)]]) })).toEqual(['cold'])
  })

  it('warns of a much colder trip in the next days, on today only', () => {
    const stays = [{ id: 's', city: 'Europe', home_id: null, start_date: '2026-11-24', end_date: '2026-11-30' }]
    const forecast = new Map([[TODAY, sky(31)], ['2026-11-24', sky(8)]])
    const [trip] = headsUps(input({ stays, forecast }))
    expect(trip).toMatchObject({ kind: 'trip', values: { city: 'Europe', difference: 23, colder: 'colder' } })
    expect(kinds({ stays, forecast, day: '2026-11-23' })).toEqual([])
  })

  it('suggests washing before several rainy days', () => {
    const forecast = new Map([
      [TODAY, sky(30)],
      ['2026-11-24', sky(26, 80)],
      ['2026-11-25', sky(26, 75)],
      ['2026-11-26', sky(26, 90)],
    ])
    const found = headsUps(input({ forecast, toWash: 6 }))
    expect(found.map((h) => h.kind)).toEqual(['washBeforeRain'])
    expect(found[0].values).toMatchObject({ from: '2026-11-24', to: '2026-11-26', count: 6 })
    expect(kinds({ forecast, toWash: 2 })).toEqual([])
  })

  it('puts them in order of importance', () => {
    expect(
      kinds({
        laundry: new Map([['kurti', 'dry']]),
        forecast: new Map([[TODAY, sky(24, 70, 'rain')]]),
        returned: { homeName: 'Chennai' },
      })
    ).toEqual(['away', 'rain', 'home'])
  })
})

describe('back from a trip', () => {
  const trip = { from: 'chennai', to: 'europe', stayId: 's' }
  const stays = [{ id: 's', end_date: '2026-11-21' }]
  it('offers the way back once the stay is over and the wardrobe still shows the trip home', () => {
    expect(isBackFrom(trip, TODAY, stays, 'europe')).toBe(true)
    expect(isBackFrom(trip, '2026-11-21', stays, 'europe')).toBe(false)
    expect(isBackFrom(trip, TODAY, stays, 'chennai')).toBe(false)
    expect(isBackFrom(null, TODAY, stays, 'europe')).toBe(false)
  })
})
