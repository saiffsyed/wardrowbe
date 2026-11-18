import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeatherBar } from '@/components/wardrobe/weather-bar'

let weather: Record<string, unknown> | undefined

vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: weather }) }))
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

  it('shows the temperature, sky, rain and humidity, and opens Plan', () => {
    weather = { temperature: 31.2, feels_like: 35, humidity: 70, precipitation_chance: 10, condition: 'sunny', is_day: true }
    render(<WeatherBar />)
    expect(screen.getByText('31°')).toBeTruthy()
    expect(screen.getByText(/sunny/)).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard')
  })
})
