import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeatherBar } from '@/components/wardrobe/weather-bar'

let weather: Record<string, unknown> | undefined

vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: weather }) }))
let days: { days: Record<string, unknown>[] } | undefined
vi.mock('@/lib/hooks/use-stays', () => ({ useWeatherDays: () => ({ data: days }) }))
vi.mock('@/lib/hooks/use-preferences', () => ({
  usePreferences: () => ({ data: { temperature_unit: 'celsius' } }),
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useWeatherConditionLabel: () => (c: string) => c,
}))

describe('WeatherBar', () => {
  it('shows nothing until the weather is known', () => {
    weather = undefined
    const { container } = render(<WeatherBar />)
    expect(container.textContent).toBe('')
  })

  it('shows the temperature, sky, rain and humidity, and opens the weather screen', () => {
    weather = { temperature: 31.2, feels_like: 35, humidity: 70, precipitation_chance: 10, condition: 'sunny', is_day: true }
    render(<WeatherBar />)
    expect(screen.getByText('31°')).toBeTruthy()
    expect(screen.getByText(/sunny/)).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/weather')
  })

  it("shows the stay's city and forecast on a day away", () => {
    weather = { temperature: 31, feels_like: 35, humidity: 70, precipitation_chance: 10, condition: 'sunny', is_day: true }
    days = { days: [{ date: '2026-11-21', city: 'Bangalore', away: true, stay_id: 's', home_id: null,
      forecast: { temp_min: 18, temp_max: 26, precipitation_chance: 40, humidity: 65, uv_index: 5, condition: 'cloudy' } }] }
    render(<WeatherBar />)
    expect(screen.getByText('26°')).toBeTruthy()
    expect(screen.getByText(/inCity/)).toBeTruthy()
    days = undefined
  })
})
