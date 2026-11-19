import { describe, expect, it } from 'vitest'
import { weatherHint } from '@/lib/weather-hints'

const day = (over: Partial<Parameters<typeof weatherHint>[0]>) => ({
  temp_min: 24, temp_max: 32, precipitation_chance: 10, humidity: 70, uv_index: 7, condition: 'sunny', ...over,
})

describe('weatherHint', () => {
  it('puts wet weather before warmth', () => {
    expect(weatherHint(day({ condition: 'thunderstorm' }))).toBe('storm')
    expect(weatherHint(day({ precipitation_chance: 80 }))).toBe('rain')
    expect(weatherHint(day({ condition: 'light-drizzle' }))).toBe('rain')
  })

  it('tells hot and humid from hot and dry', () => {
    expect(weatherHint(day({}))).toBe('hotHumid')
    expect(weatherHint(day({ humidity: 30 }))).toBe('hot')
  })

  it('warns of a cool evening, and of cool and cold days', () => {
    expect(weatherHint(day({ temp_max: 27, temp_min: 17 }))).toBe('coolEvening')
    expect(weatherHint(day({ temp_max: 16, temp_min: 9 }))).toBe('cool')
    expect(weatherHint(day({ temp_max: 6, temp_min: 0 }))).toBe('cold')
    expect(weatherHint(day({ temp_max: 26, temp_min: 21 }))).toBe('mild')
  })
})
